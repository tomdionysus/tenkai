import Scene from './Scene.js'

/**
 * BufferedScene is a {@link Scene} for slideshow-style games, such as first-person point-and-click
 * adventures, where the picture is composed rather than redrawn every frame.
 *
 * It keeps two canvases: a back buffer, where the next picture is put together, and the screen, which is
 * what the player sees. Drawing goes to either; [copyToScreen()]{@link BufferedScene#copyToScreen} shows
 * all or part of the back buffer, and [transition()]{@link BufferedScene#transition} animates from a
 * snapshot of the old screen to the new one. Entities (for example a {@link Video}) are drawn over the
 * screen.
 *
 * @extends Scene
 * @example
const view = new BufferedScene({ width: 544, height: 333 })
const before = view.snapshot()
view.backContext.drawImage(nextImage, 0, 0)
view.copyToScreen()
view.transition(before, { type: 'dissolve', duration: 300 })
 */
class BufferedScene extends Scene {
  /**
   * @param {object} options The options for the BufferedScene, as well as those of {@link Scene}:
   * @property {integer} width The width of the buffers in pixels
   * @property {integer} height The height of the buffers in pixels
   * @property {function} createCanvas Creates a canvas (optional, for testing)
   */
  constructor (options = {}) {
    super(options)
    this.width = options.width
    this.height = options.height
    this._createCanvas = options.createCanvas || (() => document.createElement('canvas'))
    this.back = this.createCanvas()
    this.screen = this.createCanvas()
    this._transition = null
  }

  createCanvas () {
    var c = this._createCanvas()
    c.width = this.width
    c.height = this.height
    return c
  }

  /** The 2D context of the back buffer. */
  get backContext () { return this.back.getContext('2d') }

  /** The 2D context of the screen. */
  get screenContext () { return this.screen.getContext('2d') }

  /**
   * Copy the back buffer to the screen.
   * @param {number[]} rect [left, top, right, bottom] to copy (optional, default everything)
   */
  copyToScreen (rect) {
    var [l, t, r, b] = rect || [0, 0, this.width, this.height]
    if (r <= l || b <= t) return
    this.screenContext.drawImage(this.back, l, t, r - l, b - t, l, t, r - l, b - t)
  }

  /**
   * A copy of what is on the screen now, to transition from.
   * @returns {HTMLCanvasElement}
   */
  snapshot () {
    var c = this.createCanvas()
    c.getContext('2d').drawImage(this.screen, 0, 0)
    return c
  }

  /**
   * Animate from an earlier snapshot to what is on the screen now.
   * @param {HTMLCanvasElement} before The snapshot taken before the screen changed
   * @param {object} options
   * @param {string} options.type 'dissolve', 'wipeLeft', 'wipeRight', 'wipeUp', 'wipeDown' or 'none'
   *   (optional, default 'dissolve'). A wipe reveals the new picture moving in that direction.
   * @param {number[]} options.rect [left, top, right, bottom] to animate (optional, default everything)
   * @param {number} options.duration Milliseconds (optional, default 250)
   * @returns {Promise} Resolves when the transition has finished
   */
  transition (before, options = {}) {
    var type = options.type || 'dissolve'
    if (type === 'none' || !before) return Promise.resolve()
    var duration = options.duration || 250
    this._endTransition()
    return new Promise((resolve) => {
      var fx = { before, type, rect: options.rect || [0, 0, this.width, this.height], start: Date.now(), duration, resolve }
      // Finish on time even if nothing is drawing, such as in a background tab
      fx.timer = setTimeout(() => this._endTransition(fx), duration)
      this._transition = fx
    })
  }

  // End the given transition, or whichever is in progress, resolving its promise
  _endTransition (fx = this._transition) {
    if (!fx || fx !== this._transition) return
    clearTimeout(fx.timer)
    this._transition = null
    fx.resolve()
  }

  /** Whether a transition is in progress. */
  get transitioning () { return !!this._transition }

  /**
   * Draw the screen, then child scenes and entities, then any transition in progress.
   * @param {CanvasRenderingContext2D} context The context in which to draw
   */
  drawContent (context) {
    context.drawImage(this.screen, 0, 0)
    super.drawContent(context)
    if (this._transition) this._drawTransition(context)
  }

  _drawTransition (context) {
    var fx = this._transition
    var t = Math.min(1, (Date.now() - fx.start) / fx.duration)
    var [l, top, r, b] = fx.rect
    var w = r - l
    var h = b - top
    if (fx.type === 'dissolve') {
      context.globalAlpha = 1 - t
      context.drawImage(fx.before, l, top, w, h, l, top, w, h)
      context.globalAlpha = 1
    } else {
      // The old picture remains where the new one has not yet reached
      var sx = l
      var sy = top
      var sw = w
      var sh = h
      if (fx.type === 'wipeRight') { sx = l + w * t; sw = w * (1 - t) }
      if (fx.type === 'wipeLeft') { sw = w * (1 - t) }
      if (fx.type === 'wipeDown') { sy = top + h * t; sh = h * (1 - t) }
      if (fx.type === 'wipeUp') { sh = h * (1 - t) }
      if (sw > 0 && sh > 0) context.drawImage(fx.before, sx, sy, sw, sh, sx, sy, sw, sh)
    }
    if (t >= 1) this._endTransition(fx)
  }
}

export default BufferedScene
