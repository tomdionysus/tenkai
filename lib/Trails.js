/**
 * Where things were at the last two ticks, by key, to draw them between ticks: a game whose logic moves in steps
 * (its own fixed step, or a server's ticks) draws each thing part of the way from where it was at the tick before
 * to where it is now, so it moves smoothly at any frame rate. Give it every thing's position after each tick
 * (`tick`); ask for a position between (`between`). A thing seen for the first time is drawn where it is.
 *
 * @example
// after each tick:
trails.tick(characters.map((c) => [c.id, c.body]))
// each frame, a the fraction of the way to the next tick (0 to 1):
entity.world = trails.between(c.id, c.body, a)
 */
class Trails {
  constructor () {
    this.trails = new Map()
  }

  /**
   * A tick has run: each thing's position now (pairs of key and `{ x, y, z }`). Things not given are forgotten.
   * @param {Iterable} pairs [key, position] pairs
   */
  tick (pairs) {
    const seen = new Map()
    for (const [key, p] of pairs) {
      const t = this.trails.get(key)
      const at = { x: p.x, y: p.y, z: p.z || 0 }
      seen.set(key, { from: t ? t.last : at, last: at })
    }
    this.trails = seen
  }

  /** Where a thing was at the tick before, or `p` (where it is) if it is not known. */
  from (key, p) {
    const t = this.trails.get(key)
    return t ? t.from : p
  }

  /**
   * A thing's position `a` of the way (0 to 1) from where it was at the tick before to `p`, where it is now.
   * @returns {{x: number, y: number, z: number}}
   */
  between (key, p, a) {
    const f = this.from(key, p)
    const z = p.z || 0
    const fz = f.z || 0
    return { x: f.x + (p.x - f.x) * a, y: f.y + (p.y - f.y) * a, z: fz + (z - fz) * a }
  }

  /** Forget everything: the next frames draw things where they are (a new level, a jump). */
  clear () {
    this.trails = new Map()
  }
}

export default Trails
