// Which sectors the eye can see, as Build finds them: from the eye's sector out through the openings in its walls
// (the walls with a sector beyond), each opening narrowing the view's window across the screen to what is seen
// through it. A sector is reached when an opening into it is in the window; the list is in the order they are
// reached, near ones first, so drawing in that order lets the depth test spare the pixels hidden behind.
import { ANGLES, TAU } from '../../common/build.mjs'

const NEAR = 8
// Openings nearer than this to the eye are looked through whole (the eye may stand in them)
const CLOSE = 160

/** Whether a point is in a sector (its walls crossed an odd number of times by a ray from the point) */
export function inside (map, s, x, y) {
  const sec = map.sectors[s]
  if (!sec) return false
  let c = false
  for (let i = sec.wallptr; i < sec.wallptr + sec.wallnum; i++) {
    const a = map.walls[i], b = map.walls[a.point2]
    if ((a.y > y) !== (b.y > y) && x < a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y)) c = !c
  }
  return c
}

/** The sector a point is in, looked for first in `hint` and the sectors next to it, then everywhere; -1 if none */
export function findSector (map, x, y, hint) {
  if (hint >= 0 && inside(map, hint, x, y)) return hint
  if (hint >= 0 && map.sectors[hint]) {
    const sec = map.sectors[hint]
    for (let i = sec.wallptr; i < sec.wallptr + sec.wallnum; i++) {
      const n = map.walls[i].nextsector
      if (n >= 0 && inside(map, n, x, y)) return n
    }
  }
  for (let s = 0; s < map.sectors.length; s++) if (inside(map, s, x, y)) return s
  return hint
}

/** Whether nothing can be seen between two sectors (a shut door): both flat, the gap between them closed */
function shut (a, b) {
  if ((a.floorstat | a.ceilingstat | b.floorstat | b.ceilingstat) & 2) return false
  if ((a.ceilingstat & 1) && (b.ceilingstat & 1)) return false
  return Math.min(a.floorz, b.floorz) <= Math.max(a.ceilingz, b.ceilingz)
}

/**
 * The sectors seen from `eye` ({ x, y, ang }) standing in sector `start`, with the screen `tan` wide each side
 * (x / depth at its edge), or only between lo0 and hi0 of it: an Int32Array of them in the order reached, and its length
 * @returns {{ list: Int32Array, count: number, seen: Uint8Array }}
 */
export function visibleSectors (map, eye, start, tan, out, lo0 = -tan, hi0 = tan) {
  const n = map.sectors.length
  if (!out || out.seen.length !== n) out = { list: new Int32Array(n), count: 0, seen: new Uint8Array(n), lo: new Float64Array(n), hi: new Float64Array(n), queue: new Int32Array(n * 8) }
  const { list, seen, lo, hi, queue } = out
  seen.fill(0)
  out.count = 0
  if (start < 0 || start >= n) return out
  const a = eye.ang / ANGLES * TAU, fx = Math.cos(a), fy = Math.sin(a)
  const ex = eye.x, ey = eye.y
  let head = 0, tail = 0
  seen[start] = 1
  lo[start] = lo0
  hi[start] = hi0
  list[out.count++] = start
  queue[tail++] = start
  const walls = map.walls, sectors = map.sectors
  while (head < tail) {
    const s = queue[head++]
    const sec = sectors[s]
    for (let i = sec.wallptr; i < sec.wallptr + sec.wallnum; i++) {
      const w = walls[i], next = w.nextsector
      if (next < 0) continue
      if (shut(sec, sectors[next])) continue
      const w2 = walls[w.point2]
      const dax = w.x - ex, day = w.y - ey, dbx = w2.x - ex, dby = w2.y - ey
      let ax = dax * -fy + day * fx, az = dax * fx + day * fy
      let bx = dbx * -fy + dby * fx, bz = dbx * fx + dby * fy
      let l, h
      // The eye's distance to the opening: one it stands at is looked through whole
      const sx = w2.x - w.x, sy = w2.y - w.y, len2 = sx * sx + sy * sy
      const k = len2 ? Math.max(0, Math.min(1, -(dax * sx + day * sy) / len2)) : 0
      const px = dax + sx * k, py = day + sy * k
      if (px * px + py * py < CLOSE * CLOSE) { l = lo[s]; h = hi[s] } else {
        if (az < NEAR && bz < NEAR) continue
        // Cut at the near plane, then across the screen
        if (az < NEAR) { const t = (NEAR - az) / (bz - az); ax += (bx - ax) * t; az = NEAR }
        if (bz < NEAR) { const t = (NEAR - bz) / (az - bz); bx += (ax - bx) * t; bz = NEAR }
        const ta = ax / az, tb = bx / bz
        l = Math.max(lo[s], Math.min(ta, tb))
        h = Math.min(hi[s], Math.max(ta, tb))
      }
      if (l >= h) continue
      if (!seen[next]) {
        seen[next] = 1
        lo[next] = l
        hi[next] = h
        list[out.count++] = next
      } else if (l < lo[next] || h > hi[next]) {
        lo[next] = Math.min(lo[next], l)
        hi[next] = Math.max(hi[next], h)
      } else continue
      if (tail < queue.length) queue[tail++] = next
    }
  }
  return out
}
