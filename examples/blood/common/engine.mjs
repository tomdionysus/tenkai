// The Build engine's world queries, as Blood (1997) used them, in plain JavaScript for the server (and the client's
// prediction later): updatesector, clipmove, pushmove, getzrange, hitscan, cansee, neartag; and Blood's trigonometry
// (its cosine table, COSINE.DAT) and Build's (sintable and radarang, TABLES.DAT). Integer arithmetic as Build's, so
// the remake moves as the original did: products in doubles (exact to 2^53), shifts as floors, divisions truncated.
//
// A world here is { sectors, walls, sprites, headspritesect? } in formats/map.mjs's shapes; sprites are filtered by
// `blocking(sprite)` where a query takes sprites into account.

import { slopeZ } from './build.mjs'

// --- fixed-point helpers (Build's pragmas) ---
export const mulscale = (a, b, n) => Math.floor(a * b / 2 ** n)
export const divscale = (a, b, n) => Math.trunc(a * 2 ** n / b)
export const dmulscale = (a, b, c, d, n) => Math.floor((a * b + c * d) / 2 ** n)
export const scale = (a, b, c) => Math.trunc(a * b / c)
export const klabs = Math.abs
export const ksgn = (a) => (a > 0) - (a < 0)
// Build's ksqrt (nsqrtasm, BLOOD.EXE 0x8eee8): not an exact root but a lookup in initksqrt's tables, its input
// shifted down to 12 bits by its size and the answer shifted back (GetWallNormal's lengths come out so)
const SQRTABLE = new Uint16Array(4096), SHLOOKUP = new Uint16Array(4096 + 256)
{
  // msqrtasm: the root of n, rounded
  const msqrt = (n) => {
    let a = 0x40000000, b = 0x20000000
    do {
      if (n >= a) { n -= a; a += b * 4 }
      a -= b; a >>>= 1; b >>>= 2
    } while (b)
    if (n >= a) a++
    return a >>> 1
  }
  let j = 1, k = 0
  for (let i = 0; i < 4096; i++) {
    if (i >= j) { j <<= 2; k++ }
    SQRTABLE[i] = (msqrt((i << 18) + 131072) << 1) & 0xffff
    SHLOOKUP[i] = (k << 1) + ((10 - k) << 8)
    if (i < 256) SHLOOKUP[i + 4096] = ((k + 6) << 1) + ((10 - (k + 6)) << 8)
  }
}
export const ksqrt = (n) => {
  n >>>= 0
  const cx = n & 0xff000000 ? SHLOOKUP[(n >>> 24) + 4096] : SHLOOKUP[n >>> 12]
  return SQRTABLE[n >>> (cx & 0xff)] >>> (cx >> 8)
}
/** Blood's mulscale with rounding (mulscale16r etc.) */
export const mulscaler = (a, b, n) => Math.floor((a * b + 2 ** (n - 1)) / 2 ** n)

// --- tables ---
export class Trig {
  /**
   * @param {Buffer} cosine COSINE.DAT (512 int32s, a quarter wave of cos, amplitude 2^30)
   * @param {Buffer} tables TABLES.DAT (Build's sintable and radarang)
   */
  constructor (cosine, tables) {
    this.costable = new Int32Array(2048)
    for (let i = 0; i < 512; i++) this.costable[i] = cosine.readInt32LE(i * 4)
    for (let i = 513; i <= 1024; i++) this.costable[i] = -this.costable[1024 - i]
    for (let i = 1025; i < 2048; i++) this.costable[i] = this.costable[2048 - i]
    this.costable[512] = 0
    this.sintable = new Int16Array(2048)
    for (let i = 0; i < 2048; i++) this.sintable[i] = tables.readInt16LE(i * 2)
    this.radarang = new Int16Array(1280)
    for (let i = 0; i < 640; i++) this.radarang[i] = tables.readInt16LE(4096 + i * 2)
    for (let i = 0; i < 640; i++) this.radarang[1279 - i] = -this.radarang[i]
  }

  /** Blood's Cos and Sin: 2^30 amplitude */
  Cos (ang) { return this.costable[ang & 2047] }
  Sin (ang) { return this.costable[(ang - 512) & 2047] }

  /** Build's getangle */
  getangle (x, y) {
    if (x === 0 && y === 0) return 0
    if (x === 0) return 512 + ((y < 0) << 10)
    if (y === 0) return (x < 0) << 10
    if (x === y) return 256 + ((x < 0) << 10)
    if (x === -y) return 768 + ((x > 0) << 10)
    if (Math.abs(x) > Math.abs(y)) return ((this.radarang[640 + scale(160, y, x)] >> 6) + ((x < 0) << 10)) & 2047
    return ((this.radarang[640 - scale(160, x, y)] >> 6) + 512 + ((y < 0) << 10)) & 2047
  }
}

const MAXCLIPDIST = 1024
export const CLIPMASK0 = (1 << 16) + 1 // walls and sprites that block (cstat 1)
export const CLIPMASK1 = (256 << 16) + 64 // hitscan (cstat 256 on sprites, 64 on walls)

export class Engine {
  /**
   * @param {object} world { sectors, walls, sprites }
   * @param {Trig} trig
   * @param {object} tiles The tiles' sizes and offsets: tiles[picnum] = { w, h, xo, yo }
   */
  constructor (world, trig, tiles) {
    this.world = world
    this.trig = trig
    this.tiles = tiles
  }

  get sectors () { return this.world.sectors }
  get walls () { return this.world.walls }
  get sprites () { return this.world.sprites }

  florz (s, x, y) { return Math.floor(slopeZ(this.world, s, x, y, false)) }
  ceilz (s, x, y) { return Math.floor(slopeZ(this.world, s, x, y, true)) }

  /** Build's getflorzofslope, in integers as Build computes it */
  getflorzofslope (s, x, y) { return this.zofslope(s, x, y, false) }
  getceilzofslope (s, x, y) { return this.zofslope(s, x, y, true) }
  zofslope (s, x, y, ceiling) {
    const sec = this.world.sectors[s]
    const z = ceiling ? sec.ceilingz : sec.floorz
    if (!((ceiling ? sec.ceilingstat : sec.floorstat) & 2)) return z
    const w = this.world.walls[sec.wallptr], w2 = this.world.walls[w.point2]
    const dx = w2.x - w.x, dy = w2.y - w.y
    const i = ksqrt(dx * dx + dy * dy) << 5
    if (i === 0) return z
    const j = dmulscale(dx, y - w.y, -dy, x - w.x, 3)
    return z + scale(ceiling ? sec.ceilingheinum : sec.floorheinum, j, i)
  }

