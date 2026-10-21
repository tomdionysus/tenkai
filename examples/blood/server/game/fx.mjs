// Blood's effects (fx.cpp, gib.cpp, callback.cpp): short-lived sprites of the original's gFXData table (BLOOD.EXE),
// each with its sequence, tile, gravity, drag and life, and the callbacks some of them run on reaching the floor;
// the blood spurts and the gibs (GibSprite: a gibList entry's effects and things). Every random draw is where the
// original makes it, in its order (fidelity/randlog.mjs logs the original's), so the two stay in step.
import { mulscale } from '../../common/engine.mjs'
import { STAT, CMD, SPRITE } from './triggers.mjs'
import { airDrag, getZRange } from './physics.mjs'

/** gFXData's effects by what they are (Blood's FX_ numbers) */
export const FX = { puff: 7, bloodChunk: 13, fireSpark: 14, blood: 27, bloodSplat: 36, bloodDrop: 48 }
/** Blood's CALLBACK_IDs that effects use */
export const CALLBACK = { remove: 1, bloodSpurt: 6, dynPuff: 8, bloodBits: 14 }

/** Blood's FindSector: the sector holding a point, its own first, then its neighbours, then any */
export function findSector (level, x, y, z, sectnum) {
  const engine = level.engine
  const fits = (s) => engine.inside(x, y, s) === 1 && z >= engine.getceilzofslope(s, x, y) && z <= engine.getflorzofslope(s, x, y)
  if (sectnum >= 0 && fits(sectnum)) return sectnum
  if (sectnum >= 0) {
    const sec = level.sectors[sectnum]
    for (let w = sec.wallptr; w < sec.wallptr + sec.wallnum; w++) {
      const n = level.walls[w].nextsector
      if (n >= 0 && fits(n)) return n
    }
  }
  for (let s = 0; s < level.sectors.length; s++) if (fits(s)) return s
  return -1
}

export default class Effects {
  constructor (game) {
    this.game = game
    this.level = game.level
    this.data = game.res.tables.fxData
    this.gibs = game.res.tables.gibList
    this.list = [] // the effects' sprites, newest last
  }

  get random () { return this.game.random }

  /** Blood's CFX::fxSpawn: an effect at a place, living `duration` clock ticks (0: its own, or its sequence's) */
  spawn (nFx, sectnum, x, y, z, duration = 0) {
    const level = this.level, game = this.game, R = this.random
    if (sectnum < 0 || nFx < 0 || nFx >= this.data.length) return null
    const sect = findSector(level, x, y, z, sectnum)
    if (sect < 0) return null
    // At most 512: the newest makes way
    if (this.list.length >= 512) this.remove(this.list[this.list.length - 1])
    const d = this.data[nFx]
    const s = level.spawn(sect, x, y, z, STAT.fx, { type: nFx, picnum: d.picnum, cstat: 128 | d.cstat, shade: d.shade, pal: d.pal, clipdist: 32, filler: d.detail, xrepeat: d.xrepeat || 64, yrepeat: d.yrepeat || 64 })
    if ((d.flags & 1) && R.rand() < 0x4000) s.cstat ^= 4
    if ((d.flags & 2) && R.rand() < 0x4000) s.cstat ^= 8
    if (d.seq) game.seqs.spawn(s, d.seq)
    if (!duration) duration = d.duration
    if (duration) game.triggers.post(s.index, SPRITE, duration + R.Random2(duration >> 1), CMD.callback, () => this.remove(s))
    this.list.push(s)
    return s
  }

  /**
   * Blood's CFX::fxFree: the effect's sequence goes now, the effect posted free (actPostSprite): at the frame's end
   * its events are killed and it goes (actPostProcess), after what the frame posted (BLOOD000's queue at tick 324)
   */
  remove (s) {
    if (s.statnum !== STAT.fx || (s.flags & 32)) return
    const i = this.list.indexOf(s)
    if (i >= 0) this.list.splice(i, 1)
    this.game.seqs.kill(s)
    s.flags |= 32
    this.game.postSprite(() => { this.game.triggers.kill(s.index, SPRITE); this.level.remove(s) })
  }

