const HasScenesMixin = require('./HasScenesMixin')
const HasMobsMixin = require('./HasMobsMixin')

/**
 * Scene is the base class for tiled backgrounds.
 *
 * @mixes HasScenesMixin
 * @mixes HasMobsMixin
 */
class Scene {
	/**
	* Create a new Scene with the specified options.
	* @param {object} options The options for the GameEngine, composed of the properties.
	* @property {Asset} asset The {@link Asset} to use for the Scene tiles 
	* @property {Object} parent The parent of this Scene
	* @property {integer} tileWidth The width of each tile in the asset
	* @property {integer} tileHeight The height of each tile in the asset
	* @property {integer} x The x-coordinate in pixels relative to its parent (optional, default 0)
	* @property {integer} y The y-coordinate in pixels relative to its parent (optional, default 0)
	* @property {integer} z The z-coordinate relative to its parent (optional, default 0)
	* @property {float} scale The current scale (zoom) where 1 = 100% (optional, default 1)
	* @property {boolean} visible Set if this scene is visible (optional, default true)
	* @property {boolean} enableScroll Enable mouse scrolling (optional, default true)
	* @property {integer} perspectiveMode The perspective mode of this Scene
	*/
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

		// The perspective mode for the scene
		this.perspectiveMode = options.perspectiveMode || Scene.PERSPECTIVE_OVERHEAD

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
		var mobYOrder = {}

		if(layer) {
			if (this.perspectiveMode == Scene.PERSPECTIVE_ANGLE) {
				// Now the Mobs for this layer
				var mobs = this.getMobsAtLayer(z)
				for(var m in mobs) {
					var mobY = Math.floor((mobs[m].y+mobs[m].hotspotY) / this.tileHeight)
					mobYOrder[mobY] = mobYOrder[mobY] || []
					mobYOrder[mobY].push(mobs[m])
				}
			}

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
						this.tileHeight
					)
				}
				if (this.perspectiveMode == Scene.PERSPECTIVE_ANGLE) {
					for(var m in mobYOrder[y]) mobYOrder[y][m].draw(context)
				}
			}
		}

		if (this.perspectiveMode == Scene.PERSPECTIVE_OVERHEAD) {
			// Now the Mobs for this layer
			this.drawMobs(context, z)
		}

		// Next draw any subscenes for this layer
		this.drawScenes(context, z)
	}
}

// In PERSPECTIVE_OVERHEAD mode, a Scene will simply draw all tile levels, subscenes and mobs in order from their z-coordinate
Scene.PERSPECTIVE_OVERHEAD = 1
// In PERSPECTIVE_ANGLE mode, the Scene will draw all tile levels, subscenes and mobs in order from their z and y coordinates modified their hotspot y coordinate. 
Scene.PERSPECTIVE_ANGLE = 2

module.exports = Scene
