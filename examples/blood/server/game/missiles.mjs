// Projectiles and thrown things (Blood's actFireMissile, actProcessMissiles, the thrown TNT), and the short-lived
// effects a hit leaves (puffs, blood, explosions), each a sprite with its sequence (the original's SEQs) so every
// client sees the same. Speeds and tiles from the original's missileInfo (BLOOD.EXE, types 300-317).
import { mulscale, CLIPMASK0, CLIPMASK1 } from '../../common/engine.mjs'
import { STAT } from './triggers.mjs'
import { DAMAGE } from './combat.mjs'

export const MISSILE = { knife: 300, flare: 301, teslaAlt: 302, flareAlt: 303, spray: 304, fireball: 305, tesla: 306, ectoSkull: 307, houndFlame: 308, puke: 309, gargoyleArc: 311, napalm: 312, cerberus: 313, tchernobog: 314, leech: 315 }
const KINDS = { flare: MISSILE.flare, napalm: MISSILE.napalm, spray: MISSILE.spray, fireball: MISSILE.fireball, houndFlame: MISSILE.houndFlame }
export const FX_SEQ = { explosion: 3, explosionBig: 4, fireExplosion: 5, puff: 44, spark: 45, blood: 59, splash: 6 }

export default class Missiles {
  constructor (game) {
    this.game = game
    this.level = game.level
    this.info = game.res.tables.missileInfo
    this.list = []
    this.fx = []
  }

  /** Blood's actFireMissile: a missile from a shooter along its facing and a slope */
  fire (shooter, kind, ang, slope, zOffset = 0) {
    const type = KINDS[kind] || MISSILE.flare
    const info = this.info[type - 300]
    const level = this.level, trig = level.trig
    const s = level.spawn(shooter.sectnum, shooter.x, shooter.y, shooter.z + zOffset, STAT.projectile, {
      picnum: info.picnum > 0 ? info.picnum : 3281, xrepeat: info.xrepeat || 32, yrepeat: info.yrepeat || 32, shade: info.shade, clipdist: info.clipdist,
      ang, owner: shooter.index, type, cstat: 128
    })
    const dx = trig.Cos(ang) >> 16, dy = trig.Sin(ang) >> 16
    s.xvel = mulscale(info.velocity, dx, 14)
    s.yvel = mulscale(info.velocity, dy, 14)
    s.zvel = mulscale(info.velocity, slope, 14)
    // Fire is a looping fireball; the spray's flame dies out soon
    if (type === MISSILE.napalm || type === MISSILE.fireball || type === MISSILE.spray || type === MISSILE.houndFlame) this.game.seqs.spawn(s, 22)
    const m = { sprite: s, type, life: type === MISSILE.spray ? 12 : 240 }
    this.list.push(m)
    return m
  }

  /**
   * A bundle of TNT thrown (Blood's thing 419): it flies at `speed` (the original's first throw goes about 152 units a
   * tick), falls and bounces as Blood's things do, and goes off when it meets a monster or its fuse is out
   */
  throwTNT (thrower, speed, slope, zOffset) {
    this.game.things.fire(thrower, 419, zOffset, slope, speed || 0x98000, { fuse: 75, impact: true })
  }

  /** A drip of water or blood from a generator (Blood's things 423 and 424): it falls, and splashes on the floor */
  drip (from, z, blood) {
    const s = this.game.things.fire({ sectnum: from.sectnum, x: from.x, y: from.y, z, ang: 0, index: from.index }, blood ? 424 : 423, 0, 0, 0)
    s.xrepeat = s.yrepeat = 24
  }

  tick () {
    for (const m of this.list.slice()) {
      const s = m.sprite
      if (s.statnum >= 1024) { this.list.splice(this.list.indexOf(m), 1); continue }
      if (--m.life <= 0) { this.explode(m); continue }
      if (m.type === 'tnt') { this.fall(m); continue }
      if (m.type === 'drip') {
        const s2 = m.sprite
        s2.zvel += 58254
        s2.z += s2.zvel >> 8
        const fz = this.level.engine.getflorzofslope(s2.sectnum, s2.x, s2.y)
        if (s2.z >= fz) { s2.z = fz; this.effect(s2, FX_SEQ.splash); this.remove(m) }
        continue
      }
      this.fly(m)
    }
    for (const f of this.fx.slice()) if (--f.life <= 0) { this.level.remove(f.sprite); this.fx.splice(this.fx.indexOf(f), 1) }
  }

