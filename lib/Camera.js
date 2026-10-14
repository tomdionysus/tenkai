/**
 * A Camera is the scroll of a flat scene that follows a target: a side-scroller's view that keeps the player a
 * lead ahead of its left edge, moves at most so far a step, scrolls forward only (as the arcade's belt-scrollers
 * did) or both ways, stops at a limit (where an event holds it) and at the stage's end, and eases the other axis
 * after the target on a stage taller than the view. It is numbers only: give a scene `-camera.x` and `-camera.y`
 * (or an {@link IsometricScene} its `camera`) each step.
 *
 * @example
const camera = new Camera({ width: 1536, height: 224, viewWidth: 320, viewHeight: 224, lead: 150, speed: 2, forwardOnly: true })
// each step:
camera.follow(player, waves.limitX)
world.x = -Math.round(camera.x)
if (camera.offscreen(enemy.x, 30)) enemy.remove()
 */
class Camera {
  /**
   * @param {object} options
   * @param {number} options.width The stage's width in pixels (the camera stops at `width - viewWidth`)
   * @param {number} options.height The stage's height (likewise)
   * @param {number} options.viewWidth The view's size
   * @param {number} options.viewHeight
   * @param {number} options.lead How far ahead of the view's left edge the target is kept (optional, default
   *   half the view's width: the target centred)
   * @param {number} options.leadY Likewise from the top (optional, default half the view's height)
   * @param {number} options.speed How far the camera moves across in a step at most (optional, default any)
   * @param {boolean} options.forwardOnly Never scroll back (optional, default false)
   * @param {number} options.ease The fraction of the way to the target the camera moves down or up each step
   *   (optional, default 1: at once)
   */
  constructor (options = {}) {
    this.width = options.width
    this.height = options.height
    this.viewWidth = options.viewWidth
    this.viewHeight = options.viewHeight
    this.lead = options.lead === undefined ? this.viewWidth / 2 : options.lead
    this.leadY = options.leadY === undefined ? this.viewHeight / 2 : options.leadY
    this.speed = options.speed === undefined ? Infinity : options.speed
    this.forwardOnly = !!options.forwardOnly
    this.ease = options.ease === undefined ? 1 : options.ease
    this.x = 0
    this.y = 0
  }

  /** How far across the camera can go at most. */
  get maxX () {
    return Math.max(0, this.width - this.viewWidth)
  }

  /** How far down. */
  get maxY () {
    return Math.max(0, this.height - this.viewHeight)
  }

  /**
   * One step after the target.
   * @param {{x: number, y: number}} target
   * @param {number} limitX No further across than this (optional)
   */
  follow (target, limitX = Infinity) {
    const maxX = Math.min(this.maxX, limitX)
    const tx = Math.max(0, Math.min(maxX, target.x - this.lead))
    const dx = tx - this.x
    if (dx > 0) this.x = Math.min(tx, this.x + this.speed)
    else if (dx < 0 && !this.forwardOnly) this.x = Math.max(tx, this.x - this.speed)
    const ty = Math.max(0, Math.min(this.maxY, target.y - this.leadY))
    this.y += (ty - this.y) * this.ease
  }

  /** The camera put at (x, y) at once (an event begins there). */
  snap (x, y = this.y) {
    this.x = x
    this.y = y
  }

  /** Whether x is off the view across by more than `margin` (a negative margin: inside the edges by that much). */
  offscreen (x, margin = 0) {
    return x < this.x - margin || x > this.x + this.viewWidth + margin
  }
}

export default Camera
