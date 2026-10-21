// Things (Blood's kStatThing: barrels, thrown TNT, drips, heads, the dead) moving by Blood's MoveThing with the
// original's thingInfo (BLOOD.EXE: mass, clipdist, how they bounce, what hurts them), and explosions by its
// explodeInfo (damage falling off with distance, the concussion's push by size and mass).
import { mulscale, divscale, ksqrt, scale, CLIPMASK0 } from '../../common/engine.mjs'
import { approxDist, wallBounce, getZRange, checkLink, airDrag } from './physics.mjs'
import { STAT, CMD, SPRITE } from './triggers.mjs'
import { DAMAGE } from './combat.mjs'

// Blood's explosion kinds (explodeInfo's order): the thrown bundle's is the standard (1: the original's explosion
// sprite has type 1), a barrel's the large (2)
export const EXPLOSION = { small: 0, standard: 1, large: 2, fireball: 3, napalm: 5, spray: 6, tnt: 1 }
const THING = { tntBarrel: 400, proxBomb: 401, remoteBomb: 402, tntStick: 418, tntBundle: 419, sprayBundle: 420, dripWater: 423, dripBlood: 424, bloodBits: 425, bloodChunks: 426, zombieHead: 427 }

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

  /** Blood's GibThing for each of a list of gib records */
  gib (s, records) { for (const g of records) this.gibThing(s, g) }

  /**
   * Blood's GibThing: a piece of a body (or a head) from a random place on its edge (or a given place), flying at
   * random within the record's speeds (across, up), a thing that bounces and blocks
   */
  gibThing (s, g, pos = null, vel = null) {
    const level = this.level, trig = level.trig, R = this.game.random
    if (g.chance !== 0x10000 && !R.Chance(g.chance)) return
    const { top, bottom } = level.extents(s)
    let x, y, z
    if (pos) ({ x, y, z } = pos)
    else {
      const a = R.Random(2048)
      x = s.x + mulscale(s.clipdist << 2, trig.Cos(a), 30); y = s.y + mulscale(s.clipdist << 2, trig.Sin(a), 30)
      z = bottom - R.Random(Math.max(1, bottom - top))
    }
    // In the sprite's own sector, as Blood's actSpawnThing (its heights there decide how the piece flies up)
    const sect = s.sectnum
    if (sect < 0) return
    const info = this.info[g.type]
    const gib = level.spawn(sect, x, y, z, STAT.thing, { picnum: g.picnum > -1 ? g.picnum : info.picnum, xrepeat: info.xrepeat || 64, yrepeat: info.yrepeat || 64, clipdist: info.clipdist, cstat: 128 | info.cstat, type: g.type, flags: info.flags })
    if (vel) {
      gib.xvel = vel.x + R.Random2(g.across); gib.yvel = vel.y + R.Random2(g.across); gib.zvel = vel.z - R.Random(g.up)
    } else {
      // (a thing's speeds are over 180, an effect's over 120)
      gib.xvel = R.Random2(Math.trunc((g.across << 18) / 120))
      gib.yvel = R.Random2(Math.trunc((g.across << 18) / 120))
      const cz = level.engine.getceilzofslope(sect, x, y), fz = level.engine.getflorzofslope(sect, x, y)
      const dz1 = fz - z, dz2 = z - cz
      const up = Math.trunc((Math.abs(g.up) << 18) / 120)
      if (dz2 < dz1 && dz2 < 0x4000) gib.zvel = 0
      else if (dz2 > dz1 && dz1 < 0x4000) gib.zvel = -R.Random(up)
      else gib.zvel = R.Random2(up)
    }
    // Blood's actSpawnThing for the bits and the head: locked for 180 clock ticks, then broken by what they hit into
    // their own gibs (actActivateGibObject: blood chunks, GIBTYPE 18 or 7) with their sound
    const gibObject = g.type === THING.bloodBits || g.type === THING.bloodChunks || g.type === THING.zombieHead
      ? { gib: g.type === THING.bloodBits ? 19 : 8, sound: g.type === THING.zombieHead ? 318 : 319, unlock: this.game.clock + 180 } : null
    this.moving.set(gib.index, { health: info.startHealth << 4, gibObject })
  }

  /** Blood's actActivateGibObject: a gib object broken (its gib types, its sound) and gone */
  activateGibObject (s, o) {
    if (o.gib > 0) this.game.fx.gibSprite(s, o.gib - 1)
    if (o.sound > 0) this.game.sound(s, o.sound)
    this.remove(s)
  }

  /** A dead dude's body (Blood's kThingBloodChunks, moved by its thingInfo; it does not die again) */
  body (s) {
    this.moving.set(s.index, { health: 1 << 30, body: true })
  }

  /** Blood's actFireThing: a thing of a type thrown from a sprite along its angle at `speed`, with a slope */
  fire (from, type, zOffset, slope, speed, o = {}) {
    const info = this.info[type], level = this.level, trig = level.trig, engine = level.engine
    // Blood's actFireThing: a clipdist ahead of the thrower, or back from a wall in the way
    const cd = from.clipdist || 0, cos = trig.Cos(from.ang || 0), sin = trig.Sin(from.ang || 0)
    let x = from.x + mulscale(cd, cos, 28), y = from.y + mulscale(cd, sin, 28)
    const z = from.z + zOffset
    if (cd) {
      const hit = engine.hitscan(from.x, from.y, z, from.sectnum, x - from.x, y - from.y, 0, CLIPMASK0)
      if (hit.sect >= 0 && Math.hypot(hit.x - from.x, hit.y - from.y) <= cd << 2) {
        x = hit.x - mulscale(cd << 1, cos, 28)
        y = hit.y - mulscale(cd << 1, sin, 28)
      }
    }
    let sectnum = engine.updatesector(x, y, from.sectnum)
    if (sectnum < 0) { sectnum = from.sectnum; x = from.x; y = from.y }
    const s = level.spawn(sectnum, x, y, z, STAT.thing, {
      picnum: info.picnum, xrepeat: info.xrepeat || 32, yrepeat: info.yrepeat || 32, shade: info.shade, pal: info.pal, clipdist: info.clipdist,
      cstat: 128 | info.cstat, ang: from.ang, owner: from.index, type, flags: info.flags
    })
    s.xvel = mulscale(speed, trig.Cos(from.ang), 30)
    s.yvel = mulscale(speed, trig.Sin(from.ang), 30)
    s.zvel = mulscale(speed, slope, 14)
    s.xvel += Math.trunc((from.xvel || 0) / 2)
    s.yvel += Math.trunc((from.yvel || 0) / 2)
    s.zvel += Math.trunc((from.zvel || 0) / 2)
    this.moving.set(s.index, Object.assign({ owner: from.index, health: info.startHealth << 4 }, o))
    // Blood's actSpawnThing: lit TNT smokes from its fuse (fxDynPuff, at once and every 12 clock ticks) and hisses
    if (type === THING.tntStick || type === THING.tntBundle) {
      this.game.triggers.post(s.index, SPRITE, 0, CMD.callback, () => this.game.fx.dynPuff(s))
      this.game.sound(s, 450)
    }
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

  /**
   * Explosions last their time (explodeInfo's ticks, 120 Hz): every frame of it they hurt and push what is in reach,
   * from the frame after the one that made them (Blood posts the sprite to its explosions at the frame's end)
   */
  explosionsTick () {
    for (const ex of this.explosions.slice()) {
      if (ex.frame === this.game.frame) continue
      if (ex.time > 0) this.blast(ex)
      ex.time -= 4
      if (ex.time <= 0) this.explosions.splice(this.explosions.indexOf(ex), 1)
    }
  }

  tick () {
    for (const [index, m] of [...this.moving]) {
      const s = this.level.sprites[index]
      if (!s || s.statnum !== STAT.thing) { this.moving.delete(index); continue }
      if (m.fuse !== undefined && --m.fuse <= 0) { this.explode(s, EXPLOSION.tnt, this.level.sprites[m.owner]); continue }
      if (!(s.xvel || s.yvel || s.zvel || (s.flags & 4) || (s.flags & 2))) continue
      // Blood's actAirDrag on a moving thing, as on a dude (the thrown TNT slows so in BLOOD000)
      airDrag(this.level, s, 128)
      const hit = this.move(s)
      // Blood's gSpriteHit florhit: whether it lies on the floor (an explosion there is a different sequence)
      m.florhit = this.level.extents(s).bottom >= this.level.engine.getflorzofslope(s.sectnum, s.x, s.y) - 256
      // A gib object, once unlocked, breaks on what it hits (Blood's Impact on it, through kCmdOff)
      if (hit && m.gibObject && this.game.clock >= m.gibObject.unlock) { this.activateGibObject(s, m.gibObject); continue }
      // Blood's Impact: whatever it hits (floor, ceiling, wall, a sprite other than its thrower) sets it off
      if (hit && m.impact && ((hit & 0xc000) !== 0xc000 || (hit & 0x3fff) !== m.owner)) { this.explode(s, EXPLOSION.tnt, this.level.sprites[m.owner]); continue }
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
    // Blood's MoveThing: no clipping at a parallaxed sky (things fly above it, as the gibs in BLOOD000)
    let zr = getZRange(level, s, s.clipdist << 2, 0)
    ;({ top, bottom } = level.extents(s))
    if ((s.flags & 2) && bottom < zr.florz) { s.z += 455; s.zvel += 58254 }
    if (checkLink(level, s)) zr = getZRange(level, s, s.clipdist << 2, 0)
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
    const m = this.moving.get(s.index)
    // On the floor the explosion's sequence is 3, in the air 4; sparks (GIBTYPE_5) or, from a barrel, its staves
    game.missiles.effect({ x, y, z, sectnum }, m && m.florhit ? 3 : 4)
    game.sound({ x, y, z, sectnum, index: -1 }, kind === EXPLOSION.small ? 303 : kind === EXPLOSION.large ? 305 : 304)
    game.fx.gibSprite(s, s.type === THING.tntBarrel ? 14 : 5)
    this.remove(s)
    this.explosions.push({ x, y, z, sectnum, e, owner, time: e.ticks, frame: game.frame })
    if (e.quake) game.shakeNear({ x, y }, e.quake << 4)
  }

  /**
   * One frame of an explosion (Blood's actProcessSprites, its explosions): while its time lasts, each dude and thing
   * within its radius and in sight (CheckProximity) is concussed, hurt by the concussion and set burning; the first
   * dude reached also takes the explosion's fixed damage (dmg + Random(dmgRng), once for the whole explosion)
   */
  blast (ex) {
    const { x, y, z, sectnum, e, owner } = ex
    const game = this.game, level = this.level, engine = level.engine
    const sectors = this.affectedSectors(sectnum, x, y, e.radius << 4)
    const near = (statnum) => level.sprites.filter((d) => d.statnum === statnum && sectors.has(d.sectnum) && this.proximity(d, x, y, z, sectnum, e.radius))
    for (const d of near(STAT.dude)) {
      if (e.dmg && !ex.target) {
        ex.target = 1
        game.combat.damage(owner, d, DAMAGE.fall, (e.dmg + game.random.Random(e.dmgRng)) << 4)
      }
      if (e.force) this.concuss(d, x, y, z, e.force, owner)
      if (e.burnTime) game.burn(d, owner, e.burnTime << 2)
    }
    for (const d of near(STAT.thing)) {
      // (a locked thing is let be: the gibs, their first 180 clock ticks)
      const m = this.moving.get(d.index)
      if (m && m.gibObject && this.game.clock < m.gibObject.unlock) continue
      if (e.force) this.concuss(d, x, y, z, e.force, owner)
      if (e.burnTime) game.burn(d, owner, e.burnTime << 2)
    }
  }

  /** Blood's CheckProximity: within `dist` (>> 4 in x and y, >> 8 in z) and in sight of its middle, top or bottom */
  proximity (d, x, y, z, sectnum, dist) {
    const oX = Math.abs(x - d.x) >> 4, oY = Math.abs(y - d.y) >> 4, oZ = Math.abs(z - d.z) >> 8
    if (oX >= dist || oY >= dist || oZ >= dist || approxDist(oX, oY) >= dist) return false
    const { top, bottom } = this.level.extents(d)
    const engine = this.level.engine
    return engine.cansee(d.x, d.y, d.z, d.sectnum, x, y, z, sectnum) || engine.cansee(d.x, d.y, top, d.sectnum, x, y, z, sectnum) || engine.cansee(d.x, d.y, bottom, d.sectnum, x, y, z, sectnum)
  }

  /** Blood's ConcussSprite: pushed away from the blast by its force, its size and its mass, and hurt by it */
  concuss (d, x, y, z, force, owner = d) {
    const level = this.level
    const dx = d.x - x, dy = d.y - y, dz = (d.z - z) >> 4
    const f = scale(0x40000, force, 0x40000 + dx * dx + dy * dy + dz * dz)
    const mass = d.statnum === STAT.dude ? (this.game.res.tables.dudeInfo[d.type] || {}).mass : this.mass(d)
    if (mass) {
      const t = level.res.tiles[d.picnum] || { w: 0, h: 0 }
      const size = (t.w * d.xrepeat * t.h * d.yrepeat) >> 1
      const k = scale(f, size, mass)
      d.xvel += mulscale(k, dx, 16)
      d.yvel += mulscale(k, dy, 16)
      d.zvel += mulscale(k, dz, 16)
      if (d.statnum === STAT.thing && !this.moving.has(d.index) && this.info[d.type]) this.moving.set(d.index, { health: this.info[d.type].startHealth << 4 })
    }
    this.game.combat.damage(owner, d, DAMAGE.explode, f)
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
