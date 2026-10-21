// Damage in Blood: hitscans (actFireVector, with the original's VECTORDATA from BLOOD.EXE), the knock a hit gives by
// the target's mass, the damage scaled by the target's resistance to each kind (dudeInfo's damage table by skill),
// armour, death; and explosions (radius damage).
import { mulscale, divscale, CLIPMASK1, ksqrt } from '../../common/engine.mjs'
import { approxDist } from './physics.mjs'
import { STAT } from './triggers.mjs'

export const DAMAGE = { fall: 0, burn: 1, bullet: 2, explode: 3, drown: 4, spirit: 5, tesla: 6 }
export const VECTOR = { tine: 0, shell: 1, bullet: 2, tommyAP: 3, shellAP: 4, tommyRegular: 5, batBite: 6, eelBite: 7, gillBite: 8, beastSlash: 9, axe: 10, cleaver: 11, ghost: 12, gargSlash: 13, cerberusHack: 14, houndBite: 15, ratBite: 16, spiderBite: 17, vector18: 18, vector19: 19, tchernobogBurn: 20, voodoo10: 21 }
// Blood's DudeDifficulty: how hard monsters are to hurt, by skill (Still Kicking to Extra Crispy)
const DUDE_DIFFICULTY = [512, 384, 256, 208, 160]

export default class Combat {
  constructor (game) {
    this.game = game
    this.level = game.level
    this.tables = game.res.tables
  }

  /** The damage factors a dude takes, by kind of damage (a monster's by skill; a player's as they are) */
  damageFactor (s, kind) {
    const info = this.tables.dudeInfo[s.type]
    if (!info) return 256
    if (s.type >= 231 && s.type <= 238) return info.startDamage[kind]
    return mulscale(DUDE_DIFFICULTY[this.game.options.difficulty] || 256, info.startDamage[kind], 8)
  }

  /**
   * Blood's actDamageSprite: `damage` (in Blood's units: health is << 4) of a kind to a sprite, from a source sprite.
   * Returns what was done, >> 4
   */
  damage (source, s, kind, damage) {
    const x = this.level.x(s)
    if (!x || s.statnum >= 1024) return 0
    if (s.statnum === STAT.dude) {
      const factor = this.damageFactor(s, kind)
      if (!factor) return 0
      if (factor !== 256) damage = mulscale(damage, factor, 8)
      const player = this.game.playerOf(s)
      if (player) return player.damaged(source, kind, damage) >> 4
      const dude = this.game.dudes && this.game.dudes.of(s)
      if (!dude || x.health <= 0) return 0
      return dude.damaged(source, kind, damage) >> 4
    }
    if (s.statnum === STAT.thing && this.game.things) return this.game.things.damaged(source, s, kind, damage) >> 4
    return damage >> 4
  }

  /** The hitscan's direction from a sprite: the angle and a slope (z per 16384 of x and y), as Blood's dx, dy, dz */
  aim (ang, slope) {
    const trig = this.level.trig
    return { dx: trig.Cos(ang) >> 16, dy: trig.Sin(ang) >> 16, dz: slope }
  }

