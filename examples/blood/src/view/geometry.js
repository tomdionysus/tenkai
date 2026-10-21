// The map's surfaces as triangles for the view: each sector's floor and ceiling, and the walls on its side, with
// texture coordinates in texels as Build lays tiles on them. A vertex is FLOATS numbers:
//   x, y, z (Build's), u, v (texels of the tile), picnum, shade, pal, flags, visibility
// Every sector gives the same number of vertices whatever its heights (empty parts are degenerate), so a moving
// floor or ceiling is redrawn by rewriting its sector's range of the buffer.
import earcut from 'earcut'
import { slopeZ, loops, pow2 } from '../../common/build.mjs'

export const FLOATS = 10
export const MASKED = 1, TRANSLUCENT = 2, TRANSLUCENT_MORE = 4, SKY = 8, FULLBRIGHT = 16, ONE_SIDED = 32, PORTAL = 64

const pushVertex = (out, x, y, z, u, v, picnum, shade, pal, flags, vis) => { out.push(x, y, z, u, v, picnum, shade, pal, flags, vis) }

export function sectorVisibility (map, s) {
  const v = map.sectors[s].visibility
  return v ? map.visibility * (((v + 16) & 255) / 16) : map.visibility
}

/** A floor's or ceiling's texture coordinates at a point (Build's floor alignment, stat bits 2, 3, 4, 5, 6). */
function planeUV (map, s, x, y, ceiling, tiles) {
  const sec = map.sectors[s]
  const stat = ceiling ? sec.ceilingstat : sec.floorstat
  const pic = ceiling ? sec.ceilingpicnum : sec.floorpicnum
  const xpan = ceiling ? sec.ceilingxpanning : sec.floorxpanning
  const ypan = ceiling ? sec.ceilingypanning : sec.floorypanning
  const t = tiles[pic] || { w: 64, h: 64 }
  let u = x, v = y
  if (stat & 64) {
    // Relative alignment: from the first wall's start, along it
    const w = map.walls[sec.wallptr], w2 = map.walls[w.point2]
    const dx = w2.x - w.x, dy = w2.y - w.y, len = Math.hypot(dx, dy) || 1
    const px = x - w.x, py = y - w.y
    u = (px * dx + py * dy) / len
    v = (py * dx - px * dy) / len
  }
  const scale = stat & 8 ? 8 : 16
  u /= scale; v /= scale
  if (stat & 4) { const k = u; u = v; v = k }
  if (stat & 16) u = -u
  if (stat & 32) v = -v
  u += xpan * pow2(t.w) / 256
  v += ypan * pow2(t.h) / 256
  return [u, v]
}

function plane (out, map, s, ceiling, tiles, polygons, links) {
  const sec = map.sectors[s]
  const stat = ceiling ? sec.ceilingstat : sec.floorstat
  const pic = ceiling ? sec.ceilingpicnum : sec.floorpicnum
  const shade = ceiling ? sec.ceilingshade : sec.floorshade
  const pal = ceiling ? sec.ceilingpal : sec.floorpal
  let flags = stat & 1 ? SKY : 0
  // A floor or ceiling that opens onto a linked sector (room over room) is drawn through, as a portal
  if (links && (ceiling ? links.ceilings : links.floors).has(s)) flags = PORTAL
  const vis = sectorVisibility(map, s)
  const { points, triangles } = polygons
  for (let k = 0; k < triangles.length; k += 3) {
    // Build's loops run clockwise seen from above; floors face up, ceilings down: both are drawn without culling
    for (const i of [triangles[k], triangles[k + 1], triangles[k + 2]]) {
      const x = points[i * 2], y = points[i * 2 + 1]
      const [u, v] = planeUV(map, s, x, y, ceiling, tiles)
      pushVertex(out, x, y, slopeZ(map, s, x, y, ceiling), u, v, pic, shade, pal, flags, vis)
    }
  }
}

/** The triangles of a sector's polygon (its loops, the first outer, the rest holes), made once per map. */
export function triangulate (map, s) {
  const points = [], holes = []
  for (const loop of loops(map, s)) {
    if (points.length) holes.push(points.length / 2)
    for (const i of loop) points.push(map.walls[i].x, map.walls[i].y)
  }
  let triangles = earcut(points, holes)
  if (!triangles.length && points.length >= 6) triangles = earcut(points)
  return { points, triangles }
}

/** One quad of a wall from (x1, y1) to (x2, y2), between z tops and bottoms at each end, textured from a reference z. */
function quad (out, x1, y1, x2, y2, top1, top2, bot1, bot2, w, pic, refz, tiles, flags, vis, shade, pal, xflip) {
  if (top1 >= bot1 && top2 >= bot2) { for (let i = 0; i < 6; i++) pushVertex(out, x1, y1, top1, 0, 0, pic, shade, pal, flags, vis); return }
  const t = tiles[pic] || { w: 64, h: 64 }
  const span = w.xrepeat * 8
  let u1 = w.xpanning, u2 = w.xpanning + span
  if (xflip) { u1 = w.xpanning + span; u2 = w.xpanning }
  const yscale = w.yrepeat / 2048
  const ypan = w.ypanning * pow2(t.h) / 256
  const vflip = w.cstat & 256 ? -1 : 1
  const v = (z) => ((z - refz) * yscale + ypan) * vflip
  const a = [x1, y1, top1, u1, v(top1)], b = [x2, y2, top2, u2, v(top2)], c = [x2, y2, bot2, u2, v(bot2)], d = [x1, y1, bot1, u1, v(bot1)]
  for (const p of [a, b, c, a, c, d]) pushVertex(out, p[0], p[1], p[2], p[3], p[4], pic, shade, pal, flags, vis)
}

