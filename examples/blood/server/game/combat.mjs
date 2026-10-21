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
    if (s.statnum >= 1024) return 0
    const x = this.level.x(s)
    // Players' bodies are made by the game, with no extra from the map
    if (!x && !this.game.playerOf(s)) return 0
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
   * Blood's HitScan's answer, from the engine's hit: 3 a sprite, 0 a solid wall (or a wall to another sector hit
   * above or below its opening), 4 such a wall within its opening (a masked wall), 1 a ceiling, 2 a floor, -1
   * nothing
   */
  hitType (hit, z) {
    const level = this.level, engine = level.engine
    if (hit.sprite >= 0) return 3
    if (hit.wall >= 0) {
      const w = level.walls[hit.wall]
      if (w.nextsector < 0) return 0
      const cz = engine.getceilzofslope(w.nextsector, hit.x, hit.y), fz = engine.getflorzofslope(w.nextsector, hit.x, hit.y)
      return hit.z > cz && hit.z < fz ? 4 : 0
    }
    if (hit.sect >= 0) return z < hit.z ? 2 : 1
    return -1
  }

  /**
   * Blood's VectorScan (BLOOD.EXE 0x2231c): a hitscan from the shooter (offset sideways and in z), the shooter let
   * through, that goes on through what it should not stop at: a face sprite where its tile's pixel is see-through,
   * a masked wall the same, a floor or ceiling with a link to the sector beyond (up to 256 times). Returns { kind,
   * hit }: kind 3 a sprite, 0 a wall, 4 a masked wall, 1 a ceiling, 2 a floor (or a sky past a wall), -1 nothing
   * (or past `range`)
   */
  vectorScan (s, offset, zOffset, dx, dy, dz, range, ac) {
    const level = this.level, engine = level.engine, trig = level.trig, tiles = this.game.res.tiles
    let x1 = s.x + mulscale(offset, trig.Cos((s.ang + 512) & 2047), 30)
    let y1 = s.y + mulscale(offset, trig.Sin((s.ang + 512) & 2047), 30)
    let z1 = s.z + zOffset
    const through = (obj, mask, sectnum, extra) => {
      const c = obj.cstat
      obj.cstat &= ~mask
      const c2 = extra ? extra.cstat : 0
      if (extra) extra.cstat &= ~mask
      const h = engine.hitscan(x1, y1, z1, sectnum, dx, dy, dz << 4, CLIPMASK1, goal)
      obj.cstat = c
      if (extra) extra.cstat = c2
      return h
    }
    // (Build's hitscan goal from Blood's range: range << 4 along the shooter's facing)
    const goal = range ? { x: x1 + mulscale(range << 4, trig.Cos(s.ang & 2047), 30), y: y1 + mulscale(range << 4, trig.Sin(s.ang & 2047), 30) } : null
    let hit = through(s, 256, s.sectnum)
    const pow2 = (n) => { let j = 15; while (j > 1 && (1 << j) > n) j--; return (1 << j) === n ? j : -1 }
    for (let n = 255; n >= 0; n--) {
      if (range && approxDist(hit.x - s.x, hit.y - s.y) > range) return { kind: -1, hit }
      if (hit.sprite >= 0) {
        const o = level.sprites[hit.sprite]
        if ((o.flags & 8) && !(ac & 1)) return { kind: 3, hit }
        if (o.cstat & 0x30) return { kind: 3, hit }
        const t = tiles[o.picnum]
        if (!t || !t.w || !t.h) return { kind: 3, hit }
        const height = (t.h * o.yrepeat) << 2
        let oz = o.z
        if (o.cstat & 0x80) oz += Math.trunc(height / 2)
        if (t.yo) oz -= (t.yo * o.yrepeat) << 2
        let h2 = Math.trunc((oz - hit.z) * t.h / height)
        if (!(o.cstat & 8)) h2 = t.h - h2
        if (h2 >= 0 && h2 < t.h) {
          const width = Math.trunc((((t.w * o.xrepeat) >> 2) * 3) / 4)
          const check1 = Math.trunc(((Math.imul(y1 - o.y, dx) - Math.imul(x1 - o.x, dy)) | 0) / ksqrt((dx * dx + dy * dy) | 0))
          const w2 = Math.trunc(check1 * t.w / width) + t.xo + Math.trunc(t.w / 2)
          if (w2 >= 0 && w2 < t.w && t.pixels && t.pixels[w2 * t.h + h2] !== 255) return { kind: 3, hit }
        }
        // a see-through pixel: on from where it hit, in that sprite's sector
        x1 = hit.x; y1 = hit.y; z1 = hit.z
        hit = through(o, 256, o.sectnum)
        continue
      }
      if (hit.wall >= 0) {
        const w = level.walls[hit.wall]
        if (w.nextsector < 0) return { kind: 0, hit }
        const cz = engine.getceilzofslope(w.nextsector, hit.x, hit.y), fz = engine.getflorzofslope(w.nextsector, hit.x, hit.y)
        if (hit.z <= cz) return { kind: 0, hit }
        if (hit.z >= fz) {
          const here = level.sectors[hit.sect], next = level.sectors[w.nextsector]
          return { kind: (here.floorstat & 1) && (next.floorstat & 1) ? 2 : 0, hit }
        }
        if (!(w.cstat & 0x30)) return { kind: 0, hit }
        // a masked wall: the pixel of its overpicnum where the shot meets it (BLOOD.EXE 0x22908)
        const here = level.sectors[hit.sect], next = level.sectors[w.nextsector]
        const base = w.cstat & 4 ? Math.min(here.floorz, next.floorz) : Math.max(here.ceilingz, next.ceilingz)
        let v = (hit.z - base) >> 8
        if (w.cstat & 0x100) v = -v
        const t = tiles[w.overpicnum]
        if (!t || !t.w || !t.h) return { kind: 0, hit }
        const xp = pow2(t.w), yp = pow2(t.h)
        v = Math.trunc((v * w.yrepeat) / 8) + Math.trunc((w.ypanning * t.h) / 256)
        const w2 = level.walls[w.point2]
        const len = approxDist(w.x - w2.x, w.y - w2.y)
        const d = w.cstat & 8 ? approxDist(hit.x - w2.x, hit.y - w2.y) : approxDist(hit.x - w.x, hit.y - w.y)
        let u = Math.trunc((w.xrepeat * d * 8) / len) + w.xpanning
        u = xp >= 0 ? u & (t.w - 1) : u % t.w
        v = yp >= 0 ? v & (t.h - 1) : v % t.h
        const idx = yp >= 0 ? (u << yp) + v : v + t.h * u
        if (!t.pixels || t.pixels[idx] !== 255) return { kind: 4, hit }
        x1 = hit.x; y1 = hit.y; z1 = hit.z
        hit = through(w, 64, w.nextsector, w.nextwall >= 0 ? level.walls[w.nextwall] : null)
        continue
      }
      if (hit.sect >= 0) {
        // a floor (going down) or a ceiling, unless a link goes on to the sector beyond
        // (down through a floor: the sector's upper link, Blood's gUpperLink, its surface; up through a ceiling: its lower)
        const link = dz > 0 ? (level.upperLink ? level.upperLink[hit.sect] : -1) : (level.lowerLink ? level.lowerLink[hit.sect] : -1)
        if (link < 0) return { kind: dz > 0 ? 2 : 1, hit }
        const a = level.sprites[link], b = level.sprites[a.owner & 0xfff]
        if (!b) return { kind: dz > 0 ? 2 : 1, hit }
        x1 = hit.x + b.x - a.x; y1 = hit.y + b.y - a.y; z1 = hit.z + b.z - a.z
        hit = engine.hitscan(x1, y1, z1, b.sectnum, dx, dy, dz << 4, CLIPMASK1)
        continue
      }
      return { kind: -1, hit }
    }
    return { kind: -1, hit }
  }

  /** Blood's actCanSplatWall: a wall that can take a splat (not a moving or special one, nor into a special sector) */
  canSplatWall (nWall) {
    const level = this.level, w = level.walls[nWall]
    if (w.cstat & 16384 || w.cstat & 32768) return false
    if (w.lotag >= 500 && w.lotag < 512) return false
    if (w.nextsector >= 0) { const t = level.sectors[w.nextsector].lotag; if (t >= 600 && t < 620) return false }
    return true
  }

  /** A wall's angle (Blood's GetWallAngle) */
  wallAngle (nWall) {
    const w = this.level.walls[nWall], w2 = this.level.walls[w.point2]
    return this.level.trig.getangle(w2.x - w.x, w2.y - w.y)
  }

  /**
   * Blood's actFireVector (BLOOD.EXE 0x37680): a hitscan of a type from a shooter (offset sideways, and in z) along
   * (dx, dy, dz). Within its reach: a ceiling or floor, a wall (a mark of its surface on it, fx2, if it can take
   * one), a masked wall (its trigger), a sprite: hurt, triggered, knocked by the impulse over its mass, burnt; a
   * dude bleeds: a chance of a splat on a wall behind it (vector 19's), and its splats, each a chance (spurts).
   * Then the hit's own effect (fx1) and its sound, by the surface hit. Returns { hit, type, inRange }
   */
  fireVector (shooter, offset, zOffset, dx, dy, dz, type) {
    const v = this.tables.vectorData[type]
    const level = this.level, engine = level.engine, trig = level.trig, game = this.game, R = game.random
    const surfType = this.game.res.surfType
    const sx = shooter.x + mulscale(offset, trig.Cos((shooter.ang + 512) & 2047), 30)
    const sy = shooter.y + mulscale(offset, trig.Sin((shooter.ang + 512) & 2047), 30)
    const sz = shooter.z + zOffset
    const { kind, hit } = this.vectorScan(shooter, offset, zOffset, dx, dy, dz, v.maxDist, 1)
    // A player with the reflective shots: the shot comes back at the shooter
    if (kind === 3) {
      const p = game.playerOf(level.sprites[hit.sprite])
      if (p && p.powerups && p.powerups[24]) { hit.sprite = shooter.index; hit.x = shooter.x; hit.y = shooter.y; hit.z = shooter.z }
    }
    let x = hit.x - mulscale(dx, 16, 14), y = hit.y - mulscale(dy, 16, 14), z = hit.z - mulscale(dz, 256, 14)
    const sect = hit.sect
    let surf = 0
    const range = v.maxDist
    const inRange = !range || approxDist(hit.x - shooter.x, hit.y - shooter.y) < range
    const out = { hit, inRange, type, kind }
    if (inRange) {
      switch (kind) {
        case 1: surf = level.sectors[sect].ceilingstat & 1 ? 0 : surfType[level.sectors[sect].ceilingpicnum]; break
        case 2: surf = level.sectors[sect].floorstat & 1 ? 0 : surfType[level.sectors[sect].floorpicnum]; break
        case 0: {
          surf = surfType[level.walls[hit.wall].picnum]
          if (this.canSplatWall(hit.wall)) {
            // (the surface's first effect: a wall's mark, BLOOD.EXE 0x37a93; its others are the hit's, below)
            const fxw = (v.surfaces[surf] || { fx: [-1, -1, -1] }).fx[0]
            if (fxw >= 0) {
              const f = game.fx.spawn(fxw, sect, x, y, z, 0)
              if (f) { f.ang = (this.wallAngle(hit.wall) + 512) & 2047; f.cstat |= 16 }
            }
          }
          break
        }
        case 4: {
          surf = surfType[level.walls[hit.wall].overpicnum]
          const xw = level.xw(hit.wall)
          if (xw && xw.vector) game.triggers.triggerWall(hit.wall, 51) // kCmdWallImpact
          break
        }
        case 3: {
          const s = level.sprites[hit.sprite]
          surf = surfType[s.picnum]
          x -= mulscale(dx, 112, 14); y -= mulscale(dy, 112, 14); z -= mulscale(dz, 112 << 4, 14)
          const shift = type === VECTOR.tine && !game.playerOf(s) ? 3 : 4
          this.damage(shooter, s, v.dmgType, v.dmg << shift)
          const xs = level.x(s)
          if (xs && xs.vector) game.triggers.triggerSprite(hit.sprite, 40 - 9) // kCmdSpriteImpact
          const mass = s.statnum === STAT.dude ? (this.tables.dudeInfo[s.type] || {}).mass : s.statnum === STAT.thing ? (game.things ? game.things.mass(s) : 0) : 0
          if ((s.statnum === STAT.dude || s.statnum === STAT.thing) && mass > 0 && v.impulse) {
            const t = divscale(v.impulse, mass, 8)
            s.xvel += mulscale(dx, t, 16)
            s.yvel += mulscale(dy, t, 16)
            s.zvel += mulscale(dz, t, 16)
          }
          if ((s.statnum === STAT.dude || s.statnum === STAT.thing) && v.burnTime) game.burn(s, level.sprites[shooter.owner] || shooter, v.burnTime)
          if (s.statnum === STAT.dude) {
            out.blood = true
            if (R.Chance(v.fxChance)) {
              const b = this.tables.vectorData[19]
              let ax = dx + R.Random3(4000), ay = dy + R.Random3(4000), az = dz + R.Random3(4000)
              const sc = s.cstat; s.cstat &= ~256
              const h2 = engine.hitscan(s.x, s.y, hit.z, s.sectnum, ax, ay, az << 4, CLIPMASK1)
              s.cstat = sc
              if (this.hitType(h2, hit.z) === 0 && approxDist(h2.x - s.x, h2.y - s.y) <= b.maxDist && this.canSplatWall(h2.wall)) {
                const wx = h2.x - mulscale(ax, 16, 14), wy = h2.y - mulscale(ay, 16, 14), wz = h2.z - mulscale(az, 16 << 4, 14)
                const bs = b.surfaces[surfType[level.walls[h2.wall].picnum]] || { fx: [-1, -1, -1] }
                const t2 = bs.fx[1], t3 = bs.fx[2]
                let f = null
                if (t2 > -1 && (t3 === -1 || R.Chance(0x4000))) f = game.fx.spawn(t2, h2.sect, wx, wy, wz, 0)
                else if (t3 > -1) f = game.fx.spawn(t3, h2.sect, wx, wy, wz, 0)
                if (f) { f.zvel = 0x2222; f.ang = (this.wallAngle(h2.wall) + 512) & 2047; f.cstat |= 16 }
              }
            }
            for (let i = 0; i < v.bloodSplats; i++) if (R.Chance(v.splatChance)) game.fx.spawnBlood(s)
          }
          break
        }
      }
    }
    // The hit's effects, the surface's second and third (BLOOD.EXE 0x37883: a sprite hit in BLOOD000 at tick 569
    // leaves the stone's 5), and its sound
    const sh = v.surfaces[surf] || { fx: [-1, -1, -1], sound: -1 }
    if (sh.fx[1] >= 0) game.fx.spawn(sh.fx[1], sect, x, y, z, 0)
    if (sh.fx[2] >= 0) game.fx.spawn(sh.fx[2], sect, x, y, z, 0)
    if (sh.sound >= 0) game.sound({ x, y, z, sectnum: sect, index: -1 }, sh.sound)
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