  /** Build's inside: 1 inside, 0 outside, -1 no such sector */
  inside (x, y, s) {
    if (s < 0 || s >= this.world.sectors.length) return -1
    const sec = this.world.sectors[s], walls = this.world.walls
    let cnt = 0
    for (let i = sec.wallptr, n = sec.wallnum; n > 0; i++, n--) {
      const w = walls[i], w2 = walls[w.point2]
      const y1 = w.y - y, y2 = w2.y - y
      if ((y1 ^ y2) < 0) {
        const x1 = w.x - x, x2 = w2.x - x
        if ((x1 ^ x2) >= 0) cnt ^= x1
        else cnt ^= (x1 * y2 - x2 * y1) ^ y2
      }
    }
    return (cnt >>> 31)
  }

  /** Build's updatesector: the sector a point is in, from a guess */
  updatesector (x, y, sectnum) {
    const sectors = this.world.sectors, walls = this.world.walls
    if (this.inside(x, y, sectnum) === 1) return sectnum
    if (sectnum >= 0 && sectnum < sectors.length) {
      const sec = sectors[sectnum]
      for (let i = sec.wallptr, n = sec.wallnum; n > 0; i++, n--) {
        const j = walls[i].nextsector
        if (j >= 0 && this.inside(x, y, j) === 1) return j
      }
    }
    for (let i = sectors.length - 1; i >= 0; i--) if (this.inside(x, y, i) === 1) return i
    return -1
  }

  /** Build's updatesectorz: as updatesector, also within the sector's heights */
  updatesectorz (x, y, z, sectnum) {
    const ok = (s) => {
      const cz = this.getceilzofslope(s, x, y), fz = this.getflorzofslope(s, x, y)
      return z >= cz && z <= fz && this.inside(x, y, s) === 1
    }
    if (sectnum >= 0 && sectnum < this.world.sectors.length) {
      if (ok(sectnum)) return sectnum
      const sec = this.world.sectors[sectnum]
      for (let i = sec.wallptr, n = sec.wallnum; n > 0; i++, n--) {
        const j = this.world.walls[i].nextsector
        if (j >= 0 && ok(j)) return j
      }
    }
    for (let i = this.world.sectors.length - 1; i >= 0; i--) if (ok(i)) return i
    return -1
  }

  /** Sprites in a sector (statnum < MAXSTATUS), by scanning (the world keeps no lists) */
  spritesIn (sectnum) {
    if (!this._bySector || this._bySectorStamp !== this.world.stamp) {
      this._bySector = new Map()
      this._bySectorStamp = this.world.stamp
      this.world.sprites.forEach((s, i) => {
        if (!s || s.statnum >= 1024 || s.sectnum < 0) return
        let l = this._bySector.get(s.sectnum)
        if (!l) this._bySector.set(s.sectnum, (l = []))
        l.push(i)
      })
    }
    return this._bySector.get(sectnum) || []
  }

  /** Forgets the sprite lists (after sprites move between sectors, are added or removed) */
  touched () { this._bySector = null }

  tile (picnum) { return this.tiles[picnum] || { w: 0, h: 0, xo: 0, yo: 0 } }

  // --- clipmove ---

