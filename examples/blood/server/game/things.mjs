// Things (Blood's kStatThing: barrels, thrown TNT, drips, heads, the dead) moving by Blood's MoveThing with the
// original's thingInfo (BLOOD.EXE: mass, clipdist, how they bounce, what hurts them), and explosions by its
// explodeInfo (damage falling off with distance, the concussion's push by size and mass).
import { mulscale, divscale, ksqrt, scale, CLIPMASK0 } from '../../common/engine.mjs'
import { approxDist, wallBounce, getZRange, checkLink } from './physics.mjs'
import { STAT } from './triggers.mjs'
import { DAMAGE } from './combat.mjs'

// Blood's explosion kinds (explodeInfo's order): the thrown bundle's is the standard (1: the original's explosion
// sprite has type 1), a barrel's the large (2)
export const EXPLOSION = { small: 0, standard: 1, large: 2, fireball: 3, napalm: 5, spray: 6, tnt: 1 }
const THING = { tntBarrel: 400, proxBomb: 401, remoteBomb: 402, tntStick: 418, tntBundle: 419, sprayBundle: 420, dripWater: 423, dripBlood: 424 }

export default class Things {
  constructor (game) {
    this.game = game
    this.level = game.level
    this.info = game.res.tables.thingInfo
    this.explodeInfo = game.res.tables.explodeInfo
    this.moving = new Map() // sprite index -> { fuse, owner, onHit }
    this.explosions = [] // { x, y, z, sectnum, e, owner, time }
    this.bodies = new Map()
  }

  mass (s) { const t = this.info[s.type] || (this.bodies.get(s.index)); return t ? t.mass : 0 }

  /** A dead dude's body, moved as a thing with its own mass (no bounce) */
  body (s, mass) {
    if (!this.bodies) this.bodies = new Map()
    this.bodies.set(s.index, { mass, elastic: 0, dmgResist: 0x7fffffff, clipdist: s.clipdist })
    this.moving.set(s.index, { health: 1 << 30, body: true })
  }

  /** Blood's actFireThing: a thing of a type thrown from a sprite along its angle at `speed`, with a slope */
  fire (from, type, zOffset, slope, speed, o = {}) {
    const info = this.info[type], level = this.level, trig = level.trig
    const s = level.spawn(from.sectnum, from.x, from.y, from.z + zOffset, STAT.thing, {
      picnum: info.picnum, xrepeat: info.xrepeat || 32, yrepeat: info.yrepeat || 32, shade: info.shade, pal: info.pal, clipdist: info.clipdist,
      cstat: info.cstat, ang: from.ang, owner: from.index, type, flags: info.flags
    })
    s.xvel = mulscale(speed, trig.Cos(from.ang), 30)
    s.yvel = mulscale(speed, trig.Sin(from.ang), 30)
    s.zvel = mulscale(speed, slope, 14)
    this.moving.set(s.index, Object.assign({ owner: from.index, health: info.startHealth << 4 }, o))
    return s
  }

  /** A thing hurt: past its health it goes off (barrels, TNT) or breaks */
  damaged (source, s, kind, damage) {
    const info = this.info[s.type]
    if (!info) return 0
    const factor = info.dmgControl[kind] ?? 256
    if (!factor) return 0
    damage = mulscale(damage, factor, 8)
    const m = this.moving.get(s.index) || { health: info.startHealth << 4 }
    m.health = (m.health ?? info.startHealth << 4) - damage
    this.moving.set(s.index, m)
    if (m.health <= 0 && (s.type === THING.tntBarrel || s.type === THING.tntBundle || s.type === THING.tntStick || s.type === THING.proxBomb || s.type === THING.remoteBomb)) this.explode(s, s.type === THING.tntBarrel ? EXPLOSION.large : EXPLOSION.tnt, source)
    return damage
  }

  tick () {
    // Explosions last their time (explodeInfo's ticks, 120 Hz): every frame of it they hurt and push what is in reach
    for (const ex of this.explosions.slice()) {
      this.blast(ex)
      ex.time -= 4
      if (ex.time <= 0) this.explosions.splice(this.explosions.indexOf(ex), 1)
    }
    for (const [index, m] of [...this.moving]) {
      const s = this.level.sprites[index]
      if (!s || s.statnum !== STAT.thing) { this.moving.delete(index); continue }
      if (m.fuse !== undefined && --m.fuse <= 0) { this.explode(s, EXPLOSION.tnt, this.level.sprites[m.owner]); continue }
      if (!(s.xvel || s.yvel || s.zvel || (s.flags & 4) || (s.flags & 2))) continue
      const hit = this.move(s)
      if (hit && m.impact && (hit & 0xc000) === 0xc000) {
        const other = this.level.sprites[hit & 0x3fff]
        if (other && other.statnum === STAT.dude && other.index !== m.owner) { this.explode(s, EXPLOSION.tnt, this.level.sprites[m.owner]); continue }
      }
      if (hit && (s.type === THING.dripWater || s.type === THING.dripBlood) && (hit & 0xc000) === 0x4000) {
        this.game.missiles.effect(s, 6)
        this.remove(s)
      }
    }
  }

