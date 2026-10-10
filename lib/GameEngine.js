import async from 'async'
import Util from './Util.js'

import Asset from './Asset.js'
import Audio from './Audio.js'
import Entity from './Entity.js'

import Input from './Input.js'

import HasEventsMixin from './HasEventsMixin.js'
import HasEntitiesMixin from './HasEntitiesMixin.js'
import HasScenesMixin from './HasScenesMixin.js'

/**
 * GameEngine is the base class for the top level container, mapping the game into a browser.
 * You should extend GameEngine to implement your own game.
 * @extends HasEventsMixin
 * @mixes HasScenesMixin
 * @mixes HasEntitiesMixin
 * @property {!string} targetId The DOM id of the element to target. This element will be replaced with a HTML5 'canvas' element.
 * @property {boolean} fullscreen Allow the canvas element to occupy the maximum possible space (optional, default false)
 * @property {boolean} showHUD Show the debug Heads Up Display (HUD)  (optional, default false)
 * @property {integer} x The viewport x-coordinate in pixels (optional, default 0)
 * @property {integer} y The viewport y-coordinate in pixels (optional, default 0)
 * @property {float} scale The current scale (zoom) where 1 = 100% (optional, default 1)
 * @property {integer} minX The minimum viewport x-coordinate in pixels (optional)
 * @property {integer} minY The minimum viewport y-coordinate in pixels (optional)
 * @property {integer} maxX The maximum viewport x-coordinate in pixels (optional)
 * @property {integer} maxY The maximum viewport y-coordinate in pixels (optional)
 * @property {float} globalAlpha The global alpha value (0 to 1) for drawing scenes (optional, default 1)
 * @property {boolean} enableScroll Enable mouse scrolling (optional, default true)
 * @property {boolean} enableZoom Enable mouse zooming (optional, default true)
 * @property {integer} width The width of the viewport in pixels (readonly)
 * @property {integer} height The height of the viewport in pixels (readonly)
 * @property {number} stepRate Game steps per second (optional, default 60). See [update()]{@link GameEngine#update}.
 * @property {boolean} pixelated Draw images without smoothing, for pixel art (optional, default false)
 * @property {object} keys Key bindings for [input]{@link Input#bind} (optional)
 * @property {boolean|object} startScreen Before init, show a screen asking the player to click or press a key,
 * which browsers require before a page may play sound: `true`, or `{ title, prompt, background, color, font,
 * titleFont }` (optional, default none). See [showStartScreen()]{@link GameEngine#showStartScreen}.
 * @property {AudioContext} audioContext The shared audio context, created and resumed by
 * [unlockAudio()]{@link GameEngine#unlockAudio} (optional)
 * @property {boolean} audioUnlocked Whether the player has started the game, so sound may play (readonly)
 */
class GameEngine {
  /**
	* Create a new GameEngine with the specified options.
	* @param {object} options The options for the GameEngine, composed of the properties.

	* @example <caption>To create a GameEngine attached to a specified element in HTML5</caption>
<div id='game' width="1200" height="960"></div>
<script type="module">
	import { GameEngine } from 'tenkai'
	var game = new GameEngine({ targetId: 'game', fullscreen: true, showHUD: true });
	game.start();
</script>
	*/
  constructor (options = {}) {
    // Has Events
    HasEventsMixin(this, options)

    // Has a collection of Scenes
    HasScenesMixin(this, options)

    // Has a collection of Entities
    HasEntitiesMixin(this, options)

    // targetId is the DOM id of the element to target. This element will be replaced with a HTML5 'canvas' element.
    this.targetId = options.targetId
    // If fullscreen is true, the element will maximise as much as possible
    this.fullscreen = !!options.fullscreen

    // Show the Debug HUD
    this.showHUD = !!options.showHUD

    // The initial scale where 1 is 100%
    this.scale = typeof (options.scale) === 'undefined' ? 1 : options.scale

    // The initial coordinates for scrolling
    this.x = options.x || 0
    this.y = options.y || 0

    // The min/max scale values when zoom is enabled
    this.maxScale = options.maxScale
    this.minScale = options.minScale

    // The min/max scroll values when scroll is enabled
    this.minX = options.minX
    this.minY = options.minY
    this.maxX = options.maxX
    this.maxY = options.maxY

    // Global Alpha
    this.globalAlpha = typeof (options.globalAlpha) === 'undefined' ? 1 : options.globalAlpha

    // Enable mouse scrolling/zooming
    this.enableScroll = typeof (options.enableScroll) === 'undefined' ? true : !!options.enableScroll
    this.enableZoom = typeof (options.enableZoom) === 'undefined' ? true : !!options.enableZoom

    // Fixed-step time: game logic and animation advance in steps of 1 / stepRate seconds
    this.stepRate = options.stepRate || 60
    this.time = 0
    this._accumulator = 0
    this._timers = []

    this.pixelated = !!options.pixelated

    // The keyboard, sampled once per step
    this.input = new Input({ bindings: options.keys })

    this.mode = null

    // Browsers only let a page start sound after the player does something. With a start screen the engine
    // waits for that click or key press before init, and has an unlocked audio context ready.
    this.startScreen = options.startScreen ? Object.assign({}, options.startScreen === true ? {} : options.startScreen) : null
    this.audioContext = options.audioContext || null
    this.audioUnlocked = false

    // Private properties
    this._audioDefs = {}
    this._assetDefs = {}

    // Events
    this.defineEvents(['running', 'mouseup', 'mousedown', 'mousemove', 'resize', 'audiounlocked'])
  }

