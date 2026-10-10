/**
 * A Palette is a table of colours for indexed images: each pixel of an {@link IndexedSurface} is a number,
 * and the palette says what colour that number is when the surface is shown. Changing the palette changes
 * every pixel of that number at once, which is how palette games animate water and fire (colour cycling),
 * fade the screen, and darken a room without touching its pixels.
 *
 * Colours are stored as `colors`, a Uint8Array of red, green and blue for each entry in turn.
 *
 * @example
const palette = new Palette({ colors: roomColors })
// Entries 16 to 23 rotate one place every 8 steps, like flowing water
palette.addCycle({ start: 16, end: 23, delay: 8 })
// In update(dt), one call per step:
palette.advanceCycles(1)
 */
class Palette {
  /**
   * @param {object} options
   * @param {integer} options.size Number of entries (optional, default 256)
   * @param {number[]|Uint8Array} options.colors Initial red, green, blue values (optional, default black)
   */
  constructor (options = {}) {
    var size = options.size || 256
    this.colors = new Uint8Array(size * 3)
    if (options.colors) this.colors.set(options.colors.length > this.colors.length ? options.colors.slice(0, this.colors.length) : options.colors)
    this.cycles = []
  }

  /** The number of entries. */
  get size () { return this.colors.length / 3 }

  /**
   * Set one entry.
   * @param {integer} index
   * @param {integer} r
   * @param {integer} g
   * @param {integer} b
   */
  set (index, r, g, b) {
    this.colors[index * 3] = r
    this.colors[index * 3 + 1] = g
    this.colors[index * 3 + 2] = b
  }

  /**
   * One entry's colour.
   * @param {integer} index
   * @returns {integer[]} [r, g, b]
   */
  get (index) {
    return [this.colors[index * 3], this.colors[index * 3 + 1], this.colors[index * 3 + 2]]
  }

  /**
   * Copy a range of entries from red, green, blue values.
   * @param {number[]|Uint8Array} source Colours, three values per entry, indexed like this palette
   * @param {integer} start First entry (optional, default 0)
   * @param {integer} end Last entry, inclusive (optional, default the last)
   */
  load (source, start = 0, end = this.size - 1) {
    for (var i = start * 3; i < (end + 1) * 3 && i < source.length; i++) this.colors[i] = source[i]
  }

  /**
   * Set a range of entries to a source's colours scaled per channel, for fades and lighting. A scale of
   * 255 keeps the source's colour, 0 makes it black; results are rounded down and capped at `max`.
   * @param {number[]|Uint8Array} source Colours, three values per entry, indexed like this palette
   * @param {integer} start First entry
   * @param {integer} end Last entry, inclusive
   * @param {integer} r Red scale, 0 to 255
   * @param {integer} g Green scale
   * @param {integer} b Blue scale
   * @param {integer} max Largest value a channel may take (optional, default 255)
   */
  scale (source, start, end, r, g, b, max = 255) {
    var scales = [r, g, b]
    for (var i = start * 3; i < (end + 1) * 3; i++) this.colors[i] = Math.min(max, Math.floor(source[i] * scales[i % 3] / 255))
  }

  /**
   * The entry in a range closest to a colour, by the sum of the differences of its channels. With `bits`
   * below 8, both are compared at that precision (the palette's values shifted down), as a VGA's 6-bit
   * colour registers did; `r`, `g` and `b` are then given at that precision too.
   * @param {integer} r
   * @param {integer} g
   * @param {integer} b
   * @param {integer} start First entry to consider (optional, default 0)
   * @param {integer} end Last entry to consider, inclusive (optional, default the last)
   * @param {integer} bits Precision of the comparison (optional, default 8)
   * @returns {integer} The entry; the first of equally close ones
   */
  nearest (r, g, b, start = 0, end = this.size - 1, bits = 8) {
    var shift = 8 - bits
    var c = this.colors
    var best = start
    var bestSum = Infinity
    for (var j = start; j <= end; j++) {
      var sum = Math.abs((c[j * 3] >> shift) - r) + Math.abs((c[j * 3 + 1] >> shift) - g) + Math.abs((c[j * 3 + 2] >> shift) - b)
      if (sum < bestSum) {
        bestSum = sum
        best = j
      }
    }
    return best
  }

