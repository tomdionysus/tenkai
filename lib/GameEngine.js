const async = require('async')
const _ = require('underscore')

const Asset = require('./Asset')
const Audio = require('./Audio')
const Mob = require('./Mob')

const HasMobsMixin = require('./HasMobsMixin')
const HasScenesMixin = require('./HasScenesMixin')

// GameEngine is the base class for the top level container, mapping the game into a browser.
// You should extend GameEngine to implement your own game.
class GameEngine {
	constructor(options) {
		options = options || {}

		// A GameEngine has a collection of Scenes
		HasScenesMixin(this, options)

		// A GameEngine has a collection of Mobs
		HasMobsMixin(this, options)

		// targetId is the DOM id of the element to target. This element will be replaced with a HTML5 'canvas' element.
		this.targetId = options.targetId
		// If fullscreen is true, the element will maximise as much as possible
		this.fullscreen = !!options.fullscreen

		// Show the Debug HUD
		this.showHUD = !!options.showHUD

		// The initial scale where 1 is 100%
		this.scale = typeof(options.scale)=='undefined' ? 1 : options.scale

		// The initial coordinates for scrolling
		this.x = options.x || 0
		this.y = options.y || 0

		// The min/max scale values when zoom is enabled
		this.maxScale = typeof(options.maxScale)=='undefined' ? 10 : options.maxScale
		this.minScale = typeof(options.minScale)=='undefined' ? 0.01 : options.minScale
		
		// The min/max scroll values when scroll is enabled
		this.minX = options.minX
		this.minY = options.minY
		this.maxX = options.maxX
		this.maxY = options.maxY

		// Global Alpha
		this.globalAlpha =  typeof(options.globalAlpha)=='undefined' ? 1 : options.globalAlpha

		// Enable mouse scrolling/zooming
		this.enableScroll = typeof(options.enableScroll)=='undefined' ? true : !!options.enableScroll
		this.enableZoom = typeof(options.enableZoom)=='undefined' ? true : !!options.enableZoom

		// Private properties
		this._audioDefs = {}
		this._assetDefs = {}
	}

	start(callback) {
		console.debug('starting')
		if(this.processKey) {
			document.onkeyup = (e) => { this.processKey(e) }
		}

		async.series([
			// Load Assets
			(cb) => { this.loadAssets(cb) },
			// Load Audio
			(cb) => { this.loadAudio(cb) },
			// Boot Element
			(cb) => { this.bootElement(cb) },
			// Init
			(cb) => { this.init(cb) },
		], 
		(err) => {
			if(err) {
				console.error('error while starting', err)
				if(callback) callback(err)
				return
			}
			this.running = true
			if(this.run) this.run()

			setImmediate(()=>{ this.redraw(); this.tick() })
			console.debug('started')
			if(callback) callback()
		})
	}

	setGlobalAlpha(ga) {
		this.globalAlpha = ga
	}

	bindMouseWheel() {
		var ael = this.element.addEventListener
		if(!ael) ael = this.element.attachEvent

		if(this.enableScroll || this.enableZoom) {
			ael('mousewheel', (e) => this._panZoom(e), false)
			ael('DOMMouseScroll', (e) => this._panZoom(e), false)
		}

		ael('mousemove', (e) => this._move(e), false)
		ael('mousedown', (e) => this.mousedown(e), false)
		ael('mouseup', (e) => this.mouseup(e), false)
	}

	// Init is called after asset and audio loading. You should override init to create your Scenes, Mobs and other game objects.
	init(cb) {
		console.debug('init')
		cb()
	}

	stop() {
		this.running = false
	}

	addAsset(name, src) {
		this._assetDefs[name] = src
	}

	getAsset(name) {
		if (!this.assets[name]) throw 'Asset not found: '+name
		return this.assets[name]
	}

	addAudio(name, src, type) {
		this._audioDefs[name] = {src: src, type: type}
	}

	getAudio(name) {
		if (!this.audio[name]) throw 'Audio not found: '+name
		return this.audio[name]
	}

	redraw() {
		this.clear = true

		// Redraw All Scenes
		this.redrawScenes()

		// Redraw All Mobs
		this.redrawMobs()
	}

	tick() {
		var context = this.element.getContext('2d')

		this.redraw()

		if(this.clear) {
			context.fillStyle = 'black'
			context.fillRect(0, 0, this.element.width, this.element.height)
		}

		context.save()

		// Set Alpha, scale
		context.scale(this.scale, this.scale)
		context.translate(this.x, this.y)
		context.globalAlpha = this.globalAlpha;

		// Ensure scene sort order
		if(!this._sceneOrderMap) this.sortScenesZ()

		// Ensure mob sort order
		if(!this._mobOrderMap) this.sortMobsZ()

		// Draw all the scenes in z-order
		this.drawScenes(context)

		// Draw all the mobs in z-order
		this.drawMobs(context)

		context.restore()

		// HUD
		if(this.showHUD && this.clear) { this.drawHUD(context) }
		
		this.clear = false

		if(this.running) window.requestAnimationFrame(this.tick.bind(this),0)
	}

