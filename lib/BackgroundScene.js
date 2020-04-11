const Scene = require('./Scene')

/**
 * BackgroundScene is the base class for static backgrounds.
 *
 * @extends Scene
 * @example
 <caption>Create a new BackgroundScene from an {@link Asset}</caption>
var mainMapBackgroundAsset = new Asset({ name: 'mainMapBackgroundAsset', src: 'assets/mainmap_background.png' })
var scene = new BackgroundScene({ asset: mainMapBackgroundAsset, x: 0, y: 0 })
 */
class BackgroundScene extends Scene {
	/**
	* Create a new BackgroundScene with the specified options.
	* @param {object} options The options for the BackgroundScene, composed of the properties.
	* @property {integer} offsetX The offset x-coordinate in the asset in pixels (optional, default 0)
	* @property {integer} offsetY The offset y-coordinate in the asset in pixels (optional, default 0)
	* @property {integer} tileWidth The width in pixels (optional, default asset width)
	* @property {integer} tileHeight The height in pixels (optional, default asset height)
	*/
	constructor(options = {}) {
		options = options || {}

		this.offsetX = options.offsetX || 0
		this.offsetY = options.offsetY || 0

		this.width = options.width || this.asset.element.width
		this.height = options.height || this.asset.element.height

		super(options)
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

		// Ensure Scene sort order
		if(!this._sceneOrderMap) this.sortScenesZ()

		// Ensure mob sort order
		if(!this._mobOrderMap) this.sortMobsZ()

		// Get all valid z values for layers, scenes and mobs
		var layerKeys = Object.assign({}, this.layers)
		Object.assign(layerKeys, this._sceneOrderMap)
		Object.assign(layerKeys, this._mobOrderMap)
		layerKeys = Object.keys(layerKeys).sort()

		// Draw Background Image
		context.drawImage(
			this.asset.element, 
			this.offsetX,
			this.offsetY,
			this.width, 
			this.height,
			0, 
			0,
			this.asset.width, 
			this.asset.height
		)

		// Restore the context params for the next thing being drawn
		context.restore()

		// Now the Mobs for this layer
		this.drawMobs(context)
		
		// Next draw any subscenes for this layer
		this.drawScenes(context)

		// Reset the redraw flag
		this._doredraw = false
	}
}

// In PERSPECTIVE_OVERHEAD mode, a BackgroundScene will simply draw all tile levels, subscenes and mobs in order from their z-coordinate
BackgroundScene.PERSPECTIVE_OVERHEAD = 1
// In PERSPECTIVE_ANGLE mode, the BackgroundScene will draw all tile levels, subscenes and mobs in order from their z and y coordinates modified their hotspot y coordinate. 
BackgroundScene.PERSPECTIVE_ANGLE = 2

module.exports = BackgroundScene
