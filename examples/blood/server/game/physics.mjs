// Blood's movement of a dude (a player or a monster) each tick: the horizontal move through clipmove, the vertical
// through gravity and getzrange, landing, and the drag on the ground. As Blood's MoveDude, with its constants kept
// in one place so the fidelity tools can fit them to the original.
import { mulscale, mulscaler, scale, divscale, dmulscale, ksqrt, CLIPMASK0 } from '../../common/engine.mjs'

export const MARKER = { spStart: 1, mpStart: 2, off: 3, on: 4, axis: 5, lowLink: 6, upLink: 7, warpDest: 8, upWater: 9, lowWater: 10, upStack: 11, lowStack: 12, upGoo: 13, lowGoo: 14, path: 15 }

/**
 * Blood's links between sectors one over the other (room over room: water surfaces, the stacks the maps use): the
 * upper and lower link markers of each sector, paired by data1 (Blood's warpInit). Sets level.upperLink and
 * level.lowerLink (sector -> marker sprite), and each marker's owner to its partner.
 */
export function linkSectors (level) {
  level.upperLink = new Int32Array(level.sectors.length).fill(-1)
  level.lowerLink = new Int32Array(level.sectors.length).fill(-1)
  for (const s of level.sprites) {
    if (s.statnum >= 1024 || !level.x(s)) continue
    switch (s.type) {
      case MARKER.upLink: level.upperLink[s.sectnum] = s.index; s.cstat = (s.cstat | 32768) & ~257; break
      case MARKER.lowLink: level.lowerLink[s.sectnum] = s.index; s.cstat = (s.cstat | 32768) & ~257; break
      case MARKER.upWater: case MARKER.upStack: case MARKER.upGoo:
        level.upperLink[s.sectnum] = s.index; s.cstat = (s.cstat | 32768) & ~257
        s.z = level.engine.getflorzofslope(s.sectnum, s.x, s.y)
        break
      case MARKER.lowWater: case MARKER.lowStack: case MARKER.lowGoo:
        level.lowerLink[s.sectnum] = s.index; s.cstat = (s.cstat | 32768) & ~257
        s.z = level.engine.getceilzofslope(s.sectnum, s.x, s.y)
        break
    }
  }
  for (let i = 0; i < level.sectors.length; i++) {
    const up = level.upperLink[i]
    if (up < 0) continue
    const link = level.x(level.sprites[up]).data1
    for (let j = 0; j < level.sectors.length; j++) {
      const low = level.lowerLink[j]
      if (low >= 0 && level.x(level.sprites[low]).data1 === link) { level.sprites[up].owner = low; level.sprites[low].owner = up }
    }
  }
}

/** Blood's GetZRange: Build's, with parallax skies open, depth for water, and through links to the sector above or below */
export function getZRange (level, s, walldist, clipParallax = 3) {
  const engine = level.engine
  const cstat = s.cstat
  s.cstat &= ~257
  const zr = engine.getzrange(s.x, s.y, s.z, s.sectnum, walldist, CLIPMASK0)
  if ((zr.florhit & 0xc000) === 0x4000) {
    const n = zr.florhit & 0x3fff
    if (!(clipParallax & 2) && (level.sectors[n].floorstat & 1)) zr.florz = 0x7fffffff
    const x = level.xs(n)
    if (x) zr.florz += x.depth << 10
    const up = level.upperLink ? level.upperLink[n] : -1
    if (up >= 0) {
      const a = level.sprites[up], b = level.sprites[a.owner & 0xfff]
      if (b) {
        const r = engine.getzrange(s.x + b.x - a.x, s.y + b.y - a.y, s.z + b.z - a.z, b.sectnum, walldist, CLIPMASK0)
        zr.florz = r.florz - (b.z - a.z); zr.florhit = r.florhit
      }
    }
  }
  if ((zr.ceilhit & 0xc000) === 0x4000) {
    const n = zr.ceilhit & 0x3fff
    if (!(clipParallax & 1) && (level.sectors[n].ceilingstat & 1)) zr.ceilz = -0x80000000
    const low = level.lowerLink ? level.lowerLink[n] : -1
    if (low >= 0) {
      const a = level.sprites[low], b = level.sprites[a.owner & 0xfff]
      if (b) {
        const r = engine.getzrange(s.x + b.x - a.x, s.y + b.y - a.y, s.z + b.z - a.z, b.sectnum, walldist, CLIPMASK0)
        zr.ceilz = r.ceilz - (b.z - a.z); zr.ceilhit = r.ceilhit
      }
    }
  }
  s.cstat = cstat
  return zr
}

