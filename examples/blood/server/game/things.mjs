// Things (Blood's kStatThing: barrels, thrown TNT, drips, heads, the dead) moving by Blood's MoveThing with the
// original's thingInfo (BLOOD.EXE: mass, clipdist, how they bounce, what hurts them), and explosions by its
// explodeInfo (damage falling off with distance, the concussion's push by size and mass).
import { mulscale, divscale, ksqrt, scale, CLIPMASK0 } from '../../common/engine.mjs'
import { approxDist, wallBounce, getZRange, checkLink, airDrag, floorBounce } from './physics.mjs'
import { STAT, CMD, SPRITE } from './triggers.mjs'
import { DAMAGE } from './combat.mjs'

// Blood's explosion kinds (explodeInfo's order): the thrown bundle's is the standard (1: the original's explosion
// sprite has type 1), a barrel's the large (2)
export const EXPLOSION = { small: 0, standard: 1, large: 2, fireball: 3, napalm: 5, spray: 6, tnt: 1 }
export const THING = { objectGib: 416, objectExplode: 417, tntBarrel: 400, proxBomb: 401, remoteBomb: 402, tntStick: 418, tntBundle: 419, sprayBundle: 420, dripWater: 423, dripBlood: 424, bloodBits: 425, bloodChunks: 426, zombieHead: 427 }

export default class Things {
  constructor (game) {
    this.game = game
    this.level = game.level
    this.info = game.res.tables.thingInfo
    this.explodeInfo = game.res.tables.explodeInfo
    this.moving = new Map() // sprite index -> { fuse, owner, onHit }
    this.explosions = [] // { x, y, z, sectnum, e, owner, time }
    this.bodies = new Map()
    // Blood's actInit for the map's things: their type's size and physics (a breakable's clipdist is 0: its pieces
    // come from where it is)
    for (const s of this.level.sprites) {
      if (s.statnum !== STAT.thing || !this.info[s.type]) continue
      s.clipdist = this.info[s.type].clipdist
      s.flags = this.info[s.type].flags
      s.xvel = s.yvel = s.zvel = 0
      // (and its state on, but for the proximity bomb and the machine gun: told off, it breaks or goes off)
      const x = this.level.x(s)
      if (x && s.type !== 401 && s.type !== 454) { x.state = 1; x.busy = 65536 }
    }
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
      ? { data1: g.type === THING.bloodBits ? 19 : 8, data2: 0, data3: 0, data4: g.type === THING.zombieHead ? 318 : 319, unlock: this.game.clock + 180 } : null
    this.moving.set(gib.index, { health: info.startHealth << 4, gibObject })
  }

  /**
   * Blood's actActivateGibObject: a gib object broken: its gib types (data1 and data2, data3 if it burns, each one
   * more than the type), its sound (data4), what it drops; gone unless it is unseen (a map's may go off again)
   */
  activateGibObject (s, o) {
    const g1 = Math.max(0, Math.min(31, o.data1 || 0)), g2 = Math.max(0, Math.min(31, o.data2 || 0)), g3 = Math.max(0, Math.min(31, o.data3 || 0))
    if (g1 > 0) this.game.fx.gibSprite(s, g1 - 1)
    if (g2 > 0) this.game.fx.gibSprite(s, g2 - 1)
    if (g3 > 0 && o.burnTime > 0) this.game.fx.gibSprite(s, g3 - 1)
    if (o.data4 > 0) this.game.sound(s, o.data4)
    if (o.dropMsg > 0) this.game.drop(s, o.dropMsg)
    if (!(s.cstat & 32768)) this.remove(s)
  }

  /** A dead dude's body (Blood's kThingBloodChunks, moved by its thingInfo; it does not die again) */
  body (s) {
    const m = { health: 1 << 30, body: true }
    if (s.deathGib) Object.assign(m, s.deathGib)
    this.moving.set(s.index, m)
  }