/** The quads of one wall, as seen from its sector: solid, or upper and lower parts and a masked middle. 18 vertices. */
function wall (out, map, s, i, tiles) {
  const w = map.walls[i], w2 = map.walls[w.point2]
  const sec = map.sectors[s]
  const vis = sectorVisibility(map, s)
  const cz1 = slopeZ(map, s, w.x, w.y, true), cz2 = slopeZ(map, s, w2.x, w2.y, true)
  const fz1 = slopeZ(map, s, w.x, w.y, false), fz2 = slopeZ(map, s, w2.x, w2.y, false)
  const xflip = !!(w.cstat & 8)
  if (w.nextsector < 0) {
    const refz = w.cstat & 4 ? sec.floorz : sec.ceilingz
    quad(out, w.x, w.y, w2.x, w2.y, cz1, cz2, fz1, fz2, w, w.picnum, refz, tiles, 0, vis, w.shade, w.pal, xflip)
    for (let k = 0; k < 12; k++) pushVertex(out, w.x, w.y, cz1, 0, 0, 0, 0, 0, 0, vis)
    return
  }
  const n = w.nextsector, nsec = map.sectors[n]
  const ncz1 = slopeZ(map, n, w.x, w.y, true), ncz2 = slopeZ(map, n, w2.x, w2.y, true)
  const nfz1 = slopeZ(map, n, w.x, w.y, false), nfz2 = slopeZ(map, n, w2.x, w2.y, false)
  // Upper: from this ceiling down to the next one (not between two skies)
  const bothSky = (sec.ceilingstat & 1) && (nsec.ceilingstat & 1)
  if (bothSky) for (let k = 0; k < 6; k++) pushVertex(out, w.x, w.y, cz1, 0, 0, 0, 0, 0, 0, vis)
  else quad(out, w.x, w.y, w2.x, w2.y, cz1, cz2, Math.max(cz1, Math.min(ncz1, fz1)), Math.max(cz2, Math.min(ncz2, fz2)), w, w.picnum, w.cstat & 4 ? sec.ceilingz : nsec.ceilingz, tiles, 0, vis, w.shade, w.pal, xflip)
  // Lower: from the next floor down to this one; with cstat 2 it shows the other side's picture and panning
  const bothFloorSky = (sec.floorstat & 1) && (nsec.floorstat & 1)
  const low = w.cstat & 2 ? map.walls[w.nextwall] : w
  if (bothFloorSky) for (let k = 0; k < 6; k++) pushVertex(out, w.x, w.y, fz1, 0, 0, 0, 0, 0, 0, vis)
  else quad(out, w.x, w.y, w2.x, w2.y, Math.min(fz1, Math.max(nfz1, cz1)), Math.min(fz2, Math.max(nfz2, cz2)), fz1, fz2, low, low.picnum, w.cstat & 4 ? sec.ceilingz : nsec.floorz, tiles, 0, vis, low.shade, low.pal, xflip)
  // Masked middle (cstat 16), in the opening between the two sectors
  if (w.cstat & 16) {
    const refz = w.cstat & 4 ? Math.min(sec.floorz, nsec.floorz) : Math.max(sec.ceilingz, nsec.ceilingz)
    const flags = MASKED | (w.cstat & 128 ? (w.cstat & 512 ? TRANSLUCENT_MORE : TRANSLUCENT) : 0)
    quad(out, w.x, w.y, w2.x, w2.y, Math.max(cz1, ncz1), Math.max(cz2, ncz2), Math.min(fz1, nfz1), Math.min(fz2, nfz2), w, w.overpicnum, refz, tiles, flags, vis, w.shade, w.pal, xflip)
  } else for (let k = 0; k < 6; k++) pushVertex(out, w.x, w.y, cz1, 0, 0, 0, 0, 0, 0, vis)
}

/**
 * The geometry of the whole map: a Float32Array of every sector's vertices, the range of each sector (`first`,
 * `count` in vertices), and `update(s)`, which rewrites a sector's range after its heights, pictures or panning
 * changed and returns that range.
 */
export function mapGeometry (map, tiles, links = null) {
  const polygons = map.sectors.map((_, s) => triangulate(map, s))
  const ranges = []
  const parts = []
  let total = 0
  const sectorVertices = (s) => {
    const out = []
    plane(out, map, s, false, tiles, polygons[s], links)
    plane(out, map, s, true, tiles, polygons[s], links)
    const sec = map.sectors[s]
    for (let i = sec.wallptr; i < sec.wallptr + sec.wallnum; i++) wall(out, map, s, i, tiles)
    return out
  }
  for (let s = 0; s < map.sectors.length; s++) {
    const v = sectorVertices(s)
    ranges.push({ first: total, count: v.length / FLOATS })
    parts.push(v)
    total += v.length / FLOATS
  }
  const data = new Float32Array(total * FLOATS)
  parts.forEach((v, s) => data.set(v, ranges[s].first * FLOATS))
  return {
    data,
    ranges,
    polygons,
    update (s) {
      const v = sectorVertices(s)
      if (v.length / FLOATS !== ranges[s].count) throw new Error('sector ' + s + ' changed its vertex count')
      data.set(v, ranges[s].first * FLOATS)
      return ranges[s]
    }
  }
}