  /** Blood's CFX::fxProcess, each frame: drag, the move, the sector, the floor and ceiling, gravity */
  process () {
    const level = this.level, engine = level.engine
    for (const s of this.list.slice()) {
      if (s.statnum !== STAT.fx) { this.list.splice(this.list.indexOf(s), 1); continue }
      const d = this.data[s.type]
      airDrag(level, s, d.drag)
      if (s.xvel) s.x += s.xvel >> 12
      if (s.yvel) s.y += s.yvel >> 12
      if (s.zvel) s.z += s.zvel >> 8
      let sect = s.sectnum
      if (s.xvel || (s.yvel && s.z >= level.sectors[s.sectnum].floorz)) {
        sect = engine.updatesector(s.x, s.y, sect)
        if (sect < 0) { this.remove(s); continue }
        if (engine.getflorzofslope(s.sectnum, s.x, s.y) <= s.z) { this.floor(s, d); continue }
        if (sect !== s.sectnum) { s.sectnum = sect; level.touched() }
      }
      if (s.xvel || s.yvel || s.zvel) {
        const cz = engine.getceilzofslope(sect, s.x, s.y), fz = engine.getflorzofslope(sect, s.x, s.y)
        if (cz > s.z && !(level.sectors[sect].ceilingstat & 1)) { this.remove(s); continue }
        if (fz < s.z) { this.floor(s, d); continue }
      }
      s.zvel += d.gravity
    }
  }

  /** An effect reaching the floor: its callback, or gone */
  floor (s, d) {
    if (d.callback === CALLBACK.bloodBits) this.bloodBits(s)
    else this.remove(s)
  }

  /** Blood's fxBloodBits: a drop of blood landing, a splash and maybe a stain on the floor */
  bloodBits (s) {
    const level = this.level, trig = level.trig, R = this.random
    const zr = getZRange(level, s, s.clipdist)
    const { bottom } = level.extents(s)
    s.z += zr.florz - bottom
    const a = R.Random(2048)
    const dist = R.Random(16) << 4
    const x = s.x + mulscale(dist, trig.Cos(a), 28), y = s.y + mulscale(dist, trig.Sin(a), 28)
    this.spawn(FX.bloodDrop, s.sectnum, x, y, s.z, 0)
    if (s.ang === 1024) this.game.sound(s, 385)
    if (R.Chance(0x5000)) {
      const f = this.spawn(FX.bloodSplat, s.sectnum, x, y, zr.florz - 64, 0)
      if (f) f.ang = a
    }
    this.remove(s)
  }

  /** Blood's fxSpawnBlood: a spurt of blood from a sprite, spraying drops as it flies (fxBloodSpurt) */
  spawnBlood (s) {
    const R = this.random
    if (s.sectnum < 0 || findSector(this.level, s.x, s.y, s.z, s.sectnum) < 0) return
    const b = this.spawn(FX.blood, s.sectnum, s.x, s.y, s.z, 0)
    if (!b) return
    b.ang = 1024
    b.xvel = R.Random2(0x6aaaa)
    b.yvel = R.Random2(0x6aaaa)
    b.zvel = -R.Random(0x10aaaa) - 100
    this.game.triggers.post(b.index, SPRITE, 8, CMD.callback, () => this.bloodSpurt(b))
  }

  /** Blood's fxBloodSpurt: every 6 clock ticks while the spurt flies, a drop with its speed over 256 */
  /**
   * Blood's fxZombieBloodSpurt: the headless zombie's neck spurts from its top, every 4 clock ticks while data1
   * lasts (4 off it each time), then again after 60 while data2 lasts (data1 back to 40)
   */
  zombieSpurt (s) {
    const level = this.level, R = this.random, x = level.x(s)
    if (!x || s.statnum >= 1024) return
    const { top } = level.extents(s)
    const f = this.spawn(27, s.sectnum, s.x, s.y, top, 0)
    // (v1.11's, BLOOD.EXE 0x740fd: the zombie's own speed, spread in x and y, and up by 0x6aaaa)
    if (f) {
      f.xvel = s.xvel + R.Random2(0x11111)
      f.yvel = s.yvel + R.Random2(0x11111)
      f.zvel = s.zvel - 0x6aaaa
    }
    if (x.data1 > 0) { this.game.triggers.post(s.index, SPRITE, 4, CMD.callback, () => this.zombieSpurt(s)); x.data1 -= 4 }
    else if (x.data2 > 0) { this.game.triggers.post(s.index, SPRITE, 60, CMD.callback, () => this.zombieSpurt(s)); x.data1 = 40; x.data2-- }
  }