/** Blood's CheckLink: a sprite past its sector's link goes through to the linked sector. Returns the marker's type, or 0 */
export function checkLink (level, s) {
  if (!level.upperLink) return 0
  const engine = level.engine
  const n = s.sectnum
  const up = level.upperLink[n]
  if (up >= 0) {
    const a = level.sprites[up]
    const z = a.type === MARKER.upLink ? a.z : engine.getflorzofslope(n, s.x, s.y)
    if (z <= s.z) {
      const b = level.sprites[a.owner]
      s.sectnum = b.sectnum
      s.x += b.x - a.x; s.y += b.y - a.y
      const z2 = b.type === MARKER.lowLink ? b.z : engine.getceilzofslope(s.sectnum, s.x, s.y)
      s.z += z2 - z
      level.touched()
      return a.type
    }
  }
  const low = level.lowerLink[n]
  if (low >= 0) {
    const a = level.sprites[low]
    const z = a.type === MARKER.lowLink ? a.z : engine.getceilzofslope(n, s.x, s.y)
    if (z >= s.z) {
      const b = level.sprites[a.owner]
      s.sectnum = b.sectnum
      s.x += b.x - a.x; s.y += b.y - a.y
      const z2 = b.type === MARKER.upLink ? b.z : engine.getflorzofslope(s.sectnum, s.x, s.y)
      s.z += z2 - z
      level.touched()
      return a.type
    }
  }
  return 0
}

export const PHYSICS = {
  /** Drag on the ground, per tick, as a 16.16 fraction of the velocity */
  dudeDrag: 0x2a00,
  /** Gravity, added to zvel each tick (and half of it to z) */
  gravity: 58254,
  /** Below this speed (approxDist of xvel, yvel) a dude on the ground stops */
  stopSpeed: 0x1000,
  /** Blood's actAirDrag on a dude each tick (16.16) */
  airDrag: 128,
  /** Heights above the floor at which drag fades (>> 8: Blood's xsprite height) */
  airborne: 0x100
}

/** Blood's GetWallNormal: a wall's normal, 16.16 */
export function wallNormal (level, nWall) {
  const w = level.walls[nWall], w2 = level.walls[w.point2]
  const dx = -(w2.y - w.y) >> 4, dy = (w2.x - w.x) >> 4
  let len = ksqrt(dx * dx + dy * dy)
  if (len <= 0) len = 1
  return { x: divscale(dx, len, 16), y: divscale(dy, len, 16) }
}

/** Blood's actWallBounceVector: the velocity into a wall taken away (and `bounce` of it sent back, 16.16) */
export function wallBounce (level, s, nWall, bounce = 0) {
  const n = wallNormal(level, nWall)
  const t = dmulscale(s.xvel, n.x, s.yvel, n.y, 16)
  const t2 = mulscaler(t, bounce + 0x10000, 16)
  s.xvel -= mulscale(n.x, t2, 16)
  s.yvel -= mulscale(n.y, t2, 16)
}

/**
 * Blood's actFloorBounceVector: `v` (x, y, z velocities) off the floor of `nSector`, keeping `elastic` (16.16) of what
 * goes into it; a sloped floor (its floorheinum) takes it along its normal. Returns the force of the hit
 */
export function floorBounce (level, v, nSector, elastic) {
  const t = 0x10000 - elastic
  const sec = level.sectors[nSector]
  if (!sec.floorheinum) {
    const t2 = mulscale(v.z, t, 16)
    v.z = -(v.z - t2)
    return t2
  }
  const trig = level.trig
  const w = level.walls[sec.wallptr], w2 = level.walls[w.point2]
  const angle = trig.getangle(w2.x - w.x, w2.y - w.y) + 512
  const t2 = sec.floorheinum << 4
  const t3 = approxDist(-0x10000, t2)
  const t4 = divscale(-0x10000, t3, 16), t5 = divscale(t2, t3, 16)
  const t6 = mulscale(t5, trig.Cos(angle), 30), t7 = mulscale(t5, trig.Sin(angle), 30)
  const t8 = Math.floor((v.x * t6 + v.y * t7 + v.z * t4) / 65536)
  const t9 = mulscale(t8, 0x10000 + elastic, 16)
  v.x -= mulscale(t6, t9, 16)
  v.y -= mulscale(t7, t9, 16)
  v.z -= mulscale(t4, t9, 16)
  return mulscaler(t8, t, 16)
}

