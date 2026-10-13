/**
 * Shake is a screen shake as old games did it: a part of the screen jolted by a pattern of small offsets, one a step
 * (a frame), and still again when the pattern ends. `start` begins it, from the pattern's start again if it is
 * already shaking; `step` moves it on; `x` and `y` are where to draw the shaken part now (0, 0 when still). Move the
 * part's content, not its window: a scene drawn at the offset inside a clip that stays put shakes inside its frame
 * at any size, with the next row or column of what it shows coming into the edge rather than a gap.
 *
 * @example
// The PC Dune II's (Explosion_Func_ScreenShake): two frames still, two a row up, twice
const shake = new Shake({ pattern: [[0, 0], [0, 0], [0, -1], [0, -1], [0, 0], [0, 0], [0, -1], [0, -1]] })
shake.start()                                    // a structure's explosion
// each frame:
scene.y = top + shake.y
scene.clip = clipAt(top)                         // in the scene's own coordinates: moved back by the offset
shake.step()
 */
class Shake {
  /**
   * @param {object} options
   * @property {number[][]} pattern [x, y] offsets, one a step (default a row up and back, twice)
   */
  constructor (options = {}) {
    this.pattern = options.pattern || [[0, -1], [0, 0], [0, -1], [0, 0]]
    /** The step of the pattern it is at, or -1 when still */
    this.at = -1
  }

  /** Begins the shake, from the pattern's start (again, if it is shaking already). */
  start () {
    this.at = this.pattern.length ? 0 : -1
  }

  /** One step on; still once the pattern is done. */
  step () {
    if (this.at < 0) return
    this.at++
    if (this.at >= this.pattern.length) this.at = -1
  }

  /** Whether it is shaking. */
  get active () {
    return this.at >= 0
  }

  get x () {
    return this.active ? this.pattern[this.at][0] : 0
  }

  get y () {
    return this.active ? this.pattern[this.at][1] : 0
  }
}

export default Shake