  /** Blood's DudeToGibCallback1/2: a body made a gib object (gib type data1, sound 319, unlocked), its health 30 */
  bodyToGib (s, data1) {
    const g = { body: false, health: (this.info[THING.bloodChunks] || { startHealth: 30 }).startHealth, gibObject: { data1, data2: 0, data3: 0, data4: 319, unlock: this.game.clock } }
    const m = this.moving.get(s.index)
    if (m && s.type === THING.bloodChunks) Object.assign(m, g)
    else s.deathGib = g
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
  /** A thing set moving from outside (kicked, pushed): the thing loop takes it from now on */
  wake (s) {
    if (s.statnum === STAT.thing && !this.moving.has(s.index) && this.info[s.type]) this.moving.set(s.index, { health: this.info[s.type].startHealth << 4 })
  }

  damaged (source, s, kind, damage) {
    const info = this.info[s.type]
    if (!info) return 0
    // Blood's actDamageSprite: nothing done to what is already at nothing (a body), nor to what is locked (new gibs)
    const m0 = this.moving.get(s.index)
    if (m0 && (m0.body || (m0.gibObject && this.game.clock < m0.gibObject.unlock) || m0.done)) return 0
    const x0 = this.level.x(s)
    if (x0 && x0.locked) return 0
    const factor = info.dmgControl[kind] ?? 256
    if (!factor) return 0
    damage = mulscale(damage, factor, 8)
    const m = this.moving.get(s.index) || { health: info.startHealth << 4 }
    m.health = (m.health ?? info.startHealth << 4) - damage
    this.moving.set(s.index, m)
    if (m.health <= 0 && (s.type === THING.tntBarrel || s.type === THING.tntBundle || s.type === THING.tntStick || s.type === THING.proxBomb || s.type === THING.remoteBomb)) this.explode(s, this.kindOf(s), source)
    else if (m.health <= 0 && !m.done && !m.body) {
      // Blood's actDamageSprite: at nothing a thing is told off (trTriggerSprite): a breakable breaks; a player who
      // blew it up may remark on it
      m.done = true
      // (a gib thrown loose has its gib data, not the map's: Blood's OperateSprite breaks it from its xsprite)
      if (m.gibObject) this.activateGibObject(s, m.gibObject)
      else this.game.triggers.triggerSprite(s.index, CMD.off)
      // then the remark (after the break, BLOOD.EXE 0x2cbe2: its draws follow the gibs')
      const p = source && this.game.playerOf(source)
      if (kind === DAMAGE.explode && p && (s.type === 416 || s.type === 417 || (s.type >= 425 && s.type <= 427)) && this.game.clock > (p.remarkAt || 0) && this.game.random.Chance(0x4000)) {
        this.game.random.Random(10)
        p.remarkAt = this.game.clock + 3600
      }
    }
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
      if (m.fuse !== undefined && --m.fuse <= 0) { this.explode(s, this.kindOf(s), this.level.sprites[m.owner]); continue }
      // Blood's thing loop (BLOOD.EXE 0x32b30): on a panning floor a thing takes its type's move and fall flags; one
      // with neither is never moved, pushed or not (the map's gib objects, 466 in BLOOD000 at tick 1123)
      const xs = this.level.xs(s.sectnum)
      if (xs && xs.panVel && (xs.panAlways || xs.state || xs.busy)) {
        const info = this.info[s.type]
        if (info && (info.flags & 1)) s.flags |= 1
        if (info && (info.flags & 2)) s.flags |= 4
      }
      if (!(s.flags & 3)) continue
      if (!(s.xvel || s.yvel || s.zvel || (s.flags & 4) || (s.flags & 2))) continue
      // Blood's actAirDrag on a moving thing, as on a dude (the thrown TNT slows so in BLOOD000)
      airDrag(this.level, s, 128)
      const hit = this.move(s)
      // (gone in its move: a gib broken by its landing)
      if (s.statnum !== STAT.thing) continue
      // Blood's gSpriteHit florhit: whether it lies on the floor (an explosion there is a different sequence)
      m.florhit = this.level.extents(s).bottom >= this.level.engine.getflorzofslope(s.sectnum, s.x, s.y) - 256
      // (a gib object breaks when its health is gone: a hard landing's damage, once it is unlocked; gib 892 in
      // BLOOD000 lands at tick 703 with 7 of 240 taken and stays whole)
      // Blood's Impact: whatever it hits (floor, ceiling, wall, a sprite other than its thrower) sets it off
      if (hit && m.impact && ((hit & 0xc000) !== 0xc000 || (hit & 0x3fff) !== m.owner)) { this.explode(s, this.kindOf(s), this.level.sprites[m.owner]); continue }
      // Blood's MakeSplash: a drip that hits anything splashes where it is (its own sprite plays the splash)
      if (hit && (s.type === THING.dripWater || s.type === THING.dripBlood) && !m.splashed) this.makeSplash(s, m)
    }
  }

  /** Blood's MakeSplash: no more falling, up 4 << 8, and the splash by the surface below (water's own) and its sound */
  makeSplash (s, m) {
    m.splashed = true
    s.flags &= ~2
    s.z -= 4 << 8
    const level = this.level, h = m.floorHit || 0, surfType = this.game.res.surfType
    const pic = (h & 0xc000) === 0x4000 ? level.sectors[h & 0x3fff].floorpicnum : (h & 0xc000) === 0xc000 && level.sprites[h & 0x3fff] ? level.sprites[h & 0x3fff].picnum : -1
    const surf = pic >= 0 && surfType ? surfType[pic] : 0
    let seq = 7, sound = 354
    if (s.type === THING.dripBlood) seq = 8
    else if (surf === 5) { seq = 6; sound = 356 }
    this.game.missiles.play(s, seq)
    this.game.sound(s, sound)
  }