  /**
   * Blood's actFireVector: a hitscan of a type from a shooter, offset sideways and in z, along (dx, dy, dz); what it
   * hits is damaged and knocked; returns the hit
   */
  fireVector (shooter, offset, zOffset, dx, dy, dz, type) {
    const v = this.tables.vectorData[type]
    const level = this.level, engine = level.engine, trig = level.trig
    const sx = shooter.x + mulscale(offset, trig.Cos((shooter.ang + 512) & 2047), 30)
    const sy = shooter.y + mulscale(offset, trig.Sin((shooter.ang + 512) & 2047), 30)
    const sz = shooter.z + zOffset
    const cstat = shooter.cstat
    shooter.cstat &= ~256
    const hit = engine.hitscan(sx, sy, sz, shooter.sectnum, dx, dy, dz << 4, CLIPMASK1)
    shooter.cstat = cstat
    const range = v.maxDist
    const inRange = !range || approxDist(hit.x - shooter.x, hit.y - shooter.y) < range
    const out = { hit, inRange, type }
    if (!inRange) return out
    if (hit.sprite >= 0) {
      const s = level.sprites[hit.sprite]
      const shift = type === VECTOR.tine && !this.game.playerOf(s) ? 3 : 4
      this.damage(shooter, s, v.dmgType, v.dmg << shift)
      const xs = level.x(s)
      if (xs && xs.vector) this.game.triggers.triggerSprite(hit.sprite, 40 - 9) // kCmdSpriteImpact
      const mass = s.statnum === STAT.dude ? (this.tables.dudeInfo[s.type] || {}).mass : s.statnum === STAT.thing ? (this.game.things ? this.game.things.mass(s) : 0) : 0
      if (mass > 0 && v.impulse) {
        const t = divscale(v.impulse, mass, 8)
        s.xvel += mulscale(dx, t, 16)
        s.yvel += mulscale(dy, t, 16)
        s.zvel += mulscale(dz, t, 16)
      }
      out.blood = s.statnum === STAT.dude
    } else if (hit.wall >= 0) {
      const xw = level.xw(hit.wall)
      if (xw && xw.vector) this.game.triggers.triggerWall(hit.wall, 51) // kCmdWallImpact
    }
    // What the shot hit is shown: a puff, sparks or blood, and its sound (the surface's)
    this.game.effect({ type: out.blood ? 'blood' : 'puff', x: hit.x, y: hit.y, z: hit.z, sectnum: hit.sect })
    return out
  }

  /**
   * Blood's actRadiusDamage: an explosion at a point hurts what can see it, less with distance; burning and
   * knocking things away
   */
  radiusDamage (source, x, y, z, sectnum, radius, baseDamage, distDamage, kind, flags = 0, burn = 0) {
    const level = this.level, engine = level.engine
    const sectors = new Set([sectnum])
    // The sectors within the radius (Blood's GetClosestSpriteSectors, by walls near enough)
    const queue = [sectnum]
    while (queue.length) {
      const sn = queue.shift(), sec = level.sectors[sn]
      for (let w = sec.wallptr; w < sec.wallptr + sec.wallnum; w++) {
        const wall = level.walls[w]
        if (wall.nextsector < 0 || sectors.has(wall.nextsector)) continue
        const w2 = level.walls[wall.point2]
        const d = segmentDistance(x, y, wall.x, wall.y, w2.x, w2.y)
        if (d < radius) { sectors.add(wall.nextsector); queue.push(wall.nextsector) }
      }
    }
    for (const sn of sectors) {
      for (const i of engine.spritesIn(sn).slice()) {
        const s = level.sprites[i]
        if (s.statnum !== STAT.dude && s.statnum !== STAT.thing) continue
        const dx = s.x - x, dy = s.y - y, dz = (s.z - z) >> 4
        const dist = ksqrt(dx * dx + dy * dy + dz * dz)
        if (dist > radius) continue
        if (!engine.cansee(x, y, z, sectnum, s.x, s.y, s.z - 256, s.sectnum)) continue
        const t = radius ? Math.trunc(((radius - dist) << 16) / radius) : 0x10000
        const dmg = baseDamage + mulscale(distDamage, t, 16)
        if (dmg > 0) this.damage(source, s, kind, dmg << 4)
        const mass = s.statnum === STAT.dude ? (this.tables.dudeInfo[s.type] || {}).mass : this.game.things ? this.game.things.mass(s) : 0
        if (mass > 0 && dist > 0) {
          const k = divscale(dmg * 0x400, mass, 0) || 0
          s.xvel += Math.trunc(dx * k / dist)
          s.yvel += Math.trunc(dy * k / dist)
          s.zvel += Math.trunc((dz << 4) * k / dist)
        }
      }
    }
  }
}

function segmentDistance (px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const l = dx * dx + dy * dy
  let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}