  /**
	* Start the game, loading all {@link Asset}s and {@link Audio}s defined by [addAsset()]{@link GameEngine#addAsset} and [addAudio()]{@link GameEngine#addAudio}, bind to the HTML element, call [init()]{@link GameEngine#init} and start the renderer.
	*
	* @param {function} callback The callback function to invoke when the game has been started (optional)
	*/
  start (callback) {
    console.debug('starting')

    async.series([
      // Load Assets
      (cb) => {
        async.parallel([
          // Load Assets
          (cb2) => { this.loadAssets(cb2) },
          // Load Audio
          (cb2) => { this.loadAudio(cb2) }
        ], cb)
      },
      // Boot Element
      (cb) => { this.bootElement(cb) },
      // Wait for the player on the start screen, if there is one, so sound can play from the start
      (cb) => { this.startScreen ? this.showStartScreen(cb) : cb() },
      // Init: it may call its callback, return a promise, or, if it takes no callback, simply return
      (cb) => {
        var finished = false
        var done = (err) => { if (!finished) { finished = true; cb(err) } }
        var result = this.init(done)
        if (result && result.then) result.then(() => done(), done)
        else if (this.init.length === 0) done()
      }
    ],
    (err) => {
      if (err) {
        console.error('error while starting', err)
        if (callback) callback(err)
        return
      }
      this.running = true

      setTimeout(() => this._tick(), 0)
      console.debug('started')
      this.trigger('running', this)
      if (callback) callback()
    })
  }