  fly (m) {
    const s = m.sprite, level = this.level, engine = level.engine
    const vx = s.xvel >> 12, vy = s.yvel >> 12, vz = s.zvel >> 8
    const owner = level.sprites[s.owner]
    const ocstat = owner ? owner.cstat : 0
    if (owner) owner.cstat &= ~257
    const hit = engine.hitscan(s.x, s.y, s.z, s.sectnum, vx || 1, vy, vz, CLIPMASK1)
    if (owner) owner.cstat = ocstat
    const step = Math.hypot(vx, vy, vz / 16), hd = Math.hypot(hit.x - s.x, hit.y - s.y, (hit.z - s.z) / 16)
    if (hit.sect >= 0 && hd <= step + (s.clipdist << 2)) { s.x = hit.x; s.y = hit.y; s.z = hit.z; this.impact(m, hit); return }
    s.x += vx; s.y += vy; s.z += vz
    const n = engine.updatesectorz(s.x, s.y, s.z, s.sectnum)
    if (n < 0) { this.remove(m); return }
    if (n !== s.sectnum) { s.sectnum = n; level.touched() }
  }

  fall (m) {
    const s = m.sprite, level = this.level, engine = level.engine
    const pos = { x: s.x, y: s.y, z: s.z, sectnum: s.sectnum }
    const hit = engine.clipmove(pos, (s.xvel >> 12) * 16384, (s.yvel >> 12) * 16384, 64, 256, 256, CLIPMASK0)
    if (pos.sectnum >= 0) { s.x = pos.x; s.y = pos.y; if (pos.sectnum !== s.sectnum) { s.sectnum = pos.sectnum; level.touched() } }
    if (hit) { s.xvel = -s.xvel >> 1; s.yvel = -s.yvel >> 1 }
    s.zvel += 58254
    s.z += s.zvel >> 8
    const fz = engine.getflorzofslope(s.sectnum, s.x, s.y), cz = engine.getceilzofslope(s.sectnum, s.x, s.y)
    if (s.z >= fz) { s.z = fz; s.zvel = -(s.zvel >> 2); s.xvel = mulscale(s.xvel, 0xa000, 16); s.yvel = mulscale(s.yvel, 0xa000, 16) }
    if (s.z <= cz) { s.z = cz; s.zvel = Math.abs(s.zvel) >> 1 }
  }

  impact (m, hit) {
    const s = m.sprite, game = this.game, level = this.level
    const owner = level.sprites[s.owner]
    const target = hit.sprite >= 0 ? level.sprites[hit.sprite] : null
    switch (m.type) {
      case MISSILE.flare:
        if (target) {
          game.combat.damage(owner, target, DAMAGE.bullet, 17 << 4)
          game.burn(target, owner, 6 * 30)
        }
        this.effect(s, FX_SEQ.spark)
        break
      case MISSILE.spray: case MISSILE.houndFlame:
        if (target) game.burn(target, owner, 3 * 30)
        break
      case MISSILE.napalm: case MISSILE.fireball:
        this.explode(m)
        return
    }
    this.remove(m)
  }

  /** An explosion where a missile or TNT is (Blood's explosions: radius damage, fire, the sequence) */
  explode (m) {
    const s = m.sprite, game = this.game
    const owner = this.level.sprites[s.owner] || s
    if (m.type === 'tnt' || m.type === MISSILE.napalm || m.type === MISSILE.fireball) {
      game.combat.radiusDamage(owner, s.x, s.y, s.z, s.sectnum, m.type === 'tnt' ? 0x400 : 0x300, m.type === 'tnt' ? 40 : 30, m.type === 'tnt' ? 120 : 60, DAMAGE.explode)
      this.effect(s, m.type === 'tnt' ? FX_SEQ.explosion : FX_SEQ.fireExplosion)
      game.sound(s, m.type === 'tnt' ? 304 : 306)
      game.shakeNear(s, 0x400)
    }
    this.remove(m)
  }

  remove (m) {
    this.game.seqs.kill(m.sprite)
    this.level.remove(m.sprite)
    this.list.splice(this.list.indexOf(m), 1)
  }

  /** A short-lived effect where a sprite is (a puff, blood, an explosion), as a sprite with its sequence */
  effect (at, seq, z = at.z) {
    const level = this.level
    if (at.sectnum < 0) return
    const s = level.spawn(at.sectnum, at.x, at.y, z, STAT.fx, { picnum: 0, xrepeat: seq === FX_SEQ.puff ? 32 : 64, yrepeat: seq === FX_SEQ.puff ? 32 : 64, cstat: 128 })
    const inst = this.game.seqs.spawn(s, seq)
    const life = inst ? Math.ceil(inst.seq.frames.length * inst.seq.ticksPerFrame / 4) + 1 : 10
    this.fx.push({ sprite: s, life })
  }
}
