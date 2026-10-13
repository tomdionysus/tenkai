/**
 * A picture dissolving in over another, as old games faded a new picture in without touching the palette: the
 * rectangle's columns and rows are shuffled once, and each step copies one pixel in every column, each column a
 * different shuffled row, so the new picture appears as scattered dots that fill in. After as many steps as the
 * rectangle has rows, every pixel has been copied (Dune II's GUI_Screen_FadeIn2).
 *
 * @example
// The new map over the old one, eight rows' worth a frame
const dissolve = new Dissolve({ x: 8, y: 24, width: 304, height: 120 })
// each frame:
dissolve.step(back, screen, 8)
if (dissolve.done) next()
 */
class Dissolve {
  /**
   * @param {object} options
   * @param {integer} options.x The rectangle's left
   * @param {integer} options.y The rectangle's top
   * @param {integer} options.width
   * @param {integer} options.height
   * @param {function} options.random `(n) => an integer from 0 to n - 1` (default Math.random's)
   * @param {boolean} options.skipZero Whether pixels of colour 0 in the source are left alone (default false)
   */
  constructor (options) {
    this.x = options.x
    this.y = options.y
    this.width = options.width
    this.height = options.height
    this.skipZero = !!options.skipZero
    const random = options.random || ((n) => Math.floor(Math.random() * n))
    this.columns = Dissolve.shuffled(this.width, random)
    this.rows = Dissolve.shuffled(this.height, random)
    /** Steps taken. */
    this.taken = 0
  }

  /** 0 to n - 1, each swapped with a random place in turn. */
  static shuffled (n, random) {
    const out = []
    for (let i = 0; i < n; i++) out.push(i)
    for (let i = 0; i < n; i++) {
      const j = random(n)
      const t = out[j]
      out[j] = out[i]
      out[i] = t
    }
    return out
  }

  /** Whether every pixel has been copied. */
  get done () {
    return this.taken >= this.height
  }

  /**
   * Copies the next steps' pixels from one surface to the other, at the same places.
   * @param {IndexedSurface} from
   * @param {IndexedSurface} to
   * @param {integer} steps How many steps (default 1)
   * @returns {boolean} Whether it is done
   */
  step (from, to, steps = 1) {
    for (let s = 0; s < steps && !this.done; s++) {
      let row = this.taken
      for (let i = 0; i < this.width; i++) {
        const x = this.x + this.columns[i]
        const y = this.y + this.rows[row]
        if (++row >= this.height) row = 0
        const colour = from.get(x, y)
        if (this.skipZero && colour === 0) continue
        to.set(x, y, colour)
      }
      this.taken++
    }
    return this.done
  }

  /** Copies what is left at once. */
  finish (from, to) {
    return this.step(from, to, this.height - this.taken)
  }
}

export default Dissolve