  bloodSpurt (s) {
    if (s.statnum !== STAT.fx) return
    const b = this.spawn(FX.blood, s.sectnum, s.x, s.y, s.z, 0)
    if (b) {
      b.ang = 0
      b.xvel = s.xvel >> 8
      b.yvel = s.yvel >> 8
      b.zvel = s.zvel >> 8
    }
    this.game.triggers.post(s.index, SPRITE, 6, CMD.callback, () => this.bloodSpurt(s))
  }

  /** Blood's fxDynPuff on a lit thing (TNT): a puff of smoke from its fuse every 12 clock ticks while it falls */
  dynPuff (s) {
    if (s.statnum >= 1024) return
    const level = this.level, trig = level.trig
    if (s.zvel) {
      const t = level.res.tiles[s.picnum] || { w: 0 }
      const dist = (s.xrepeat * (t.w >> 1)) >> 2
      const x = s.x + mulscale(dist, trig.Cos((s.ang - 512) & 2047), 30), y = s.y + mulscale(dist, trig.Sin((s.ang - 512) & 2047), 30)
      const f = this.spawn(FX.puff, s.sectnum, x, y, s.z, 0)
      if (f) { f.xvel = s.xvel; f.yvel = s.yvel; f.zvel = s.zvel }
    }
    this.game.triggers.post(s.index, SPRITE, 12, CMD.callback, () => this.dynPuff(s))
  }

  /** Blood's GibSprite: a gibList entry's effects, then its things, from a sprite */
  gibSprite (s, nGib, pos = null, vel = null) {
    const g = this.gibs[nGib]
    if (!g || s.sectnum < 0) return
    if (g.sound) this.game.sound(s, g.sound)
    for (const f of g.fx) this.gibFx(s, f, pos, vel)
    for (const t of g.things) this.game.things.gibThing(s, t, pos, vel)
  }

  /** Blood's ChanceToCount: of `count`, those that pass a chance each (a draw each unless certain) */
  chanceToCount (chance, count) {
    let n = count
    if (chance < 0x10000) for (let i = 0; i < count; i++) if (!this.random.Chance(chance)) n--
    return n
  }

  /** Blood's GibFX: some of an effect, from random places on a sprite's edge (or a given place), flying at random */
  gibFx (s, g, pos, vel) {
    const level = this.level, engine = level.engine, trig = level.trig, R = this.random
    const sect = s.sectnum
    const p = pos ? Object.assign({}, pos) : { x: s.x, y: s.y, z: s.z }
    const cz = engine.getceilzofslope(sect, p.x, p.y), fz = engine.getflorzofslope(sect, p.x, p.y)
    const n = this.chanceToCount(g.chance, g.count)
    const dz1 = fz - p.z, dz2 = p.z - cz
    const { top, bottom } = level.extents(s)
    for (let i = 0; i < n; i++) {
      if (!pos && (s.cstat & 48) === 0) {
        const a = R.Random(2048)
        p.x = s.x + mulscale(s.clipdist << 2, trig.Cos(a), 30)
        p.y = s.y + mulscale(s.clipdist << 2, trig.Sin(a), 30)
        p.z = bottom - R.Random(bottom - top)
      }
      const f = this.spawn(g.fx, sect, p.x, p.y, p.z, 0)
      if (!f) continue
      if (g.pal < 0) f.pal = s.pal
      if (vel) {
        f.xvel = vel.x + R.Random2(g.across)
        f.yvel = vel.y + R.Random2(g.across)
        f.zvel = vel.z - R.Random(g.up)
      } else {
        f.xvel = R.Random2(Math.trunc((g.across << 18) / 120))
        f.yvel = R.Random2(Math.trunc((g.across << 18) / 120))
        const up = Math.trunc((g.up << 18) / 120)
        if ((s.cstat & 48) === 16) f.zvel = R.Random2(up)
        else if (dz2 < dz1 && dz2 < 0x4000) f.zvel = 0
        else if (dz2 > dz1 && dz1 < 0x4000) f.zvel = -R.Random(Math.trunc((Math.abs(g.up) << 18) / 120))
        else if (up < 0) f.zvel = -R.Random(Math.trunc((Math.abs(g.up) << 18) / 120))
        else f.zvel = R.Random2(up)
      }
    }
  }
}