  /**
   * Build's clipmove: moves pos { x, y, z, sectnum } by (xvect, yvect) (16.14 fixed: >> 14 is units), sliding along
   * what blocks. Returns 0, or what was hit: 32768 + wall, 49152 + sprite.
   */
  clipmove (pos, xvect, yvect, walldist, ceildist, flordist, cliptype) {
    if ((xvect === 0 && yvect === 0) || pos.sectnum < 0) return 0
    const walls = this.world.walls, sectors = this.world.sectors, sprites = this.world.sprites
    const dawalclipmask = cliptype & 65535, dasprclipmask = cliptype >>> 16
    let retval = 0
    const oxvect = xvect, oyvect = yvect
    let goalx = pos.x + Math.floor(xvect / 16384), goaly = pos.y + Math.floor(yvect / 16384)
    const clipit = [], clipobjectval = []
    const addclipline = (x1, y1, x2, y2, obj) => { clipit.push({ x1, y1, x2, y2 }); clipobjectval.push(obj) }
    const cx = (pos.x + goalx) >> 1, cy = (pos.y + goaly) >> 1
    const gx = goalx - pos.x, gy = goaly - pos.y
    const rad = ksqrt(gx * gx + gy * gy) + MAXCLIPDIST + walldist + 8
    const xmin = cx - rad, ymin = cy - rad, xmax = cx + rad, ymax = cy + rad
    const clipsectorlist = [pos.sectnum]
    for (let clipsectcnt = 0; clipsectcnt < clipsectorlist.length; clipsectcnt++) {
      const dasect = clipsectorlist[clipsectcnt], sec = sectors[dasect]
      for (let j = sec.wallptr, n = sec.wallnum; n > 0; j++, n--) {
        const wal = walls[j], wal2 = walls[wal.point2]
        if (wal.x < xmin && wal2.x < xmin) continue
        if (wal.x > xmax && wal2.x > xmax) continue
        if (wal.y < ymin && wal2.y < ymin) continue
        if (wal.y > ymax && wal2.y > ymax) continue
        const x1 = wal.x, y1 = wal.y, x2 = wal2.x, y2 = wal2.y
        const dx = x2 - x1, dy = y2 - y1
        if (dx * (pos.y - y1) < (pos.x - x1) * dy) continue // back side
        const dax0 = dx > 0 ? dx * (ymin - y1) : dx * (ymax - y1)
        const day0 = dy > 0 ? dy * (xmax - x1) : dy * (xmin - x1)
        if (dax0 >= day0) continue
        let clipyou = 0
        if (wal.nextsector < 0 || (wal.cstat & dawalclipmask)) clipyou = 1
        else {
          const hit = this.rintersect(pos.x, pos.y, 0, gx, gy, 0, x1, y1, x2, y2)
          const dax = hit ? hit.x : pos.x, day = hit ? hit.y : pos.y
          let daz = this.getflorzofslope(dasect, dax, day), daz2 = this.getflorzofslope(wal.nextsector, dax, day)
          const sec2 = sectors[wal.nextsector]
          if (daz2 < daz - (1 << 8) && (sec2.floorstat & 1) === 0 && pos.z >= daz2 - (flordist - 1)) clipyou = 1
          if (!clipyou) {
            daz = this.getceilzofslope(dasect, dax, day); daz2 = this.getceilzofslope(wal.nextsector, dax, day)
            if (daz2 > daz + (1 << 8) && (sec2.ceilingstat & 1) === 0 && pos.z <= daz2 + (ceildist - 1)) clipyou = 1
          }
        }
        if (clipyou) {
          // Boxes at the ends, then the wall moved out by walldist
          let bsz = walldist; if (gx < 0) bsz = -bsz
          addclipline(x1 - bsz, y1 - bsz, x1 - bsz, y1 + bsz, j + 32768)
          addclipline(x2 - bsz, y2 - bsz, x2 - bsz, y2 + bsz, j + 32768)
          bsz = walldist; if (gy < 0) bsz = -bsz
          addclipline(x1 + bsz, y1 - bsz, x1 - bsz, y1 - bsz, j + 32768)
          addclipline(x2 + bsz, y2 - bsz, x2 - bsz, y2 - bsz, j + 32768)
          let dax = walldist; if (dy > 0) dax = -dax
          let day = walldist; if (dx < 0) day = -day
          addclipline(x1 + dax, y1 + day, x2 + dax, y2 + day, j + 32768)
        } else if (!clipsectorlist.includes(wal.nextsector)) clipsectorlist.push(wal.nextsector)
      }
    }
    // Sprites that block
    if (dasprclipmask) {
      for (const sect of clipsectorlist) {
        for (const j of this.spritesIn(sect)) {
          const spr = sprites[j]
          if (!(spr.cstat & dasprclipmask)) continue
          const x1 = spr.x, y1 = spr.y
          const kind = spr.cstat & 48
          if (kind === 0) {
            if (x1 >= xmin && x1 <= xmax && y1 >= ymin && y1 <= ymax) {
              const t = this.tile(spr.picnum)
              const k = (t.h * spr.yrepeat) << 2
              let daz = spr.cstat & 128 ? spr.z + (k >> 1) : spr.z
              if (t.yo) daz -= (t.yo * spr.yrepeat) << 2
              if (pos.z < daz + ceildist && pos.z > daz - k - flordist) {
                // (Build's: each line faces the mover, its ends by the same signed size, so raytrace sees its front)
                const r = (spr.clipdist << 2) + walldist
                let bsz = gx < 0 ? -r : r
                addclipline(x1 - bsz, y1 - bsz, x1 - bsz, y1 + bsz, j + 49152)
                bsz = gy < 0 ? -r : r
                addclipline(x1 + bsz, y1 - bsz, x1 - bsz, y1 - bsz, j + 49152)
              }
            }
          } else if (kind === 16) {
            // Wall sprite (Build's clipmove): when its line meets the move's box, a line before the side the mover is
            // on (only the front of a one-sided one), and a blocker at the end it is past
            const t = this.tile(spr.picnum)
            const k = (t.h * spr.yrepeat) << 2
            let daz = spr.cstat & 128 ? spr.z + (k >> 1) : spr.z
            if (t.yo) daz -= (t.yo * spr.yrepeat) << 2
            if (pos.z < daz + ceildist && pos.z > daz - k - flordist) {
              const ends = this.wallSpriteEnds(spr)
              if (ends && clipinsideboxline(cx, cy, ends[0], ends[1], ends[2], ends[3], rad)) {
                const [ax, ay, bx, by] = ends
                const sin = this.trig.sintable
                const dax = mulscale(sin[(spr.ang + 256 + 512) & 2047], walldist, 14), day = mulscale(sin[(spr.ang + 256) & 2047], walldist, 14)
                if ((ax - pos.x) * (by - pos.y) >= (bx - pos.x) * (ay - pos.y)) addclipline(ax + dax, ay + day, bx + day, by - dax, j + 49152)
                else {
                  if (spr.cstat & 64) continue
                  addclipline(bx - dax, by - day, ax - day, ay + dax, j + 49152)
                }
                if ((bx - ax) * (pos.x - ax) + (by - ay) * (pos.y - ay) < 0) addclipline(ax - day, ay + dax, ax + dax, ay + day, j + 49152)
                else if ((ax - bx) * (pos.x - bx) + (ay - by) * (pos.y - by) < 0) addclipline(bx + day, by - dax, bx - dax, by - day, j + 49152)
              }
            }
          } else if (kind === 32) {
            // Floor sprites block only from above or below; clipmove leaves them to getzrange
          }
        }
      }
    }
    // Slide along what was hit, up to three times
    const hitwalls = []
    let hitwall = 0
    let cnt = 3
    do {
      let intx = goalx, inty = goaly
      hitwall = this.raytrace(clipit, pos.x, pos.y, intx, inty)
      if (hitwall.wall >= 0) {
        intx = hitwall.x; inty = hitwall.y
        const c = clipit[hitwall.wall]
        const lx = c.x2 - c.x1, ly = c.y2 - c.y1
        const t2 = lx * lx + ly * ly
        if (t2 > 0) {
          const t1 = (goalx - intx) * lx + (goaly - inty) * ly
          const i = (Math.abs(t1) >> 11) < t2 ? divscale(t1, t2, 20) : 0
          goalx = mulscale(lx, i, 20) + intx
          goaly = mulscale(ly, i, 20) + inty
        }
        const t1 = dmulscale(lx, oxvect, ly, oyvect, 6)
        for (let i = cnt + 1; i <= 3; i++) {
          const w = clipit[hitwalls[i]]
          const t3 = dmulscale(w.x2 - w.x1, oxvect, w.y2 - w.y1, oyvect, 6)
          if ((t1 < 0) !== (t3 < 0) && t1 !== 0 && t3 !== 0) {
            pos.sectnum = this.updatesector(pos.x, pos.y, pos.sectnum)
            return retval
          }
        }
        const kept = this.keepaway(clipit[hitwall.wall], goalx, goaly)
        goalx = kept.x; goaly = kept.y
        xvect = (goalx - intx) * 16384
        yvect = (goaly - inty) * 16384
        if (cnt === 3) retval = clipobjectval[hitwall.wall]
        hitwalls[cnt] = hitwall.wall
      }
      cnt--
      pos.x = intx; pos.y = inty
    } while ((xvect !== 0 || yvect !== 0) && hitwall.wall >= 0 && cnt > 0)
    for (const s of clipsectorlist) if (this.inside(pos.x, pos.y, s) === 1) { pos.sectnum = s; return retval }
    // Not in any of the sectors looked at: the nearest sector it is inside, by height
    let best = -1, bestd = 0x7fffffff
    for (let j = sectors.length - 1; j >= 0; j--) {
      if (this.inside(pos.x, pos.y, j) !== 1) continue
      let d = this.getceilzofslope(j, pos.x, pos.y) - pos.z
      if (d > 0) { if (d < bestd) { best = j; bestd = d } } else {
        d = pos.z - this.getflorzofslope(j, pos.x, pos.y)
        if (d <= 0) { pos.sectnum = j; return retval }
        if (d < bestd) { best = j; bestd = d }
      }
    }
    pos.sectnum = best
    return retval
  }