	loadAssets(callback) {
		console.debug('loading assets')
		this.assets = {}
		for(var i in this._assetDefs) {
			this.assets[i] = new Asset({ name: i, src: this._assetDefs[i] })
		}

		async.each(this.assets, (asset, cb) => { asset.load(cb) }, callback)
	}

	loadAudio(callback) {
		console.debug('loading audio')
		this.audio = {}
		for(var i in this._audioDefs) {
			this.audio[i] = new Audio({ name: i, src: this._audioDefs[i].src, type: this._audioDefs[i].type })
		}

		async.each(this.audio, (audio, cb) => { audio.load(cb) }, callback)
	}

	bootElement(callback) {
		this.target = document.getElementById(this.targetId)
		this.element = document.createElement('canvas')
		this.document = this.target.ownerDocument
		this.window = this.document.defaultView || this.document.parentWindow

		if(this.fullscreen) {
			this.recomputeFullScreen()
			this.window.addEventListener('resize', _.debounce(() => { this.recomputeFullScreen() } ,100))
		} else {
			this.element.width = this.target.getAttribute('width')
			this.element.height = this.target.getAttribute('height')
		}

		this.element.classList.add('gamescreen')
		this.target.parentNode.replaceChild(this.element, this.target)

		this.width = this.element.width / this.scale
		this.height = this.element.height / this.scale

		this.bindMouseWheel()

		if(callback) callback()
	}

	recomputeFullScreen() {
		this.element.width = this.window.innerWidth
		this.element.height = this.window.innerHeight
		this.width = this.element.width / this.scale
		this.height = this.element.height / this.scale
		this.redraw()
	}

	fadeIn(duration) {
		if(this.globalAlpha == 1) return
		this.redraw()
		var i = 1/(duration/100)
		this._fadeInterval = setInterval(()=>{
			this.globalAlpha += i
			if(this.globalAlpha>1) { 
				this.globalAlpha = 1
				clearInterval(this._fadeInterval)
				this._fadeInterval = null
			}
			this.redraw()
		},100)
	}

	fadeOut(duration) {
		if(this.globalAlpha == 0) return
		this.redraw()
		var i = 1/(duration/100)
		this._fadeInterval = setInterval(()=>{
			this.globalAlpha -= i
			if(this.globalAlpha<0) { 
				this.globalAlpha = 0
				clearInterval(this._fadeInterval)
				this._fadeInterval = null
			}
			this.redraw()
		},100)
	}

	// Event Handlers
	_panZoom(e) {
		if(e.shiftKey && this.enableZoom) {
			var f = e.deltaY/100
			this.scale = this.scale + f

			if(this.minScale) this.scale = Math.max(this.scale, this.minScale)
			if(this.maxScale) this.scale = Math.min(this.scale, this.maxScale)

			// Update Width/Height
			var ow = this.width, oh = this.height
			this.width = this.element.width / this.scale
			this.height = this.element.height / this.scale

			// Update x and y to centre zoom
			this.x = this.x-(ow-this.width)/2
			this.y = this.y-(oh-this.height)/2

		} else if(this.enableScroll) {
			this.x += e.deltaX
			this.y += e.deltaY
		}

		// Limits? 
		if(this.minX) this.x = Math.max(this.minX*this.scale, this.x)
		if(this.minY) this.y = Math.max(this.minY*this.scale, this.y)
		if(this.maxX) this.x = Math.min(this.maxX/this.scale, this.x)
		if(this.maxY) this.y = Math.min(this.maxY/this.scale, this.y)

		// Correct Mouse Coords
		this._setMouseCoords(e)

		this.redraw()

		// Prevent DOM Stuff
		e.preventDefault()
		e.stopPropagation()
	}

	_move(e) {
		this._setMouseCoords(e)
		
		this.redraw()

		// Prevent DOM Stuff
		e.preventDefault()
		e.stopPropagation()
	}

	_setMouseCoords(e) {
		this.mouseX = (e.x/this.scale)-this.x
		this.mouseY = (e.y/this.scale)-this.y
	}

	drawHUD(context) {
		context.save()
		context.font='14px Arial'
		context.fillStyle = 'white'
		context.fillText(
			'Screen (X: '+Math.round(this.x)
			+' Y: '+Math.round(this.y)
			+' W: '+Math.round(this.width)
			+' H: '+Math.round(this.height)+')'
			+' Zoom: '+Math.round(this.scale*100)+'%'
			+' Mouse (X: '+Math.round(this.mouseX)+' Y: '+Math.round(this.mouseY)+')'
			+' Limits Min: (X: '+Math.round(this.minX/this.scale)+', Y: '+Math.round(this.minY/this.scale)+')'
			+' Limit Max: (X: '+Math.round(this.maxX*this.scale)+', Y: '+Math.round(this.maxY*this.scale)+')'
			, 10, 20)
		context.restore()
	}

	mousedown() {}
	mouseup() {}
}

module.exports = GameEngine