  /**
   * Show the start screen and wait for a click, tap or key press on it, then unlock audio and continue. The
   * screen is drawn on the game's canvas: the title, and a prompt that pulses gently. Called by
   * [start()]{@link GameEngine#start} when the `startScreen` option is set.
   * @param {function} callback Called once the player has started the game
   */
  showStartScreen (callback) {
    var opts = this.startScreen
    var title = opts.title !== undefined ? opts.title : ((this.document && this.document.title) || '')
    var prompt = opts.prompt || 'Click or press any key to start'
    var context = this.element.getContext('2d')
    var w = this.element.width
    var h = this.element.height
    var started = false
    var frame

    var draw = (now) => {
      if (started) return
      context.save()
      context.fillStyle = opts.background || 'black'
      context.fillRect(0, 0, w, h)
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = opts.color || '#e8e8e8'
      context.font = opts.titleFont || ('bold ' + Math.round(h / 12) + 'px sans-serif')
      if (title) context.fillText(title, w / 2, h / 2 - h / 12)
      context.globalAlpha = 0.55 + 0.45 * Math.sin((now || 0) / 400)
      context.font = opts.font || (Math.round(h / 24) + 'px sans-serif')
      context.fillText(prompt, w / 2, h / 2 + h / 12)
      context.restore()
      frame = this.window && this.window.requestAnimationFrame ? this.window.requestAnimationFrame(draw) : null
    }

    var go = (e) => {
      if (started) return
      // Keys the browser itself uses, like Tab or a modifier on its own, do not count
      if (e && e.type === 'keydown' && (e.key === 'Tab' || e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta')) return
      started = true
      this.element.removeEventListener('pointerdown', go)
      if (this.window) this.window.removeEventListener('keydown', go)
      if (frame && this.window.cancelAnimationFrame) this.window.cancelAnimationFrame(frame)
      this.unlockAudio()
      callback()
    }

    this.element.addEventListener('pointerdown', go)
    if (this.window) this.window.addEventListener('keydown', go)
    draw()
  }

  /**
   * Create or resume the shared [audioContext]{@link GameEngine#audioContext} and mark audio as unlocked.
   * It must run inside a click, tap or key handler; the start screen calls it for you. Pass the context to
   * a {@link SoundManager} with `new SoundManager({ context: game.audioContext })`.
   * @returns {AudioContext} The context, or null where the browser has no Web Audio
   */
  unlockAudio () {
    var win = this.window || (typeof window !== 'undefined' ? window : null)
    var AudioContext = win && (win.AudioContext || win.webkitAudioContext)
    if (!this.audioContext && AudioContext) this.audioContext = new AudioContext()
    if (this.audioContext && this.audioContext.state === 'suspended') this.audioContext.resume()
    this.audioUnlocked = true
    this.trigger('audiounlocked', this)
    return this.audioContext
  }

  /**
	* Set the global alpha for drawing.
	* @param {float} ga The Global alpha value 0 - 1
	*/
  setGlobalAlpha (ga) {
    this.globalAlpha = ga
  }

  /**
	* Init is called after asset and audio loading. Override it to create your Scenes, Entities and other game
	* objects. It can be written three ways: taking a `callback` and calling it when done, as an `async`
	* method, or taking no arguments and simply returning.
	* @param {function} callback Call when done, with an error to abort the start (optional)
	*/
  init (callback) {
    callback()
  }

  /**
	* Called once per game step, before animation and drawing, with the step's length in seconds. Override it
	* for game logic. Steps happen at a fixed rate (`stepRate`, default 60 per second), whatever the
	* display's frame rate, so logic and animation stay in step with each other. The default runs the
	* current mode's `update(dt)`.
	* @param {number} dt The length of a step in seconds
	*/
  update (dt) {
    if (this.mode && this.mode.update) this.mode.update(dt)
  }

  /**
	* Switch to a mode: an object for one state of the game, such as a title screen or play. Its optional
	* methods are `enter()` and `exit()`, called on switching, `update(dt)`, called each step by the default
	* [update()]{@link GameEngine#update}, and `draw(context)`, called each frame over everything else.
	* @param {object} mode
	*/
  setMode (mode) {
    var previous = this.mode
    if (previous && previous.exit) previous.exit()
    this.mode = mode
    if (mode && mode.enter) mode.enter(previous)
  }

  /**
	* Call a function after some game time. Timers pause with the game and run in step with update and
	* animation.
	* @param {number} seconds Game time to wait
	* @param {function} fn
	* @returns {object} The timer, with `cancel()`
	*/
  after (seconds, fn) {
    var timer = { at: this.time + seconds, fn, cancel: () => { timer.cancelled = true } }
    this._timers.push(timer)
    return timer
  }

  /**
	* Call a function repeatedly, every so much game time.
	* @param {number} seconds Game time between calls
	* @param {function} fn
	* @returns {object} The timer, with `cancel()`
	*/
  every (seconds, fn) {
    var timer = this.after(seconds, () => {
      fn()
      if (!timer.cancelled) { timer.at += seconds; this._timers.push(timer) }
    })
    return timer
  }

  /** Cancel every timer. */
  clearTimers () {
    for (var t of this._timers) t.cancelled = true
    this._timers = []
  }

  _runTimers () {
    var due = this._timers.filter((t) => t.at <= this.time + 1e-9)
    if (!due.length) return
    this._timers = this._timers.filter((t) => t.at > this.time + 1e-9)
    due.sort((a, b) => a.at - b.at)
    for (var t of due) if (!t.cancelled) t.fn()
  }

  /**
	* Stop the game engine.
	*/
  stop () {
    this.running = false
  }

  /**
	* Add an asset definition. Note that the {@link Asset} resource will not be created until [start()]{@link GameEngine#start} is called.
	* @param {String} name Asset Name
	* @param {String} src Source filename
	*/
  addAsset (name, src) {
    this._assetDefs[name] = src
  }

  /**
	* Get the {@link Asset} with the specified name.
	* @param {String} name Asset Name
	* @returns {Asset} The Asset with the specified name, or null
	* @throws {Exception} Will throw 'Asset not found' if the Asset has not been loaded
	*/
  getAsset (name) {
    if (!this.assets[name]) throw 'Asset not found: ' + name
    return this.assets[name]
  }

  /**
	* Add an audio definition. Note that the {@link Audio} resource will not be created until [start()]{@link GameEngine#start} is called.
	* @param {String} name Audio Name
	* @param {String} src Source filename
	* @param {String} type MIME type
	*/
  addAudio (name, src, type) {
    this._audioDefs[name] = { src: src, type: type }
  }

  /**
	* Get the {@link Audio} with the specified name.
	* @param {String} name Audio Name
	* @returns {Audio} The Audio with the specified name, or null
	* @throws {Exception} Will throw 'Audio not found' if the Audio has not been loaded
	*/
  getAudio (name) {
    if (!this.audio[name]) throw 'Audio not found: ' + name
    return this.audio[name]
  }

  /**
	* Create and Load all defined {@link Asset}s.
	* @param {function} callback The callback function to invoke when all assets have been loaded (optional)
	*/
  loadAssets (callback) {
    console.debug('loading assets')
    this.assets = {}
    for (var i in this._assetDefs) {
      this.assets[i] = new Asset({ name: i, src: this._assetDefs[i] })
    }

    async.each(this.assets, (asset, cb) => { asset.load(cb) }, callback)
  }

  /**
	* Create and Load all defined {@link Audio}s.
	* @param {function} callback The callback function to invoke when all assets have been loaded (optional)
	*/
  loadAudio (callback) {
    console.debug('loading audio')
    this.audio = {}
    for (var i in this._audioDefs) {
      this.audio[i] = new Audio({ name: i, src: this._audioDefs[i].src, type: this._audioDefs[i].type })
    }

    async.each(this.audio, (audio, cb) => { audio.load(cb) }, callback)
  }

  /**
	* Boot the GameEngine into an HTML 'canvas' element, and replace the DOM element specified by {@link GameEngine.targetId} with it
	* @param {function} callback The callback function to invoke when the element has been replaced (optional)
	*/
  bootElement (callback) {
    this.target = document.getElementById(this.targetId)
    this.element = document.createElement('canvas')
    this.document = this.target.ownerDocument
    this.window = this.document.defaultView || this.document.parentWindow

    if (this.fullscreen) {
      this.recomputeFullScreen()
      this.window.addEventListener('resize', Util.debounce(() => { this.recomputeFullScreen() }, 100))
    } else {
      this.element.width = this.target.getAttribute('width')
      this.element.height = this.target.getAttribute('height')
    }

    this.element.classList.add('gamescreen')
    if (this.pixelated) this.element.style.imageRendering = 'pixelated'
    this.target.parentNode.replaceChild(this.element, this.target)

    this.width = this.element.width / this.scale
    this.height = this.element.height / this.scale

    this._bindMouseWheel()

    if (callback) callback()
  }

  /**
	* Recompute the [width]{@link GameEngine.width} and [height]{@link GameEngine.height} from the window's size
	*/
  recomputeFullScreen () {
    this.element.width = this.window.innerWidth
    this.element.height = this.window.innerHeight
    this.width = Math.round(this.element.width / this.scale)
    this.height = Math.round(this.element.height / this.scale)
    this.trigger('resize', this)
  }

  _bindMouseWheel () {
    if (this.enableScroll || this.enableZoom) {
      this.element.addEventListener('wheel', (e) => this._panZoom(e), { passive: false })
    }

    this.element.addEventListener('mousemove', (e) => this._move(e), false)
    this.element.addEventListener('mousedown', (e) => { this._setMouseCoords(e); this.trigger('mousedown', this, e) })
    this.element.addEventListener('mouseup', (e) => { this._setMouseCoords(e); this.trigger('mouseup', this, e) })
  }

  /** Whether this is a GameEngine, for scenes and entities finding the game they belong to. */
  get isGameEngine () { return true }

  /** The length of a step in seconds. */
  get stepTime () { return 1 / this.stepRate }

  _tick () {
    // Run as many fixed steps as the time since the last frame holds. At most a quarter of a second is
    // caught up, so a stalled or background tab does not fast-forward the game when it returns.
    var now = Date.now()
    if (this._lastTick) this._accumulator += Math.min((now - this._lastTick) / 1000, 0.25)
    this._lastTick = now
    var step = this.stepTime
    while (this._accumulator >= step - 1e-6) {
      this._accumulator -= step
      this.step(step)
    }

    this.draw(this.element.getContext('2d'))

    if (this.running) window.requestAnimationFrame(this._tick.bind(this), 0)
  }

  /**
   * Run one game step: sample input, call [update()]{@link GameEngine#update}, run due timers, then
   * advance animation. The frame loop calls this; call it yourself to drive the game in tests.
   * @param {number} dt The step's length in seconds (optional, default one step)
   */
  step (dt = this.stepTime) {
    this.input.beginStep()
    this.time += dt
    this.update(dt)
    this._runTimers()
    this.animateScenes(dt * 1000)
    this.animateEntities(dt * 1000)
  }

  /**
   * Draw a frame: clear to black, then the scenes, the engine's own entities and the mode, through the
   * viewport.
   * @param {CanvasRenderingContext2D} context
   */
  draw (context) {
    context.imageSmoothingEnabled = !this.pixelated
    context.fillStyle = 'black'
    context.fillRect(0, 0, this.element.width, this.element.height)

    context.save()
    context.scale(this.scale, this.scale)
    context.translate(this.x, this.y)
    context.globalAlpha = this.globalAlpha
    if (!this._sceneOrderMap) this.sortScenesZ()
    this.drawScenes(context)
    this.drawEntities(context)
    if (this.mode && this.mode.draw) this.mode.draw(context)
    context.restore()

    if (this.showHUD) this._drawHUD(context)
  }

  // Event Handlers
  _panZoom (e) {
    if (e.shiftKey && this.enableZoom) {
      var f = e.deltaY / 100
      this.scale = this.scale + f

      if (this.minScale) this.scale = Math.max(this.scale, this.minScale)
      if (this.maxScale) this.scale = Math.min(this.scale, this.maxScale)

      // Update Width/Height
      var ow = this.width; var oh = this.height
      this.width = this.element.width / this.scale
      this.height = this.element.height / this.scale

      // Update x and y to centre zoom
      this.x = this.x - (ow - this.width) / 2
      this.y = this.y - (oh - this.height) / 2
    } else if (this.enableScroll) {
      this.x += e.deltaX
      this.y += e.deltaY
    }

    // Limits?
    this._enforceScrollLimits()

    // Correct Mouse Coords
    this._setMouseCoords(e)

    // Redraw Everything

    // Prevent DOM Stuff
    e.preventDefault()
    e.stopPropagation()
  }

  _enforceScrollLimits () {
    if (this.minX !== undefined) this.x = Math.max(this.minX * this.scale, this.x)
    if (this.minY !== undefined) this.y = Math.max(this.minY * this.scale, this.y)
    if (this.maxX !== undefined) this.x = Math.min(this.maxX / this.scale, this.x)
    if (this.maxY !== undefined) this.y = Math.min(this.maxY / this.scale, this.y)
  }

  _move (e) {
    this._setMouseCoords(e)

    this.trigger('mousemove', this, e)

    // Prevent DOM Stuff
    e.preventDefault()
    e.stopPropagation()
  }

  _setMouseCoords (e) {
    // Convert from page coordinates to canvas pixels, allowing for where the canvas is on the page and
    // any CSS scaling of it
    var px = e.x
    var py = e.y
    if (e.clientX !== undefined && this.element && this.element.getBoundingClientRect) {
      var rect = this.element.getBoundingClientRect()
      px = (e.clientX - rect.left) * this.element.width / rect.width
      py = (e.clientY - rect.top) * this.element.height / rect.height
    }
    this.mouseX = (px / this.scale) - this.x
    this.mouseY = (py / this.scale) - this.y
  }

  _drawHUD (context) {
    context.save()
    context.font = '14px Arial'
    context.fillStyle = 'white'
    context.fillText(
      'Screen (X: ' + Math.round(this.x) +
			' Y: ' + Math.round(this.y) +
			' W: ' + Math.round(this.width) +
			' H: ' + Math.round(this.height) + ')' +
			' Zoom: ' + Math.round(this.scale * 100) + '%' +
			' Mouse (X: ' + Math.round(this.mouseX) + ' Y: ' + Math.round(this.mouseY) + ')' +
			' Limits Min: (X: ' + Math.round(this.minX / this.scale) + ', Y: ' + Math.round(this.minY / this.scale) + ')' +
			' Limit Max: (X: ' + Math.round(this.maxX * this.scale) + ', Y: ' + Math.round(this.maxY * this.scale) + ')'
      , 10, 20)
    context.restore()
  }
}

export default GameEngine