  wallSpriteEnds (spr) {
    const t = this.tile(spr.picnum)
    if (!t.w) return null
    // As Build's: an x-flip turns the tile's offset only, and the ends are scaled at full precision (mulscale16)
    let xoff = t.xo + spr.xoffset
    if (spr.cstat & 4) xoff = -xoff
    const k = spr.ang
    const l = spr.xrepeat
    const dax = this.trig.sintable[k & 2047] * l, day = this.trig.sintable[(k + 1536) & 2047] * l
    const l2 = t.w
    const k2 = (l2 >> 1) + xoff
    const x1 = spr.x - mulscale(dax, k2, 16), y1 = spr.y - mulscale(day, k2, 16)
    return [x1, y1, x1 + mulscale(dax, l2, 16), y1 + mulscale(day, l2, 16)]
  }

  /** Build's rintersect: where the ray (x1, y1) + (vx, vy) t crosses the segment (x3, y3)-(x4, y4), or null */
  rintersect (x1, y1, z1, vx, vy, vz, x3, y3, x4, y4) {
    const x34 = x3 - x4, y34 = y3 - y4
    const bot = vx * y34 - vy * x34
    let topt, topu
    if (bot >= 0) {
      if (bot === 0) return null
      const x31 = x3 - x1, y31 = y3 - y1
      topt = x31 * y34 - y31 * x34; if (topt < 0) return null
      topu = vx * y31 - vy * x31; if (topu < 0 || topu >= bot) return null
    } else {
      const x31 = x3 - x1, y31 = y3 - y1
      topt = x31 * y34 - y31 * x34; if (topt > 0) return null
      topu = vx * y31 - vy * x31; if (topu > 0 || topu <= bot) return null
    }
    const t = divscale(topt, bot, 16)
    return { x: x1 + mulscale(vx, t, 16), y: y1 + mulscale(vy, t, 16), z: z1 + mulscale(vz, t, 16) }
  }

  raytrace (clipit, x3, y3, x4, y4) {
    let hit = -1
    for (let z = clipit.length - 1; z >= 0; z--) {
      const { x1, y1, x2, y2 } = clipit[z]
      const x21 = x2 - x1, y21 = y2 - y1
      let topu = x21 * (y3 - y1) - (x3 - x1) * y21
      if (topu <= 0) continue
      if (x21 * (y4 - y1) > (x4 - x1) * y21) continue
      const x43 = x4 - x3, y43 = y4 - y3
      if (x43 * (y1 - y3) > (x1 - x3) * y43) continue
      if (x43 * (y2 - y3) <= (x2 - x3) * y43) continue
      const bot = x43 * y21 - x21 * y43
      if (bot === 0) continue
      let cnt = 256, nintx, ninty
      do {
        cnt--
        if (cnt < 0) return { wall: z, x: x3, y: y3 }
        nintx = x3 + scale(x43, topu, bot)
        ninty = y3 + scale(y43, topu, bot)
        topu--
      } while (x21 * (ninty - y1) <= (nintx - x1) * y21)
      if (Math.abs(x3 - nintx) + Math.abs(y3 - ninty) < Math.abs(x3 - x4) + Math.abs(y3 - y4)) { x4 = nintx; y4 = ninty; hit = z }
    }
    return { wall: hit, x: x4, y: y4 }
  }

  keepaway (c, x, y) {
    const x1 = c.x1, dx = c.x2 - x1, y1 = c.y1, dy = c.y2 - y1
    const ox = ksgn(-dy), oy = ksgn(dx)
    let first = Math.abs(dx) <= Math.abs(dy)
    for (let guard = 0; guard < 4096; guard++) {
      if (dx * (y - y1) > (x - x1) * dy) break
      if (!first) x += ox; else y += oy
      first = !first
    }
    return { x, y }
  }

  // --- pushmove ---

  clipinsidebox (x, y, wallnum, walldist) {
    const r = walldist << 1
    const w = this.world.walls[wallnum], w2 = this.world.walls[w.point2]
    const x1 = w.x + walldist - x, y1 = w.y + walldist - y
    let x2 = w2.x + walldist - x, y2 = w2.y + walldist - y
    if (x1 < 0 && x2 < 0) return 0
    if (y1 < 0 && y2 < 0) return 0
    if (x1 >= r && x2 >= r) return 0
    if (y1 >= r && y2 >= r) return 0
    x2 -= x1; y2 -= y1
    if (x2 * (walldist - y1) >= y2 * (walldist - x1)) {
      x2 *= x2 > 0 ? (0 - y1) : (r - y1)
      y2 *= y2 > 0 ? (r - x1) : (0 - x1)
      return x2 < y2 ? 1 : 0
    }
    x2 *= x2 > 0 ? (r - y1) : (0 - y1)
    y2 *= y2 > 0 ? (0 - x1) : (r - x1)
    return (x2 >= y2) ? 2 : 0
  }