/** Blood's approxDist */
export function approxDist (dx, dy) {
  dx = Math.abs(dx); dy = Math.abs(dy)
  if (dx > dy) dy = (3 * dy) >> 3
  else dx = (3 * dx) >> 3
  return dx + dy
}

/**
 * One tick of a dude's movement. `d` is the dude: { sprite, x (its xsprite), player? }; returns what it hit.
 * Sets d.height (Blood's xsprite height: how far above the floor its bottom is, >> 8), d.floorHit, d.ceilHit.
 */
export function moveDude (level, d, P = PHYSICS) {
  const s = d.sprite
  const engine = level.engine
  let { top, bottom } = level.extents(s)
  const bz = Math.trunc((bottom - s.z) / 4), tz = Math.trunc((s.z - top) / 4)
  let wd = s.clipdist << 2
  let hit = 0
  // Blood's actAirDrag first, before the move and gravity: so the original's velocities match to the unit in
  // BLOOD000, on the ground and falling (fidelity/trace.mjs reads them)
  // (under water, Blood's dude loop drags it by 5376: BLOOD001's player in the lake at tick 317)
  const xs0 = level.xs(s.sectnum)
  airDrag(level, s, xs0 && xs0.underwater ? 5376 : P.airDrag)
  if (s.xvel || s.yvel) {
    const cstat = s.cstat
    s.cstat &= ~257
    const pos = { x: s.x, y: s.y, z: s.z, sectnum: s.sectnum }
    hit = engine.clipmove(pos, (s.xvel >> 12) * 16384, (s.yvel >> 12) * 16384, wd, tz, bz, CLIPMASK0)
    s.cstat = cstat
    if (pos.sectnum < 0) {
      // Blood: back where it was
      hit = 0
    } else {
      s.x = pos.x; s.y = pos.y
      if (pos.sectnum !== s.sectnum) { d.changedSector = { from: s.sectnum, to: pos.sectnum }; s.sectnum = pos.sectnum; level.touched() }
    }
  } else {
    const n = engine.updatesectorz(s.x, s.y, s.z, s.sectnum)
    if (n >= 0 && n !== s.sectnum) { d.changedSector = { from: s.sectnum, to: n }; s.sectnum = n; level.touched() }
  }
  d.wallHit = hit
  if ((hit & 0xc000) === 0x8000) {
    const nWall = hit & 0x3fff
    if (d.hitWall) d.hitWall(nWall)
    wallBounce(level, s, nWall, 0)
  } else if ((hit & 0xc000) === 0xc000 && d.hitSprite) d.hitSprite(hit & 0x3fff)
  const xs = level.xs(s.sectnum)
  const underwater = xs && xs.underwater
  let depth = xs && xs.depth
  if (level.upperLink) {
    const up = level.upperLink[s.sectnum], low = level.lowerLink[s.sectnum]
    if (up >= 0 && (level.sprites[up].type === MARKER.upWater || level.sprites[up].type === MARKER.upGoo)) depth = 1
    if (low >= 0 && (level.sprites[low].type === MARKER.lowWater || level.sprites[low].type === MARKER.lowGoo)) depth = 1
  }
  // A player's floor test reaches 16 further (Blood's wd += 16: taking it away worsens every Monte-Carlo run)
  if (d.player) wd += 16
  if (s.zvel) s.z += s.zvel >> 8
  let zr = getZRange(level, s, wd)
  ;({ top, bottom } = level.extents(s))
  if (d.gravity !== false) {
    let vc = P.gravity
    if (depth) {
      if (underwater) {
        const cz = engine.getceilzofslope(s.sectnum, s.x, s.y)
        // (a 32-bit product, BLOOD.EXE 0x3001e: deep in the water it wraps)
        if (cz > top) vc += Math.trunc(Math.imul(bottom - cz, -80099) / (bottom - top))
        else vc = 0
      } else {
        const fz = engine.getflorzofslope(s.sectnum, s.x, s.y)
        if (fz < bottom) vc += Math.trunc(Math.imul(bottom - fz, -80099) / (bottom - top))
      }
    } else if (underwater) vc = 0
    else if (bottom >= zr.florz) vc = 0
    if (vc) {
      s.z += ((vc * 4) / 2) >> 8
      s.zvel += vc
    }
  }
  const link = checkLink(level, s)
  if (link) {
    zr = getZRange(level, s, wd)
    if (d.linked) d.linked(link)
  }
  ;({ top, bottom } = level.extents(s))
  d.landed = 0
  if (zr.florz <= bottom) {
    d.floorHit = zr.florhit
    s.z += zr.florz - bottom
    const v = s.zvel - level.velFloor[s.sectnum]
    if (v > 0) {
      // Blood's actFloorBounceVector with no bounce: a flat floor stops the fall, a slope turns it along itself (the
      // player keeps falling down it, BLOOD000 at tick 405); what it took is the landing's force (d.onLand: its damage)
      const vel = { x: s.xvel, y: s.yvel, z: v }
      const force = floorBounce(level, vel, s.sectnum, 0)
      s.xvel = vel.x; s.yvel = vel.y
      d.landed = force
      if (d.onLand) d.onLand(force, (s.flags & 4) !== 0)
      s.zvel = vel.z
      if (Math.abs(s.zvel) < 0x10000) { s.zvel = level.velFloor[s.sectnum]; s.flags &= ~4; d.falling = false } else s.flags |= 4
    } else if (s.zvel === 0) { d.falling = false; s.flags &= ~4 }
  } else {
    d.floorHit = 0
    if (d.gravity !== false) d.falling = true
    // Blood's kPhysFalling: in the air (with gravity), it is moved every frame until it lands
    if (s.flags & 2) s.flags |= 4
  }
  if (top <= zr.ceilz) {
    d.ceilHit = zr.ceilhit
    s.z += Math.max(zr.ceilz - top, 0)
    if (s.zvel <= 0 && d.falling) s.zvel = mulscale(-s.zvel, 0x2000, 16)
  } else d.ceilHit = 0
  ;({ top, bottom } = level.extents(s))
  d.height = Math.max(zr.florz - bottom, 0) >> 8
  d.floorZ = zr.florz
  d.ceilZ = zr.ceilz
  // Over another sprite (a face sprite: a dude, a thing, the floor its getzrange found, standing on it or not: zombie
  // 232 in BLOOD000 at tick 685), Blood's MoveDude slides it off by how far it is from that sprite's middle, and does
  // not drag it; under water there is no drag either
  const onSprite = (zr.florhit & 0xe000) === 0xc000 ? level.sprites[zr.florhit & 0x1fff] : null
  if ((s.xvel || s.yvel) && onSprite && (onSprite.cstat & 0x30) === 0) {
    s.xvel += s.x - onSprite.x
    s.yvel += s.y - onSprite.y
  } else if ((s.xvel || s.yvel) && d.height < P.airborne && !(level.xs(s.sectnum) && level.xs(s.sectnum).underwater)) {
    let drag = P.dudeDrag
    if (d.height > 0) drag -= scale(P.dudeDrag, d.height, 0x100)
    s.xvel -= mulscaler(s.xvel, drag, 16)
    s.yvel -= mulscaler(s.yvel, drag, 16)
    if (approxDist(s.xvel, s.yvel) < P.stopSpeed) s.xvel = s.yvel = 0
  }
  return hit
}

/**
 * Blood's actAirDrag: every tick a moving sprite loses `a` (16.16) of its speed in each axis, and in x and y is drawn
 * toward its sector's wind (an xsector's windVel along windAng, always or while it is busy)
 */
export function airDrag (level, s, a) {
  let wx = 0, wy = 0
  const xs = level.xs(s.sectnum)
  if (xs && xs.windVel && (xs.windAlways || xs.busy)) {
    let v = xs.windVel << 12
    if (!xs.windAlways && xs.busy) v = mulscale(v, xs.busy, 16)
    wx = mulscale(v, level.trig.Cos(xs.windAng), 30)
    wy = mulscale(v, level.trig.Sin(xs.windAng), 30)
  }
  s.xvel += mulscale(wx - s.xvel, a, 16)
  s.yvel += mulscale(wy - s.yvel, a, 16)
  s.zvel -= mulscale(s.zvel, a, 16)
}