  /**
   * Rotate a range of entries one place: forward moves each colour to the next entry and the last to the
   * first.
   * @param {integer} start First entry
   * @param {integer} end Last entry, inclusive
   * @param {boolean} forward (optional, default true)
   */
  rotate (start, end, forward = true) {
    Palette.rotateRange(this.colors, start, end, forward, 3)
  }

  /**
   * Add a colour cycle: a range that rotates one place every `delay` units of whatever
   * [advanceCycles()]{@link Palette#advanceCycles} is given, such as steps or milliseconds.
   * @param {object} cycle
   * @param {integer} cycle.start First entry
   * @param {integer} cycle.end Last entry, inclusive
   * @param {number} cycle.delay Time between rotations; 0 holds the cycle still
   * @param {boolean} cycle.reverse Rotate backwards (optional, default false)
   * @returns {object} The cycle, whose properties may be changed later
   */
  addCycle (cycle) {
    var c = Object.assign({ reverse: false, counter: 0 }, cycle)
    this.cycles.push(c)
    return c
  }

  /** Remove every colour cycle. */
  clearCycles () {
    this.cycles = []
  }

  /**
   * Advance the colour cycles. Each counts the time given; once it reaches its delay it rotates one place
   * and keeps the remainder. A cycle rotates at most once per call.
   * @param {number} amount Time passed, in the units of the cycles' delays
   * @param {function} onRotate Called as `onRotate(cycle, forward)` after each rotation, to rotate anything
   * that must follow the palette, such as a remapping table (optional)
   */
  advanceCycles (amount, onRotate) {
    for (var c of this.cycles) {
      if (!c.delay || c.start > c.end) continue
      c.counter += amount
      if (c.counter < c.delay) continue
      c.counter %= c.delay
      this.rotate(c.start, c.end, !c.reverse)
      if (onRotate) onRotate(c, !c.reverse)
    }
  }

  /**
   * Rotate a range of entries of any table one place, where each entry is `size` values long.
   * @param {Uint8Array|Array} table
   * @param {integer} start First entry
   * @param {integer} end Last entry, inclusive
   * @param {boolean} forward Move each entry to the next, and the last to the first
   * @param {integer} size Values per entry (optional, default 1)
   */
  static rotateRange (table, start, end, forward, size = 1) {
    var tmp
    if (forward) {
      tmp = Array.prototype.slice.call(table, end * size, end * size + size)
      table.copyWithin((start + 1) * size, start * size, end * size)
      for (var i = 0; i < size; i++) table[start * size + i] = tmp[i]
    } else {
      tmp = Array.prototype.slice.call(table, start * size, start * size + size)
      table.copyWithin(start * size, (start + 1) * size, (end + 1) * size)
      for (i = 0; i < size; i++) table[end * size + i] = tmp[i]
    }
  }

  /**
   * Keep a remapping table (from colour to colour, such as a shadow table) pointing at the same colours
   * after the palette range it refers to has rotated: entries that point into the range move with it, and
   * the table's own entries for the range rotate too.
   * @param {Uint8Array|Array} table One colour index per entry
   * @param {integer} start First entry of the rotated range
   * @param {integer} end Last entry, inclusive
   * @param {boolean} forward The direction the palette rotated
   */
  static rotateRemap (table, start, end, forward) {
    var num = end - start + 1
    var offset = forward ? 1 : num - 1
    for (var i = 0; i < table.length; i++) {
      if (start <= table[i] && table[i] <= end) table[i] = ((table[i] - start + offset) % num) + start
    }
    Palette.rotateRange(table, start, end, forward, 1)
  }
}

export default Palette