  /** Build's pushmove: pushes pos out of walls it is inside of. Returns 0, or -1 if it could not */
  pushmove (pos, walldist, ceildist, flordist, cliptype) {
    if (pos.sectnum < 0) return -1
    const walls = this.world.walls, sectors = this.world.sectors
    const dawalclipmask = cliptype & 65535
    let k = 32, bad
    do {
      bad = 0
      const clipsectorlist = [pos.sectnum]
      for (let c = 0; c < clipsectorlist.length; c++) {
        const cs = clipsectorlist[c], sec = sectors[cs]
        for (let i = sec.wallptr, n = sec.wallnum; n > 0; i++, n--) {
          const wal = walls[i]
          if (this.clipinsidebox(pos.x, pos.y, i, walldist - 4) !== 1) continue
          let j = 0
          if (wal.nextsector < 0 || (wal.cstat & dawalclipmask)) j = 1
          if (!j) {
            const sec2 = sectors[wal.nextsector], w2 = walls[wal.point2]
            let dax = w2.x - wal.x, day = w2.y - wal.y
            let daz = dax * (pos.x - wal.x) + day * (pos.y - wal.y)
            let t
            if (daz <= 0) t = 0
            else { const daz2 = dax * dax + day * day; t = daz >= daz2 ? (1 << 30) : divscale(daz, daz2, 30) }
            dax = wal.x + mulscale(dax, t, 30)
            day = wal.y + mulscale(day, t, 30)
            daz = this.getflorzofslope(cs, dax, day)
            let daz2 = this.getflorzofslope(wal.nextsector, dax, day)
            if (daz2 < daz - (1 << 8) && (sec2.floorstat & 1) === 0 && pos.z >= daz2 - (flordist - 1)) j = 1
            daz = this.getceilzofslope(cs, dax, day)
            daz2 = this.getceilzofslope(wal.nextsector, dax, day)
            if (daz2 > daz + (1 << 8) && (sec2.ceilingstat & 1) === 0 && pos.z <= daz2 + (ceildist - 1)) j = 1
          }
          if (j) {
            const w2 = walls[wal.point2]
            const ang = this.trig.getangle(w2.x - wal.x, w2.y - wal.y)
            const dx = this.trig.sintable[(ang + 1024) & 2047] >> 11, dy = this.trig.sintable[(ang + 512) & 2047] >> 11
            let bad2 = 16
            do {
              pos.x += dx; pos.y += dy
              bad2--
              if (bad2 === 0) break
            } while (this.clipinsidebox(pos.x, pos.y, i, walldist - 4) !== 0)
            bad = -1
            k--
            if (k <= 0) return bad
            pos.sectnum = this.updatesector(pos.x, pos.y, pos.sectnum)
            if (pos.sectnum < 0) return -1
          } else if (!clipsectorlist.includes(wal.nextsector)) clipsectorlist.push(wal.nextsector)
        }
      }
    } while (bad !== 0)
    return bad
  }

  // --- getzrange ---

  /**
   * Build's getzrange: the ceiling and floor above and below a point, from the sectors and blocking sprites within
   * walldist. Returns { ceilz, ceilhit, florz, florhit } (hits: 16384 + sector, 49152 + sprite).
   */
  getzrange (x, y, z, sectnum, walldist, cliptype) {
    if (sectnum < 0) return { ceilz: -0x80000000, ceilhit: -1, florz: 0x7fffffff, florhit: -1 }
    const walls = this.world.walls, sectors = this.world.sectors, sprites = this.world.sprites
    const dawalclipmask = cliptype & 65535, dasprclipmask = cliptype >>> 16
    const i0 = walldist + MAXCLIPDIST + 1
    const xmin = x - i0, ymin = y - i0, xmax = x + i0, ymax = y + i0
    let ceilz = this.getceilzofslope(sectnum, x, y), florz = this.getflorzofslope(sectnum, x, y)
    let ceilhit = sectnum + 16384, florhit = sectnum + 16384
    const clipsectorlist = [sectnum]
    for (let c = 0; c < clipsectorlist.length; c++) {
      const sec = sectors[clipsectorlist[c]]
      for (let j = sec.wallptr, n = sec.wallnum; n > 0; j++, n--) {
        const wal = walls[j]
        const k = wal.nextsector
        if (k < 0) continue
        const wal2 = walls[wal.point2]
        const x1 = wal.x, x2 = wal2.x, y1 = wal.y, y2 = wal2.y
        if (x1 < xmin && x2 < xmin) continue
        if (x1 > xmax && x2 > xmax) continue
        if (y1 < ymin && y2 < ymin) continue
        if (y1 > ymax && y2 > ymax) continue
        const dx = x2 - x1, dy = y2 - y1
        if (dx * (y - y1) < (x - x1) * dy) continue
        const dax = dx > 0 ? dx * (ymin - y1) : dx * (ymax - y1)
        const day = dy > 0 ? dy * (xmax - x1) : dy * (xmin - x1)
        if (dax >= day) continue
        if (wal.cstat & dawalclipmask) continue
        const sec2 = sectors[k]
        if ((sec2.ceilingstat & 1) === 0 && z <= sec2.ceilingz + (3 << 8)) continue
        if ((sec2.floorstat & 1) === 0 && z >= sec2.floorz - (3 << 8)) continue
        if (!clipsectorlist.includes(k)) clipsectorlist.push(k)
        if (x1 < xmin + MAXCLIPDIST && x2 < xmin + MAXCLIPDIST) continue
        if (x1 > xmax - MAXCLIPDIST && x2 > xmax - MAXCLIPDIST) continue
        if (y1 < ymin + MAXCLIPDIST && y2 < ymin + MAXCLIPDIST) continue
        if (y1 > ymax - MAXCLIPDIST && y2 > ymax - MAXCLIPDIST) continue
        const dax2 = dx > 0 ? dx * (ymin + MAXCLIPDIST - y1) : dx * (ymax - MAXCLIPDIST - y1)
        const day2 = dy > 0 ? dy * (xmax - MAXCLIPDIST - x1) : dy * (xmin + MAXCLIPDIST - x1)
        if (dax2 >= day2) continue
        const cz = this.getceilzofslope(k, x, y), fz = this.getflorzofslope(k, x, y)
        if (cz > ceilz) { ceilz = cz; ceilhit = k + 16384 }
        if (fz < florz) { florz = fz; florhit = k + 16384 }
      }
    }
    if (dasprclipmask) {
      for (const sect of clipsectorlist) {
        for (const j of this.spritesIn(sect)) {
          const spr = sprites[j]
          if (!(spr.cstat & dasprclipmask)) continue
          let clipyou = 0, daz, daz2
          const x1 = spr.x, y1 = spr.y
          const t = this.tile(spr.picnum)
          switch (spr.cstat & 48) {
            case 0: {
              const k = walldist + (spr.clipdist << 2) + 1
              if (Math.abs(x1 - x) <= k && Math.abs(y1 - y) <= k) {
                const h = (t.h * spr.yrepeat) << 2
                daz = spr.cstat & 128 ? spr.z + (h >> 1) : spr.z
                if (t.yo) daz -= (t.yo * spr.yrepeat) << 2
                daz2 = daz - h
                clipyou = 1
              }
              break
            }
            case 16: {
              const h = (t.h * spr.yrepeat) << 2
              daz = spr.cstat & 128 ? spr.z + (h >> 1) : spr.z
              if (t.yo) daz -= (t.yo * spr.yrepeat) << 2
              daz2 = daz - h
              const ends = this.wallSpriteEnds(spr)
              if (ends && this.clipInsideBoxLine(x, y, ends, walldist + 1)) clipyou = 1
              break
            }
            case 32: {
              daz = spr.z; daz2 = daz
              if ((spr.cstat & 64) && (z > daz) === !(spr.cstat & 8)) break
              if (this.insideFloorSprite(spr, x, y, walldist)) clipyou = 1
              break
            }
          }
          if (clipyou) {
            if (z > daz && daz > ceilz) { ceilz = daz; ceilhit = j + 49152 }
            if (z < daz2 && daz2 < florz) { florz = daz2; florhit = j + 49152 }
          }
        }
      }
    }
    return { ceilz, ceilhit, florz, florhit }
  }

