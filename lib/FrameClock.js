/**
 * A FrameClock turns elapsed seconds into whole frames of a fixed rate, keeping the rest for next time: the
 * clock of something that runs at its own rate apart from the engine's steps (an original's 50 Hz animation, a
 * once-a-second game clock, a menu's own passes). Call `frames(dt)` each step and run that many frames.
 *
 * @example
const clock = new FrameClock(50)
update (dt) {
  for (let n = clock.frames(dt); n > 0; n--) this.frame()
}
const seconds = new FrameClock(1)   // whole seconds
 */
class FrameClock {
  /**
   * @param {number} rate Frames a second (default 50)
   */
  constructor (rate = 50) {
    this.rate = rate
    /** The time carried over, less than a frame (seconds) */
    this.time = 0
  }

  /** One frame's length in seconds. */
  get period () {
    return 1 / this.rate
  }

  /**
   * How many whole frames `dt` more seconds make, with a millionth of a frame's tolerance (a sum of steps that
   * should make a frame exactly can fall a hair short in floating point); the rest is kept.
   * @param {number} dt Seconds since the last call
   * @returns {number} Whole frames to run
   */
  frames (dt) {
    this.time += dt
    const n = Math.floor(this.time * this.rate + 1e-6)
    this.time -= n * this.period
    if (this.time < 0) this.time = 0
    return n
  }

  /** Starts again from nothing carried over. */
  reset () {
    this.time = 0
  }
}

export default FrameClock
