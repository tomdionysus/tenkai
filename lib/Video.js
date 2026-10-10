import Entity from './Entity.js'

/**
 * Video is an {@link Entity} that plays a movie, drawing its current frame at the Entity's position like
 * any other Entity in a Scene. It can play a range of the movie, loop it, or play it backwards.
 *
 * @extends Entity
 * @example
const video = new Video({ src: 'movies/door.mp4', x: 216, y: 78 })
scene.addEntity('door', video)
video.play().then(() => scene.removeEntity('door'))
 */
class Video extends Entity {
  /**
   * Create a new Video.
   * @param {object} options The options for the Video, as well as those of {@link Entity}:
   * @property {string} src The movie's URL
   * @property {boolean} loop Loop the movie, or its range (optional)
   * @property {number} start Start time in seconds (optional, default 0). Infinity means the end.
   * @property {number} end End time in seconds (optional, default the end of the movie)
   * @property {boolean} reverse Play backwards from start to end (optional)
   * @property {boolean} muted Mute the movie's sound (optional)
   * @property {HTMLVideoElement} element Use this video element instead of creating one (optional)
   */
  constructor (options = {}) {
    super(options)
    this.src = options.src
    this.loop = !!options.loop
    this.start = options.start || 0
    this.end = options.end == null ? null : options.end
    this.reverse = !!options.reverse
    this.ended = false

    this.element = options.element || document.createElement('video')
    this.element.src = this.src
    this.element.muted = !!options.muted
    this.element.playsInline = true
    this.element.preload = 'auto'
    this.element.loop = this.loop && this.end == null && !this.reverse

    this.done = new Promise((resolve) => { this._resolve = resolve })
    this.element.onended = () => this.finish()
    this.element.onerror = () => this.finish()
  }

  /**
   * Start playing.
   * @returns {Promise} Resolves when the movie (or its range) ends or is stopped. A looping movie only
   * resolves when stopped.
   */
  play () {
    if (this.start === Infinity) {
      this.element.onloadedmetadata = () => { this.element.currentTime = this.element.duration }
    } else if (this.start) {
      this.element.currentTime = this.start
    }
    if (this.reverse) {
      // Browsers cannot play backwards, so the time is stepped back on each frame instead
      this._lastStep = Date.now()
      return this.done
    }
    var playing = this.element.play()
    if (playing && playing.catch) playing.catch(() => this.finish())
    return this.done
  }

  /** Stop early. Anything waiting for the movie carries on. */
  stop () {
    if (this.element.pause) this.element.pause()
    this.finish()
  }

  finish () {
    if (this.ended) return
    this.ended = true
    this._resolve()
  }

  /** Whether the movie is still playing (looping movies count until stopped). */
  get playing () { return !this.ended }

  /** The current time in seconds. */
  get currentTime () { return this.element.currentTime }

  /** Whether a frame is available to draw. */
  get ready () { return this.element.readyState >= 2 }

  /** The size of the movie's frames once known. */
  get videoWidth () { return this.element.videoWidth }
  get videoHeight () { return this.element.videoHeight }

  /**
   * Keep the movie within its range and step reverse playback. Called before each draw.
   */
  update () {
    if (this.ended) return
    var el = this.element
    if (this.reverse) {
      if (!this.ready) return
      var now = Date.now()
      var t = el.currentTime - (now - this._lastStep) / 1000
      this._lastStep = now
      var stop = this.end || 0
      if (t <= stop) {
        el.currentTime = stop
        this.finish()
      } else {
        el.currentTime = t
      }
      return
    }
    if (this.end != null && el.currentTime >= this.end) {
      if (this.loop) {
        el.currentTime = this.start === Infinity ? 0 : this.start
      } else {
        el.pause()
        this.finish()
      }
    }
  }

  /**
   * Draw the current frame into the given context.
   * @param {CanvasRenderingContext2D} context The context in which to draw
   */
  draw (context) {
    if (!this.visible) return
    this.update()
    if (!this.ready) return
    context.save()
    this.applyTransform(context)
    var [ax, ay] = this.origin
    context.drawImage(this.element, 0 - ax, 0 - ay, this.element.videoWidth, this.element.videoHeight)
    context.restore()
  }
}

export default Video