  /** Blood's MoveThing; returns what it hit (a sector's floor 0x4000, a wall 0x8000, a sprite 0xc000) */
  move (s) {
    const level = this.level, engine = level.engine, info = this.info[s.type] || this.bodies.get(s.index) || { elastic: 0, dmgResist: 0 }
    const m0 = this.moving.get(s.index) || {}
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
    }
    if (s.zvel) s.z += s.zvel >> 8
    // Blood's MoveThing: no clipping at a parallaxed sky (things fly above it, as the gibs in BLOOD000)
    let zr = getZRange(level, s, s.clipdist << 2, 0)
    ;({ top, bottom } = level.extents(s))
    if ((s.flags & 2) && bottom < zr.florz) {
      s.z += 455
      s.zvel += 58254
      // A falling zombie's head bleeds a trail (BLOOD.EXE 0x2f0a8): effect 27 with its speed, and 0x44444 turned
      // by angles of the clock (Blood's RotateVector, rounded)
      if (s.type === THING.zombieHead) {
        const f = this.game.fx.spawn(27, s.sectnum, s.x, s.y, s.z, 0)
        if (f) {
          const c = this.game.clock, trig = level.trig
          const rot = (a, b, ang) => {
            const cs = trig.Cos(ang & 2047), sn = trig.Sin(ang & 2047)
            return [Math.floor((a * cs - b * sn + 2 ** 29) / 2 ** 30), Math.floor((a * sn + b * cs + 2 ** 29) / 2 ** 30)]
          }
          let v2c = 0x44444, v28 = 0, v24 = 0
          ;[v2c, v28] = rot(v2c, v28, (c * 11) & 2047)
          ;[v2c, v24] = rot(v2c, v24, (c * 5) & 2047)
          ;[v28, v24] = rot(v28, v24, (c * 3) & 2047)
          f.xvel = s.xvel + v2c
          f.yvel = s.yvel + v28
          f.zvel = s.zvel + v24
        }
      }
    }
    if (checkLink(level, s)) zr = getZRange(level, s, s.clipdist << 2, 0)
    ;({ top, bottom } = level.extents(s))
    m0.floorHit = bottom >= zr.florz ? zr.florhit : 0
    if (bottom >= zr.florz) {
      s.z += zr.florz - bottom
      const v = s.zvel - level.velFloor[s.sectnum]
      if (v > 0) {
        s.flags |= 4
        // Blood's actFloorBounceVector: back up by what the bounce keeps (along a slope's normal on a slope)
        const vel = { x: s.xvel, y: s.yvel, z: v }
        const t2 = floorBounce(level, vel, s.sectnum, info.elastic)
        s.xvel = vel.x; s.yvel = vel.y
        const damage = mulscale(t2, t2, 30) - info.dmgResist
        if (damage > 0) this.damaged(s, s, DAMAGE.fall, damage)
        s.zvel = vel.z
        if (!level.velFloor[s.sectnum] && Math.abs(s.zvel) < 0x10000) { s.zvel = 0; s.flags &= ~4 }
        // (the floor is what it hit, over a wall in the same move: Blood's MoveThing sets it last)
        hit = 0x4000 | s.sectnum
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

  /** Blood's evPost of kCmdOn to a lit thing, `delay` clocks on: it goes off then (OperateSprite on TNT) */
  fuseEvent (s, delay) {
    const m = this.moving.get(s.index)
    this.game.triggers.post(s.index, SPRITE, delay, CMD.on, () => {
      if (s.statnum === STAT.thing && this.level.sprites[s.index] === s) this.explode(s, this.kindOf(s), this.level.sprites[m ? m.owner : -1])
    })
  }

  /** Blood's actExplodeSprite's kind by the thing: a TNT stick's small, a barrel's large, the rest standard */
  kindOf (s) {
    if (s.type === THING.tntStick) return EXPLOSION.small
    if (s.type === THING.tntBarrel) return EXPLOSION.large
    return EXPLOSION.standard
  }

  /**
   * Blood's actExplodeSprite and its explosion: radius damage (falling off from dmg + dmgRng to dmg at the edge),
   * the concussion's push, the explosion's sequence, its sound and the shake
   */
  explode (s, kind, source, o = {}) {
    const e = this.explodeInfo[kind] || this.explodeInfo[EXPLOSION.large]
    const game = this.game
    const owner = source || s
    const x = s.x, y = s.y, z = s.z, sectnum = s.sectnum
    const m = this.moving.get(s.index)
    // Blood's actExplodeSprite: its events go first (evKill: a lit bundle's smoke, BLOOD000 at tick 300)
    game.triggers.kill(s.index, SPRITE)
    // On the floor the explosion's sequence is 3, in the air 4; sparks (GIBTYPE_5) or, from a barrel, its staves.
    // The sprite that blew up is the explosion (Blood's: it goes to the explosions, at the explosion's size, and
    // plays its sequence to its end): no new sprite
    // (in Blood's order, BLOOD.EXE 0x31933: the sequence first, so the sparks rise from its first frame's tile, then
    // the sound and the sparks; then still, an explosion, at its size)
    this.moving.delete(s.index)
    game.seqs.kill(s)
    game.missiles.play(s, o.seq || (m && m.florhit ? 3 : 4))
    game.sound({ x, y, z, sectnum, index: -1 }, o.sound || (kind === EXPLOSION.small ? 303 : kind === EXPLOSION.large ? 305 : 304))
    if (o.gib !== false) game.fx.gibSprite(s, s.type === THING.tntBarrel ? 14 : 5)
    s.xvel = s.yvel = s.zvel = 0
    s.statnum = STAT.explosion
    s.xrepeat = s.yrepeat = e.repeat || 64
    s.flags &= ~3
    this.level.touched()
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
    const sectors = this.affectedSectors(sectnum, x, y, e.radius)
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
      // (a locked thing is let be: its xsprite's locked bit, BLOOD.EXE 0x33c0d, as the map sets it, and the gibs
      // their first 180 clock ticks)
      const xd = level.x(d)
      if (xd && xd.locked) continue
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
    // (only what can move is pushed: Blood's kPhysMove; the map's breakables stand)
    if (mass && (d.flags & 1)) {
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

  /**
   * Blood's GetClosestSpriteSectors (BLOOD.EXE 0x23b90): from the blast's sector out through its openings, a sector
   * reached when CheckProximityWall passes. As the original, it tests the wall after the opening (its point2) and a
   * sector looked at once is not looked at again, reached or not
   */
  affectedSectors (sectnum, x, y, radius) {
    const level = this.level, looked = new Set([sectnum]), reached = new Set([sectnum]), list = [sectnum]
    for (let i = 0; i < list.length; i++) {
      const sec = level.sectors[list[i]]
      for (let w = sec.wallptr; w < sec.wallptr + sec.wallnum; w++) {
        const next = level.walls[w].nextsector
        if (next < 0 || looked.has(next)) continue
        looked.add(next)
        if (this.proximityWall(level.walls[w].point2, x, y, radius)) { reached.add(next); list.push(next) }
      }
    }
    return reached
  }

  /** Blood's CheckProximityWall (BLOOD.EXE 0x21ba4): within `dist` << 4 of the wall, in 32-bit products */
  proximityWall (nWall, x, y, dist) {
    const walls = this.level.walls, w1 = walls[nWall], w2 = walls[w1.point2]
    const x1 = w1.x, y1 = w1.y, x2 = w2.x, y2 = w2.y, d = dist << 4, dd = Math.imul(d, d)
    const sq = (a, b) => (Math.imul(a, a) + Math.imul(b, b)) | 0
    const dist1 = sq(x - x1, y - y1), dist2 = sq(x - x2, y - y2)
    if (x1 < x2) {
      if (x <= x1 - d || x >= x2 + d) return false
    } else {
      if (x <= x2 - d || x >= x1 + d) return false
      if (x1 === x2) {
        if (y1 < y2) {
          if (y <= y1 - d || y >= y2 + d) return false
          if (y < y1) return dist1 < dd
          if (y > y2) return dist2 < dd
        } else {
          if (y <= y2 - d || y >= y1 + d) return false
          if (y < y2) return dist2 < dd
          if (y > y1) return dist1 < dd
        }
        return true
      }
    }
    if (y1 < y2) {
      if (y <= y1 - d || y >= y2 + d) return false
    } else {
      if (y <= y2 - d || y >= y1 + d) return false
      if (y1 === y2) {
        if (x1 < x2) {
          if (x < x1) return dist1 < dd
          if (x > x2) return dist2 < dd
        } else {
          if (x < x2) return dist2 < dd
          if (x > x1) return dist1 < dd
        }
      }
    }
    const dx = x2 - x1, dy = y2 - y1
    if (((Math.imul(x - x2, dx) + Math.imul(dy, y - y2)) | 0) >= 0) return dist2 < dd
    const px = x - x1, py = y - y1
    if (((Math.imul(px, dx) + Math.imul(dy, py)) | 0) <= 0) return dist1 < dd
    const c = (Math.imul(px, dy) - Math.imul(dx, py)) | 0
    return Math.imul(c, c) < Math.imul(sq(dx, dy), dd)
  }

  remove (s) {
    this.moving.delete(s.index)
    this.game.seqs.kill(s)
    this.level.remove(s)
  }
}
