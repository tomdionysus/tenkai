// The client's copy of the level: the map's fixed shape from data/ (which walls make which sectors, what is beyond
// each wall), with everything that can change laid over it from the server's state each tick (every sector's
// heights and surfaces, every wall's place and surface), and the sprites and players as the server last said, kept
// for drawing between ticks. No game logic and nothing of its own: what the server says is what there is.
const SPRITE_FIELDS = ['x', 'y', 'z', 'ang', 'picnum', 'cstat', 'shade', 'pal', 'xrepeat', 'yrepeat', 'xoffset', 'yoffset', 'sectnum']
const SECTOR_FIELDS = ['ceilingz', 'floorz', 'ceilingpicnum', 'floorpicnum', 'ceilingshade', 'floorshade', 'ceilingxpanning', 'ceilingypanning', 'floorxpanning', 'floorypanning', 'ceilingstat', 'floorstat', 'visibility']
const WALL_FIELDS = ['x', 'y', 'picnum', 'overpicnum', 'shade', 'cstat', 'xpanning', 'ypanning', 'pal']

export default class World {
  /** @param {object} map The map as data/maps/<name>.json holds it */
  constructor (map) {
    this.map = map
    this.applied = { sectors: [], walls: [] }
    this.wallSector = new Int32Array(map.walls.length)
    map.sectors.forEach((s, i) => { for (let w = s.wallptr; w < s.wallptr + s.wallnum; w++) this.wallSector[w] = i })
  }

  /**
   * The server's sectors and walls laid over the map; returns the sectors whose drawing changed (a wall's sector
   * with it: the view redraws them)
   */
  apply (state) {
    const changed = new Set()
    const lay = (list, fields, objects, applied, sectorOf) => {
      if (!list) return
      for (let k = 0; k < list.length; k++) {
        const v = list[k], b = applied[k]
        if (!v || v === b) continue
        if (b && b.length === v.length && b.every((x, i) => x === v[i])) { applied[k] = v; continue }
        fields.forEach((f, i) => { objects[k][f] = v[i] })
        applied[k] = v
        changed.add(sectorOf(k))
      }
    }
    lay(state.sectors, SECTOR_FIELDS, this.map.sectors, this.applied.sectors, (k) => k)
    lay(state.walls, WALL_FIELDS, this.map.walls, this.applied.walls, (k) => this.wallSector[k])
    return changed
  }

  /** The sprites to draw, between the last two states by `t` (0 the earlier, 1 the later), less one sprite (the viewer's) */
  sprites (previous, state, t, skip = -1) {
    const out = []
    const prev = (previous && previous.sprites) || {}
    for (const [k, a] of Object.entries(state.sprites || {})) {
      if (Number(k) === skip) continue
      const s = {}
      SPRITE_FIELDS.forEach((f, i) => { s[f] = a[i] })
      const p = prev[k]
      if (p && t < 1 && Math.abs(p[0] - a[0]) + Math.abs(p[1] - a[1]) < 2048) {
        s.x = p[0] + (a[0] - p[0]) * t
        s.y = p[1] + (a[1] - p[1]) * t
        s.z = p[2] + (a[2] - p[2]) * t
      }
      s.index = Number(k)
      out.push(s)
    }
    return out
  }
}
