// The client's copy of the level: the map from data/ with the server's changes laid over it (moved sectors and walls),
// and the sprites and players as the server last said, kept for drawing between ticks. No game logic: what the server
// says is what there is.
const SPRITE_FIELDS = ['x', 'y', 'z', 'ang', 'picnum', 'cstat', 'shade', 'pal', 'xrepeat', 'yrepeat', 'xoffset', 'yoffset', 'sectnum']
const SECTOR_FIELDS = ['ceilingz', 'floorz', 'ceilingpicnum', 'floorpicnum', 'ceilingshade', 'floorshade', 'ceilingxpanning', 'ceilingypanning', 'floorxpanning', 'floorypanning', 'ceilingstat', 'floorstat', 'visibility']
const WALL_FIELDS = ['x', 'y', 'picnum', 'overpicnum', 'shade', 'cstat', 'xpanning', 'ypanning', 'pal']

export default class World {
  /** @param {object} map The map as data/maps/<name>.json holds it */
  constructor (map) {
    this.map = map
    this.atLoad = { sectors: map.sectors.map((s) => SECTOR_FIELDS.map((f) => s[f])), walls: map.walls.map((w) => WALL_FIELDS.map((f) => w[f])) }
    this.applied = { sectors: {}, walls: {} }
    this.wallSector = new Int32Array(map.walls.length)
    map.sectors.forEach((s, i) => { for (let w = s.wallptr; w < s.wallptr + s.wallnum; w++) this.wallSector[w] = i })
  }

  /**
   * The server's sectors and walls laid over the map; returns the sectors whose drawing changed (with their
   * neighbours' walls: the view redraws them)
   */
  apply (state) {
    const changed = new Set()
    const lay = (kind, list, fields, objects) => {
      const now = state[kind] || {}
      const before = this.applied[kind]
      // Back to the map's values for any that are no longer sent
      for (const k of Object.keys(before)) if (!(k in now)) { this.set(objects[k], fields, this.atLoad[kind][k]); delete before[k]; changed.add(kind === 'sectors' ? Number(k) : this.wallSector[k]) }
      for (const [k, v] of Object.entries(now)) {
        const b = before[k]
        if (b && b.every((x, i) => x === v[i])) continue
        this.set(objects[k], fields, v)
        before[k] = v
        changed.add(kind === 'sectors' ? Number(k) : this.wallSector[k])
      }
    }
    lay('sectors', null, SECTOR_FIELDS, this.map.sectors)
    lay('walls', null, WALL_FIELDS, this.map.walls)
    return changed
  }

  set (o, fields, values) { fields.forEach((f, i) => { o[f] = values[i] }) }

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
