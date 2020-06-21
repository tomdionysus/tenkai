const async = require('async')
const Util = require('./Util')

const Asset = require('./Asset')
const Audio = require('./Audio')
const Entity = require('./Entity')

const HasEventsMixin = require('./HasEventsMixin')
const HasEntitiesMixin = require('./HasEntitiesMixin')
const HasScenesMixin = require('./HasScenesMixin')

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
 */
class GameEngine {
  /**
	* Create a new GameEngine with the specified options.
	* @param {object} options The options for the GameEngine, composed of the properties.

	* @example <caption>To create a GameEngine attached to a specified element in HTML5</caption>
<div id='game' width="1200" height="960"></div>
<script type="text/javascript">
	const GameEngine = require('GameEngine')
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

    // Private properties
    this._audioDefs = {}
    this._assetDefs = {}

    // Events
    this.defineEvents(['running', 'mouseup', 'mousedown', 'mousemove', 'resize'])
  }

  /**
	* Start the game, loading all {@link Asset}s and {@link Audio}s defined by [addAsset()]{@link GameEngine#addAsset} and [addAudio()]{@link GameEngine#addAudio}, bind to the HTML element, call [init()]{@link GameEngine#init} and start the renderer.
	*
	* @param {function} callback The callback function to invoke when the game has been started (optional)
	*/
  start (callback) {
    console.debug('starting')
    if (this.processKey) {
      document.onkeyup = (e) => { this.processKey(e) }
    }

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
      // Init
      (cb) => { this.init(cb) }
    ],
    (err) => {
      if (err) {
        console.error('error while starting', err)
        if (callback) callback(err)
        return
      }
      this.running = true

      setImmediate(() => { this.redraw(); this._tick() })
      console.debug('started')
      this.trigger('running', this)
      if (callback) callback()
    })
  }

  /**
	* Set the global alpha for drawing.
	* @param {float} ga The Global alpha value 0 - 1
	*/
  setGlobalAlpha (ga) {
    this.globalAlpha = ga
  }

  /**
	* Init is called after asset and audio loading. You should override init to create your Scenes, Entities and other game objects.
	*
	* Note: If you override init, you *must* call the callback when done.
	* @param {function} callback The callback function to invoke when the init has been completed
	*/
  init (callback) {
    console.debug('init')
    callback()
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
	* Mark the whole GameEngine to be redrawn.
	*/
  redraw () {
    this._doredraw = true

    // Redraw All Scenes
    this.redrawScenes()

    // Redraw All Entities
    this.redrawEntities()
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
    this.target.parentNode.replaceChild(this.element, this.target)

    this.width = this.element.width / this.scale
    this.height = this.element.height / this.scale

    this._bindMouseWheel()

    if (callback) callback()
  }

  /**
	* Recompute the [width]{@link GameEngine.width} and [height]{@link GameEngine.height} from the 'canvas' element dimensions and call [redraw()]{@link GameEngine#redraw}
	*/
  recomputeFullScreen () {
    this.element.width = this.window.innerWidth
    this.element.height = this.window.innerHeight
    this.width = Math.round(this.element.width / this.scale)
    this.height = Math.round(this.element.height / this.scale)
    this.redraw()
    this.trigger('resize', this)
  }

  _bindMouseWheel () {
    var ael = this.element.addEventListener
    if (!ael) ael = this.element.attachEvent

    if (this.enableScroll || this.enableZoom) {
      ael('mousewheel', (e) => this._panZoom(e), false)
      ael('DOMMouseScroll', (e) => this._panZoom(e), false)
    }

    ael('mousemove', (e) => this._move(e), false)
    ael('mousedown', (e) => this.trigger('mousedown', this, e))
    ael('mouseup', (e) => this.trigger('mouseup', this, e))
  }

  _tick () {
    var context = this.element.getContext('2d')

    this.redraw()

    context.fillStyle = 'black'
    context.fillRect(0, 0, this.element.width, this.element.height)

    context.save()

    // Set Alpha, scale
    context.scale(this.scale, this.scale)
    context.translate(this.x, this.y)
    context.globalAlpha = this.globalAlpha

    // Ensure TiledScene sort order
    if (!this._sceneOrderMap) this.sortScenesZ()

    // Draw all the scenes in z-order
    this.drawScenes(context)

    // Draw all the entities in z-order
    this.drawEntities(context)

    context.restore()

    // HUD
    if (this.showHUD && this._doredraw) { this._drawHUD(context) }

    this._doredraw = false

    if (this.running) window.requestAnimationFrame(this._tick.bind(this), 0)
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
    this.redraw()

    // Prevent DOM Stuff
    e.preventDefault()
    e.stopPropagation()
  }

  _enforceScrollLimits () {
    if (this.minX) this.x = Math.max(this.minX * this.scale, this.x)
    if (this.minY) this.y = Math.max(this.minY * this.scale, this.y)
    if (this.maxX) this.x = Math.min(this.maxX / this.scale, this.x)
    if (this.maxY) this.y = Math.min(this.maxY / this.scale, this.y)
  }

  _move (e) {
    this._setMouseCoords(e)
    this.redraw()

    this.trigger('mousemove', this, e)

    // Prevent DOM Stuff
    e.preventDefault()
    e.stopPropagation()
  }

  _setMouseCoords (e) {
    this.mouseX = (e.x / this.scale) - this.x
    this.mouseY = (e.y / this.scale) - this.y
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

module.exports = GameEngine
