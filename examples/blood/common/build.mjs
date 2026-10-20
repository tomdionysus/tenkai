// The Build engine's map arithmetic, shared by the server (the game) and the client (the view). Plain JavaScript,
// no Tenkai. Coordinates are Build's: x east, y south, z down; z is 16 times finer than x and y; angles are 0-2047
// from east towards south.

export const ANGLES = 2048
export const TAU = Math.PI * 2

/** The z of a sector's floor (or ceiling) at a point, with its slope (Build's getflorzofslope). */
export function slopeZ (map, sectnum, x, y, ceiling) {
  const s = map.sectors[sectnum]
  const z = ceiling ? s.ceilingz : s.floorz
  const stat = ceiling ? s.ceilingstat : s.floorstat
  const heinum = ceiling ? s.ceilingheinum : s.floorheinum
  if (!(stat & 2) || !heinum) return z
  const w = map.walls[s.wallptr], w2 = map.walls[w.point2]
  const dx = w2.x - w.x, dy = w2.y - w.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (!len) return z
  const j = (dx * (y - w.y) - dy * (x - w.x)) / 8
  return z + heinum * j / (len * 32)
}

export const floorZ = (map, s, x, y) => slopeZ(map, s, x, y, false)
export const ceilingZ = (map, s, x, y) => slopeZ(map, s, x, y, true)

/** A sector's wall loops: arrays of wall numbers, the first the outer loop (Build closes a loop where point2 goes back). */
export function loops (map, sectnum) {
  const s = map.sectors[sectnum]
  const out = []
  let loop = []
  for (let i = s.wallptr; i < s.wallptr + s.wallnum; i++) {
    loop.push(i)
    if (map.walls[i].point2 < i) { out.push(loop); loop = [] }
  }
  if (loop.length) out.push(loop)
  return out
}

/** Whether a point is inside a sector (Build's inside: crossings of its walls). */
export function inside (map, x, y, sectnum) {
  const s = map.sectors[sectnum]
  if (!s) return false
  let c = 0
  for (let i = s.wallptr; i < s.wallptr + s.wallnum; i++) {
    const w = map.walls[i], w2 = map.walls[w.point2]
    const y1 = w.y - y, y2 = w2.y - y
    if ((y1 ^ y2) < 0) {
      const x1 = w.x - x, x2 = w2.x - x
      if ((x1 ^ x2) >= 0) c ^= x1
      else c ^= (x1 * y2 - x2 * y1) ^ y2
    }
  }
  return (c >>> 31) === 1
}

/** The sector a point is in, starting the search from a guess and its neighbours (Build's updatesector). */
export function findSector (map, x, y, guess = -1) {
  if (guess >= 0 && inside(map, x, y, guess)) return guess
  if (guess >= 0) {
    const s = map.sectors[guess]
    for (let i = s.wallptr; i < s.wallptr + s.wallnum; i++) {
      const n = map.walls[i].nextsector
      if (n >= 0 && inside(map, x, y, n)) return n
    }
  }
  for (let i = 0; i < map.sectors.length; i++) if (inside(map, x, y, i)) return i
  return -1
}

/** The tile number shown for a tile at a time, by its animation (Build's animateoffs; Blood's clock is 120 Hz). */
export function animate (tiles, picnum, clock) {
  const t = tiles[picnum]
  if (!t || !t.anim || !t.frames) return picnum
  const i = Math.floor(clock / (1 << t.speed))
  const n = t.frames
  if (t.anim === 1) { const k = i % (n * 2); return picnum + (k < n ? k : n * 2 - k) }
  if (t.anim === 2) return picnum + i % (n + 1)
  if (t.anim === 3) return picnum - i % (n + 1)
  return picnum
}

export const pow2 = (n) => { let p = 1; while (p < n) p <<= 1; return p }
