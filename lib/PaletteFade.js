/**
 * A palette fade as the old machines did it: every red, green and blue component of every colour moves one level
 * towards its target at each step, so colours reach their targets at different times, the way an Amiga or ST
 * fade looks. Components are levels from 0 to `max` (15 for the Amiga's 4 bits a component).
 *
 * The fade waits `wait` frames, then takes a step every `every` frames, `steps` times, and ends `every` frames
 * after the last step. `speed` frames of the fade pass for each `tick`, to run it faster than it was timed.
 * `level` counts the steps taken, for a fade that darkens something other than a palette (a held picture, one
 * level a step).
 *
 * @example
// From black to the title's colours, a step every 5 frames
const fade = new PaletteFade({ from: black, to: titleColours, every: 5 })
// each frame:
if (fade.tick()) fade.apply(palette)
if (fade.done) start()
 */
class PaletteFade {
  /**
   * @param {object} options
   * @param {number[]} options.from The colours now: red, green, blue levels for each entry in turn (default none)
   * @param {number[]} options.to The colours to reach, the same length (default none)
   * @param {integer} options.every Frames between steps (default 1)
   * @param {integer} options.wait Frames before the first step (default 1)
   * @param {integer} options.steps How many steps (default 16)
   * @param {integer} options.speed Frames of the fade a tick (default 1)
   * @param {integer} options.max The highest level of a component (default 15)
   */
  constructor (options = {}) {
    /** The colours as they are now, red, green, blue levels for each entry. */
    this.colours = (options.from || []).slice()
    this.to = options.to || []
    this.every = options.every || 1
    this.wait = options.wait === undefined ? 1 : options.wait
    this.steps = options.steps === undefined ? 16 : options.steps
    this.speed = options.speed || 1
    this.max = options.max || 15
    /** Frames of the fade passed. */
    this.frame = 0
    /** Steps taken. */
    this.level = 0
    /** Frames the fade lasts. */
    this.length = this.wait + this.steps * this.every
  }

  /** Whether the fade has run its length. */
  get done () { return this.frame >= this.length }

  /**
   * One tick: `speed` frames of the fade.
   * @returns {boolean} Whether a step was taken (the colours may have changed)
   */
  tick () {
    let stepped = false
    for (let i = 0; i < this.speed; i++) stepped = this.step() || stepped
    return stepped
  }

  /**
   * One frame of the fade.
   * @returns {boolean} Whether a step was taken
   */
  step () {
    const f = this.frame++
    if (f < this.wait || f >= this.length || (f - this.wait) % this.every) return false
    for (let i = 0; i < this.colours.length; i++) this.colours[i] += Math.sign(this.to[i] - this.colours[i])
    this.level++
    return true
  }

  /**
   * Write the colours into a {@link Palette}, each level scaled to 0-255 (level x 255 / max).
   * @param {Palette} palette
   * @param {integer} start The first entry written (optional, default 0)
   */
  apply (palette, start = 0) {
    const k = 255 / this.max
    for (let i = 0; i < this.colours.length; i++) palette.colors[start * 3 + i] = Math.round(this.colours[i] * k)
  }
}

export default PaletteFade