  clipInsideBoxLine (x, y, [x1, y1, x2, y2], walldist) {
    // Whether the segment passes within walldist of (x, y), by the box test of clipinsideboxline
    const r = walldist << 1
    x1 += walldist - x; x2 += walldist - x
    if (x1 < 0 && x2 < 0) return false
    if (x1 >= r && x2 >= r) return false
    y1 += walldist - y; y2 += walldist - y
    if (y1 < 0 && y2 < 0) return false
    if (y1 >= r && y2 >= r) return false
    x2 -= x1; y2 -= y1
    if (x2 * (walldist - y1) >= y2 * (walldist - x1)) {
      const a = x2 * (x2 > 0 ? 0 - y1 : r - y1), b = y2 * (y2 > 0 ? r - x1 : 0 - x1)
      return a < b
    }
    const a = x2 * (x2 > 0 ? r - y1 : 0 - y1), b = y2 * (y2 > 0 ? 0 - x1 : r - x1)
    return a >= b
  }

  floorSpriteCorners (spr) {
    const t = this.tile(spr.picnum)
    let xoff = t.xo + spr.xoffset, yoff = t.yo + spr.yoffset
    if (spr.cstat & 4) xoff = -xoff
    if (spr.cstat & 8) yoff = -yoff
    const ang = spr.ang
    const cosang = this.trig.sintable[(ang + 512) & 2047], sinang = this.trig.sintable[ang & 2047]
    const xspan = t.w, xrepeat = spr.xrepeat, yspan = t.h, yrepeat = spr.yrepeat
    let dax = ((xspan >> 1) + xoff) * xrepeat, day = ((yspan >> 1) + yoff) * yrepeat
    const x1 = spr.x + dmulscale(sinang, dax, cosang, day, 16), y1 = spr.y + dmulscale(sinang, day, -cosang, dax, 16)
    const l = xspan * xrepeat
    const x2 = x1 - mulscale(sinang, l, 16), y2 = y1 + mulscale(cosang, l, 16)
    const l2 = yspan * yrepeat
    const k = -mulscale(cosang, l2, 16), m = -mulscale(sinang, l2, 16)
    return [[x1, y1], [x2, y2], [x2 + k, y2 + m], [x1 + k, y1 + m]]
  }

  insideFloorSprite (spr, x, y, walldist) {
    const c = this.floorSpriteCorners(spr)
    // Inside the rectangle grown by walldist (the corners' bounding test, then the edges)
    let inside = true
    for (let i = 0; i < 4 && inside; i++) {
      const [ax, ay] = c[i], [bx, by] = c[(i + 1) & 3]
      const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
      const len = Math.hypot(bx - ax, by - ay) || 1
      if (cross / len < -walldist) inside = false
    }
    if (inside) return true
    // Wound the other way
    inside = true
    for (let i = 0; i < 4 && inside; i++) {
      const [ax, ay] = c[i], [bx, by] = c[(i + 1) & 3]
      const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
      const len = Math.hypot(bx - ax, by - ay) || 1
      if (cross / len > walldist) inside = false
    }
    return inside
  }

  // --- hitscan, cansee, neartag ---