  /** Blood's MoveThing; returns what it hit (a sector's floor 0x4000, a wall 0x8000, a sprite 0xc000) */
  move (s) {
    const level = this.level, engine = level.engine, info = this.info[s.type] || this.bodies.get(s.index) || { elastic: 0, dmgResist: 0 }
    let { top, bottom } = level.extents(s)
    let hit = 0
    if (s.xvel || s.yvel) {
      const cstat = s.cstat
      s.cstat &= ~257
      const pos = { x: s.x, y: s.y, z: s.z, sectnum: s.sectnum }
      hit = engine.clipmove(pos, (s.xvel >> 12) * 16384, (s.yvel >> 12) * 16384, s.clipdist << 2, (s.z - top) >> 2, (bottom - s.z) >> 2, CLIPMASK0)
      s.cstat = cstat
      if (pos.sectnum >= 0) { s.x = pos.x; s.y = pos.y; if (pos.sectnum !== s.sectnum) { s.sectnum = pos.sectnum; level.touched() } }
      if ((hit & 0xc000) === 0x8000) wallBounce(level, s, hit & 0x3fff, info.elastic)
      // A sprite in the way: what a thrown bundle meets
      if (!hit) {
        const near = this.touching(s)
        if (near >= 0) hit = 0xc000 | near
      }
    }
    if (s.zvel) s.z += s.zvel >> 8
    let zr = getZRange(level, s, s.clipdist << 2)
    ;({ top, bottom } = level.extents(s))
    if ((s.flags & 2) && bottom < zr.florz) { s.z += 455; s.zvel += 58254 }
    if (checkLink(level, s)) zr = getZRange(level, s, s.clipdist << 2)
    ;({ top, bottom } = level.extents(s))
    if (bottom >= zr.florz) {
      s.z += zr.florz - bottom
      let v = s.zvel - level.velFloor[s.sectnum]
      if (v > 0) {
        s.flags |= 4
        // actFloorBounceVector on a level floor: back up by what the bounce keeps
        const t = 0x10000 - info.elastic
        const t2 = mulscale(v, t, 16)
        v = -(v - t2)
        const damage = mulscale(t2, t2, 30) - info.dmgResist
        if (damage > 0) this.damaged(s, s, DAMAGE.fall, damage)
        s.zvel = v
        if (!level.velFloor[s.sectnum] && Math.abs(s.zvel) < 0x10000) { s.zvel = 0; s.flags &= ~4 }
        hit = hit || (0x4000 | s.sectnum)
      } else if (s.zvel === 0) s.flags &= ~4
    } else if (s.flags & 2) s.flags |= 4
    if (top <= zr.ceilz) {
      s.z += Math.max(zr.ceilz - top, 0)
      if (s.zvel < 0) { s.xvel = mulscale(s.xvel, 0xc000, 16); s.yvel = mulscale(s.yvel, 0xc000, 16); s.zvel = mulscale(-s.zvel, 0x4000, 16) }
    }
    if (bottom >= zr.florz) {
      // Friction on the floor, as much as 0x11111 of speed a tick
      const v = approxDist(s.xvel, s.yvel)
      if (v > 0) {
        const t = divscale(Math.min(v, 0x11111), v, 16)
        s.xvel -= mulscale(t, s.xvel, 16)
        s.yvel -= mulscale(t, s.yvel, 16)
      }
    }
    if (s.xvel || s.yvel) s.ang = level.trig.getangle(s.xvel, s.yvel)
    return hit
  }

  /** A dude whose body the thing touches */
  touching (s) {
    for (const i of this.level.engine.spritesIn(s.sectnum)) {
      const d = this.level.sprites[i]
      if (d === s || d.statnum !== STAT.dude || !(d.cstat & 1)) continue
      const r = (d.clipdist << 2) + (s.clipdist << 2)
      if (Math.abs(d.x - s.x) > r || Math.abs(d.y - s.y) > r) continue
      const { top, bottom } = this.level.extents(d)
      if (s.z >= top && s.z <= bottom) return i
    }
    return -1
  }

