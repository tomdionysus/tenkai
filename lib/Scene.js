const HasScenesMixin = require('./HasScenesMixin')
const HasMobsMixin = require('./HasMobsMixin')

class Scene {
	constructor(options = {}) {
		options = options || {}

		// A Scene can have subscenes
		HasScenesMixin(this, options)
		
		// A Scene can have mobs
		HasMobsMixin(this)

		// Asset is the graphical asset used for drawing this scene.
		// Usually, an asset will be divided up into 'layers' of a specified width and height. 
		// A scene will display a large array of these layers for each layer, and a scene may contain multiple layers.
		// Layers are drawn in ascending order, and each layer be associated with a group of mobs, based on the mob's z.
		this.asset = options.asset

		// The width and height of the layers in the asset
		this.tileWidth = options.tileWidth || 32
		this.tileHeight = options.tileHeight || 32

		// The current X/Y from the origin of the container (the GameEngine, or the parent Scene)
		this.x = options.x || 0
		this.y = options.y || 0

		// The Z index, in the stack of the container (the GameEngine, or the parent Scene)
		this.z = options.z || 0
		
		// The Parent container (the GameEngine, or the parent Scene)
		this.parent = typeof(options.parent)=='undefined' ? null : options.parent

		// The visible flag. Invisible Scenes and their children are not drawn
		this.visible = typeof(options.visible)=='undefined' ? true : !!options.visible

		// The scale and rotation settings for this scene. This context affects all child scenes and mobs also
		this.scale = typeof(options.scale)=='undefined' ? 1 : options.scale
		this.rotate = typeof(options.rotate)=='undefined' ? 0 : options.rotate

		// This is for testing and will be removed.
		var m = []
		var m2 = []
		for(var y=0; y<16; y++) {
			var r = [], r2 = []
			for (var x=0; x<20; x++) {
				r.push( [ 24+(Math.round(Math.random()*2)), Math.random()*2 ], [ 24+(Math.round(Math.random()*2)), Math.random()*2 ], [ 24+(Math.round(Math.random()*2)), Math.random()*2] )
				r2.push[ null, null, null, null ]
			}
			m.push(r)
			m2.push(r2)
		}

		m2[6][10] = [18,2]
		m2[6][11] = [19,2]
		m2[7][10] = [18,3]
		m2[7][11] = [19,3]

		this.layers = options.layers || { 0: m, 1: m2 }

		this.redraw()
	}

	redraw() {
		this._doredraw = true
		this.redrawMobs()
	}

	draw(context) {
		// If we're not marked for a redraw or we're invisible, return
		if(!this._doredraw || !this.visible) return

		// Save the context params
		context.save()

		// Reset the origin to our coordinates (so child mobs are relative to us)
		context.translate(this.x, this.y)
		context.scale(this.scale, this.scale)
		context.rotate(this.rotate)

		// Ensure scene sort order
		if(!this._sceneOrderMap) this.sortScenesZ()

		// Ensure mob sort order
		if(!this._mobOrderMap) this.sortMobsZ()

		// Get all valid z values for layers, scenes and mobs
		var layerKeys = Object.assign({}, this.layers)
		Object.assign(layerKeys, this._sceneOrderMap)
		Object.assign(layerKeys, this._mobOrderMap)
		layerKeys = Object.keys(layerKeys).sort()

		// Draw layers in order, with scenes and mobs
		for(var i in layerKeys) this._drawLayer(context, i)

		// Restore the context params for the next thing being drawn
		context.restore()

		// Reset the redraw flag
		this._doredraw = false
	}

	_drawLayer(context, z) {
		// Draw the layer
		var layer = this.layers[z]
		if(layer) {
			for(var y=0; y<layer.length; y++) {
				for(var x=0; x<layer[y].length; x++) {
					if(!layer[y][x]) continue
					context.drawImage(
						this.asset.element, 
						layer[y][x][0]*this.tileWidth, 
						layer[y][x][1]*this.tileHeight, 
						this.tileWidth, 
						this.tileHeight,
						x*this.tileWidth, 
						y*this.tileHeight,
						this.tileWidth, 
						this.tileHeight,
					)
				}
			}
		}

		// Next draw any subscenes for this layer
		this.drawScenes(context, z)

		// Now the Mobs for this layer
		this.drawMobs(context, z)
	}
}

Scene.PERSPECTIVE_OVERHEAD = 1
Scene.PERSPECTIVE_ANGLE = 2

module.exports = Scene