  /**
   * Build's hitscan: the first thing a ray from (x, y, z) in sector `sectnum` along (vx, vy, vz) hits. vz is in the
   * ray's own scale (Build: z per 16384 of x and y). Returns { sect, wall, sprite, x, y, z }.
   */
  hitscan (x, y, z, sectnum, vx, vy, vz, cliptype, goal = null) {
    const walls = this.world.walls, sectors = this.world.sectors, sprites = this.world.sprites
    const dawalclipmask = cliptype & 65535, dasprclipmask = cliptype >>> 16
    // (Build's hitscangoal: the first "hit" is the goal, so nothing farther than it, by |dx| + |dy|, is hit)
    const hit = { sect: -1, wall: -1, sprite: -1, x: goal ? goal.x : 0x1fffffff, y: goal ? goal.y : 0x1fffffff, z: 0 }
    if (sectnum < 0) return hit
    const clipsectorlist = [sectnum]
    for (let c = 0; c < clipsectorlist.length; c++) {
      const dasector = clipsectorlist[c], sec = sectors[dasector]
      // Ceiling and floor
      for (const ceiling of [true, false]) {
        const stat = ceiling ? sec.ceilingstat : sec.floorstat
        const zp = ceiling ? sec.ceilingz : sec.floorz
        if (!(stat & 2)) {
          if (ceiling ? vz < 0 : vz > 0) {
            const i = zp - z
            if (ceiling ? (i < 0) : (i > 0)) {
              // (i / vz) of the ray, in Build's scale
              const t = i / vz
              const nx = x + Math.trunc(vx * t), ny = y + Math.trunc(vy * t)
              if (Math.abs(nx - x) + Math.abs(ny - y) < Math.abs(hit.x - x) + Math.abs(hit.y - y) && this.inside(nx, ny, dasector) === 1) {
                Object.assign(hit, { sect: dasector, wall: -1, sprite: -1, x: nx, y: ny, z: zp })
              }
            }
          }
        } else {
          // Sloped: step along the ray to where it crosses (the plane is linear, so a closed form)
          const w = walls[sec.wallptr], w2 = walls[w.point2]
          const wx = w2.x - w.x, wy = w2.y - w.y
          const len = Math.sqrt(wx * wx + wy * wy) * 256
          if (len) {
            const heinum = ceiling ? sec.ceilingheinum : sec.floorheinum
            // z(p) = zp + heinum * (wx * (py - w.y) - wy * (px - w.x)) / len
            const a = heinum * (wx * vy - wy * vx) / len
            const z0 = zp + heinum * (wx * (y - w.y) - wy * (x - w.x)) / len
            const denom = vz - a
            if (denom) {
              const t = (z0 - z) / denom
              if (t > 0) {
                const nx = x + Math.trunc(vx * t), ny = y + Math.trunc(vy * t)
                if (Math.abs(nx - x) + Math.abs(ny - y) < Math.abs(hit.x - x) + Math.abs(hit.y - y) && this.inside(nx, ny, dasector) === 1) {
                  Object.assign(hit, { sect: dasector, wall: -1, sprite: -1, x: nx, y: ny, z: Math.trunc(z + vz * t) })
                }
              }
            }
          }
        }
      }
      // Walls
      for (let j = sec.wallptr, n = sec.wallnum; n > 0; j++, n--) {
        const wal = walls[j], wal2 = walls[wal.point2]
        const x1 = wal.x, y1 = wal.y, x2 = wal2.x, y2 = wal2.y
        if ((x1 - x) * (y2 - y) < (x2 - x) * (y1 - y)) continue
        const r = this.rintersect(x, y, z, vx, vy, vz, x1, y1, x2, y2)
        if (!r) continue
        if (Math.abs(r.x - x) + Math.abs(r.y - y) >= Math.abs(hit.x - x) + Math.abs(hit.y - y)) continue
        const nextsector = wal.nextsector
        if (nextsector < 0 || (wal.cstat & dawalclipmask)) {
          Object.assign(hit, { sect: dasector, wall: j, sprite: -1, x: r.x, y: r.y, z: r.z })
          continue
        }
        const cz = this.getceilzofslope(nextsector, r.x, r.y), fz = this.getflorzofslope(nextsector, r.x, r.y)
        if (r.z <= cz || r.z >= fz) {
          Object.assign(hit, { sect: dasector, wall: j, sprite: -1, x: r.x, y: r.y, z: r.z })
          continue
        }
        if (!clipsectorlist.includes(nextsector)) clipsectorlist.push(nextsector)
      }
      // Sprites
      if (dasprclipmask) {
        for (const z1 of this.spritesIn(dasector)) {
          const spr = sprites[z1]
          if (!(spr.cstat & dasprclipmask)) continue
          const t = this.tile(spr.picnum)
          const x1 = spr.x, y1 = spr.y
          const kind = spr.cstat & 48
          if (kind === 0) {
            const topt = vx * (x1 - x) + vy * (y1 - y)
            if (topt <= 0) continue
            const bot = vx * vx + vy * vy
            if (bot === 0) continue
            const intz = z + scale(vz, topt, bot)
            const h = (t.h * spr.yrepeat) << 2
            let zb = spr.cstat & 128 ? spr.z + (h >> 1) : spr.z
            if (t.yo) zb -= (t.yo * spr.yrepeat) << 2
            if (intz > zb || intz < zb - h) continue
            const topu = vx * (y1 - y) - vy * (x1 - x)
            const offx = scale(vx, topu, bot), offy = scale(vy, topu, bot)
            const dist = offx * offx + offy * offy
            // (Build's: the square of tilesizx * xrepeat, in 32 bits, >> 7)
            const w = t.w * spr.xrepeat
            if (dist > (Math.imul(w, w) >> 7)) continue
            const intx = x + scale(vx, topt, bot), inty = y + scale(vy, topt, bot)
            if (Math.abs(intx - x) + Math.abs(inty - y) > Math.abs(hit.x - x) + Math.abs(hit.y - y)) continue
            Object.assign(hit, { sect: dasector, wall: -1, sprite: z1, x: intx, y: inty, z: intz })
          } else if (kind === 16) {
            const ends = this.wallSpriteEnds(spr)
            if (!ends) continue
            const r = this.rintersect(x, y, z, vx, vy, vz, ends[0], ends[1], ends[2], ends[3])
            if (!r) continue
            if (Math.abs(r.x - x) + Math.abs(r.y - y) > Math.abs(hit.x - x) + Math.abs(hit.y - y)) continue
            const h = (t.h * spr.yrepeat) << 2
            let zb = spr.cstat & 128 ? spr.z + (h >> 1) : spr.z
            if (t.yo) zb -= (t.yo * spr.yrepeat) << 2
            if (r.z < zb && r.z > zb - h) Object.assign(hit, { sect: dasector, wall: -1, sprite: z1, x: r.x, y: r.y, z: r.z })
          } else if (kind === 32) {
            if (vz === 0 || ((spr.z - z) ^ vz) < 0) continue
            const tt = (spr.z - z) / vz
            const intx = x + Math.trunc(vx * tt), inty = y + Math.trunc(vy * tt)
            if (Math.abs(intx - x) + Math.abs(inty - y) > Math.abs(hit.x - x) + Math.abs(hit.y - y)) continue
            if (this.insideFloorSprite(spr, intx, inty, 0)) Object.assign(hit, { sect: dasector, wall: -1, sprite: z1, x: intx, y: inty, z: spr.z })
          }
        }
      }
    }
    return hit
  }