  /**
   * Blood's actExplodeSprite and its explosion: radius damage (falling off from dmg + dmgRng to dmg at the edge),
   * the concussion's push, the explosion's sequence, its sound and the shake
   */
  explode (s, kind, source) {
    const e = this.explodeInfo[kind] || this.explodeInfo[EXPLOSION.large]
    const game = this.game
    const owner = source || s
    const x = s.x, y = s.y, z = s.z, sectnum = s.sectnum
    this.remove(s)
    const ex = { x, y, z, sectnum, e, owner, time: e.ticks }
    this.explosions.push(ex)
    this.blast(ex)
    ex.time -= 4
    game.missiles.effect({ x, y, z, sectnum }, kind === EXPLOSION.small ? 4 : 3)
    game.sound({ x, y, z, sectnum, index: -1 }, kind === EXPLOSION.small ? 303 : 304)
    if (e.quake) game.shakeNear({ x, y }, e.quake << 4)
  }

  /** One frame of an explosion: what is within its radius and in its sight hurt (less with distance) and pushed */
  blast (ex) {
    const { x, y, z, sectnum, e, owner } = ex
    const game = this.game, level = this.level, engine = level.engine
    const radius = e.radius << 4
    for (const sn of this.affectedSectors(sectnum, x, y, radius)) {
      for (const i of engine.spritesIn(sn).slice()) {
        const d = level.sprites[i]
        if (d.statnum !== STAT.dude && d.statnum !== STAT.thing) continue
        const dx = Math.abs(x - d.x), dy = Math.abs(y - d.y), dz = Math.abs(z - d.z) >> 4
        const dist = ksqrt(dx * dx + dy * dy + dz * dz)
        if (dist > radius) continue
        if (!engine.cansee(x, y, z, sectnum, d.x, d.y, d.z, d.sectnum)) continue
        const dmg = e.dmg + Math.trunc((radius - dist) * e.dmgRng / Math.max(1, radius))
        if (dmg > 0) game.combat.damage(owner, d, DAMAGE.explode, dmg << 4)
        this.concuss(d, x, y, z, e.force)
        if (e.burnTime) game.burn(d, owner, e.burnTime * 4)
      }
    }
  }

  /** Blood's ConcussSprite: pushed away from the blast by its force, its size and its mass */
  concuss (d, x, y, z, force) {
    const level = this.level
    const dx = d.x - x, dy = d.y - y, dz = (d.z - z) >> 4
    const dist2 = Math.max(dx * dx + dy * dy + dz * dz, 32 << 4)
    const f = scale(0x40000, force, dist2)
    const mass = d.statnum === STAT.dude ? (this.game.res.tables.dudeInfo[d.type] || {}).mass : this.mass(d)
    if (!mass) return
    const t = level.res.tiles[d.picnum] || { w: 0, h: 0 }
    const size = (t.w * d.xrepeat * t.h * d.yrepeat) >> 1
    const k = scale(f, size, mass)
    d.xvel += mulscale(k, dx, 16)
    d.yvel += mulscale(k, dy, 16)
    d.zvel += mulscale(k, dz, 16)
    if (d.statnum === STAT.thing && !this.moving.has(d.index) && this.info[d.type]) this.moving.set(d.index, { health: this.info[d.type].startHealth << 4 })
  }

  /** The sectors a blast reaches through openings within its radius */
  affectedSectors (sectnum, x, y, radius) {
    const level = this.level, seen = new Set([sectnum]), queue = [sectnum]
    while (queue.length) {
      const sec = level.sectors[queue.shift()]
      for (let w = sec.wallptr; w < sec.wallptr + sec.wallnum; w++) {
        const wall = level.walls[w]
        if (wall.nextsector < 0 || seen.has(wall.nextsector)) continue
        const w2 = level.walls[wall.point2]
        const ddx = w2.x - wall.x, ddy = w2.y - wall.y, l = ddx * ddx + ddy * ddy
        const t = l ? Math.max(0, Math.min(1, ((x - wall.x) * ddx + (y - wall.y) * ddy) / l)) : 0
        if (Math.hypot(x - wall.x - t * ddx, y - wall.y - t * ddy) < radius) { seen.add(wall.nextsector); queue.push(wall.nextsector) }
      }
    }
    return seen
  }

  remove (s) {
    this.moving.delete(s.index)
    this.game.seqs.kill(s)
    this.level.remove(s)
  }
}
