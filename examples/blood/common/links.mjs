// Blood's sector links (room over room), worked out from a map's markers as Blood's warpInit does: an upper link
// marker (types 7, 9, 11, 13) in a sector makes its floor open onto the sector of the lower link (6, 10, 12, 14)
// with the same data1, whose ceiling opens back. Used by the client to draw through them; the server keeps its own.
import { slopeZ } from './build.mjs'

const UPPER = new Set([7, 9, 11, 13]), LOWER = new Set([6, 10, 12, 14])
export const WATER = new Set([9, 10, 13, 14])

/** { floors: Map(sector -> link), ceilings: Map(sector -> link) }; a link: { offset: [x, y, z], planeZ, water } */
export function mapLinks (map) {
  const up = [], low = []
  map.sprites.forEach((s) => {
    const type = s.lotag
    if (s.extra < 0 || s.statnum >= 1024) return
    const x = map.xsprites[s.extra]
    if (UPPER.has(type)) up.push({ s, data: x.data1, z: type === 7 ? s.z : slopeZ(map, s.sectnum, s.x, s.y, false) })
    if (LOWER.has(type)) low.push({ s, data: x.data1, z: type === 6 ? s.z : slopeZ(map, s.sectnum, s.x, s.y, true) })
  })
  const floors = new Map(), ceilings = new Map()
  for (const a of up) {
    const b = low.find((l) => l.data === a.data)
    if (!b) continue
    floors.set(a.s.sectnum, { sector: b.s.sectnum, offset: [a.s.x - b.s.x, a.s.y - b.s.y, a.z - b.z], planeZ: a.z, side: 1, water: WATER.has(a.s.lotag) })
    ceilings.set(b.s.sectnum, { sector: a.s.sectnum, offset: [b.s.x - a.s.x, b.s.y - a.s.y, b.z - a.z], planeZ: b.z, side: -1, water: WATER.has(b.s.lotag) })
  }
  return { floors, ceilings }
}