  /** Build's cansee: whether (x1, y1, z1) in sect1 can see (x2, y2, z2) in sect2 */
  cansee (x1, y1, z1, sect1, x2, y2, z2, sect2) {
    if (sect1 < 0 || sect2 < 0) return false
    const walls = this.world.walls, sectors = this.world.sectors
    const x21 = x2 - x1, y21 = y2 - y1, z21 = z2 - z1
    if (x1 === x2 && y1 === y2) return sect1 === sect2
    const list = [sect1]
    for (let c = 0; c < list.length; c++) {
      const dasectnum = list[c], sec = sectors[dasectnum]
      for (let i = sec.wallptr, n = sec.wallnum; n > 0; i++, n--) {
        const wal = walls[i], wal2 = walls[wal.point2]
        const x31 = wal.x - x1, x34 = wal.x - wal2.x
        const y31 = wal.y - y1, y34 = wal.y - wal2.y
        const bot = y21 * x34 - x21 * y34
        if (bot <= 0) continue
        const t = y21 * x31 - x21 * y31
        if (t < 0 || t >= bot) continue
        const t2 = y31 * x34 - x31 * y34
        if (t2 < 0 || t2 >= bot) continue
        const nexts = wal.nextsector
        if (nexts < 0 || (wal.cstat & 32)) return false
        const tt = divscale(t2, bot, 24)
        const x = x1 + mulscale(x21, tt, 24), y = y1 + mulscale(y21, tt, 24), z = z1 + mulscale(z21, tt, 24)
        const cz = this.getceilzofslope(dasectnum, x, y), fz = this.getflorzofslope(dasectnum, x, y)
        if (z <= cz || z >= fz) return false
        const ncz = this.getceilzofslope(nexts, x, y), nfz = this.getflorzofslope(nexts, x, y)
        if (z <= ncz || z >= nfz) return false
        if (!list.includes(nexts)) list.push(nexts)
      }
    }
    return list.includes(sect2)
  }

  /**
   * Build's neartag, as far as Blood uses it: the nearest wall, sector and sprite with a tag (Blood: an extra)
   * that a ray of `range` from the eye along `ang` reaches. Returns { sector, wall, sprite, dist }.
   */
  neartag (x, y, z, sectnum, ang, range, tagsearch, test) {
    const out = { sector: -1, wall: -1, sprite: -1, dist: 0 }
    if (sectnum < 0 || range <= 0) return out
    const walls = this.world.walls, sectors = this.world.sectors, sprites = this.world.sprites
    const vx = mulscale(this.trig.sintable[(ang + 2560) & 2047], range, 14)
    const vy = mulscale(this.trig.sintable[(ang + 2048) & 2047], range, 14)
    let xe = x + vx, ye = y + vy
    const list = [sectnum]
    const tagged = test || ((o) => o.lotag || o.hitag)
    for (let c = 0; c < list.length; c++) {
      const dasector = list[c], sec = sectors[dasector]
      for (let z1 = sec.wallptr, n = sec.wallnum; n > 0; z1++, n--) {
        const wal = walls[z1], wal2 = walls[wal.point2]
        const nextsector = wal.nextsector
        const x1 = wal.x, y1 = wal.y, x2 = wal2.x, y2 = wal2.y
        if ((x1 - x) * (y2 - y) < (x2 - x) * (y1 - y)) continue
        const r = this.rintersect(x, y, z, vx, vy, 0, x1, y1, x2, y2)
        if (!r) continue
        let good = 0
        if (nextsector >= 0 && (tagsearch & 1) && tagged(sectors[nextsector], 'sector', nextsector)) { out.sector = nextsector; good = 1 }
        if ((tagsearch & 1) && tagged(wal, 'wall', z1)) { out.wall = z1; good = 1 }
        if (good) {
          out.dist = dmulscale(r.x - x, this.trig.sintable[(ang + 2560) & 2047], r.y - y, this.trig.sintable[(ang + 2048) & 2047], 14)
          xe = r.x; ye = r.y
        }
        if (nextsector >= 0) {
          const cz = this.getceilzofslope(nextsector, r.x, r.y), fz = this.getflorzofslope(nextsector, r.x, r.y)
          if (z >= cz && z <= fz && !list.includes(nextsector)) list.push(nextsector)
        }
      }
      if (tagsearch & 2) {
        for (const z1 of this.spritesIn(dasector)) {
          const spr = sprites[z1]
          if (!tagged(spr, 'sprite', z1)) continue
          const x1 = spr.x, y1 = spr.y
          const topt = vx * (x1 - x) + vy * (y1 - y)
          if (topt <= 0) continue
          const bot = vx * vx + vy * vy
          if (topt >= bot) continue
          const intx = x + scale(vx, topt, bot), inty = y + scale(vy, topt, bot)
          const t = this.tile(spr.picnum)
          const dx = intx - x1, dy = inty - y1
          const r = (t.w * spr.xrepeat) >> 2
          if (dx * dx + dy * dy > (r * r) >> 2 && Math.abs(dx) + Math.abs(dy) > (spr.clipdist << 2)) continue
          const h = (t.h * spr.yrepeat) << 2
          let zb = spr.cstat & 128 ? spr.z + (h >> 1) : spr.z
          if (t.yo) zb -= (t.yo * spr.yrepeat) << 2
          if (z > zb || z < zb - h) continue
          out.sprite = z1
          out.dist = dmulscale(intx - x, this.trig.sintable[(ang + 2560) & 2047], inty - y, this.trig.sintable[(ang + 2048) & 2047], 14)
          xe = intx; ye = inty
        }
      }
    }
    return out
  }
}

/** Build's clipinsideboxline: whether the line (x1, y1)-(x2, y2) meets the box of half-size walldist about (x, y) */
export function clipinsideboxline (x, y, x1, y1, x2, y2, walldist) {
  const r = walldist << 1
  x1 += walldist - x; x2 += walldist - x
  if (x1 < 0 && x2 < 0) return 0
  if (x1 >= r && x2 >= r) return 0
  y1 += walldist - y; y2 += walldist - y
  if (y1 < 0 && y2 < 0) return 0
  if (y1 >= r && y2 >= r) return 0
  x2 -= x1; y2 -= y1
  if (x2 * y1 >= y2 * x1) {
    const a = x2 > 0 ? x2 * (0 - y1) : x2 * (r - y1)
    const b = y2 > 0 ? y2 * (r - x1) : y2 * (0 - x1)
    return a < b ? 1 : 0
  }
  const a = x2 > 0 ? x2 * (r - y1) : x2 * (0 - y1)
  const b = y2 > 0 ? y2 * (0 - x1) : y2 * (r - x1)
  return a >= b ? 2 : 0
}
