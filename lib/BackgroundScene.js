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
	* @property {integer} width The width in pixels (optional, default asset width)
	* @property {integer} height The height in pixels (optional, default asset height)
	*/
	constructor(options = {}) {
		super(options)

		this.offsetX = options.offsetX || 0
		this.offsetY = options.offsetY || 0

		this.width = options.width
		this.height = options.height
		if (typeof(this.width)==='undefined' && this.asset) this.width = this.asset.element.width
		if (typeof(this.height)==='undefined' && this.asset) this.height = this.asset.element.height
	}

	/**
	* Draw the BackgroundScene into the given context.
	* @param {CanvasRenderingContext2D} context The context in which to draw
	*/
	draw(context) {
		// If we're not marked for a redraw or we're invisible, return
		if(!this._doredraw || !this.visible) return

		// Save the context params
		context.save()

		// Reset the origin to our coordinates (so child entities are relative to us)
		context.translate(this.x, this.y)
		context.scale(this.scale, this.scale)
		context.rotate(this.rotate)

		// Ensure Scene sort order
		if(!this._sceneOrderMap) this.sortScenesZ()

		// Ensure entity sort order
		if(!this._entityOrderMap) this.sortEntitiesZ()

		// Get all valid z values for layers, scenes and entities
		var layerKeys = Object.assign({}, this.layers)
		Object.assign(layerKeys, this._sceneOrderMap)
		Object.assign(layerKeys, this._entityOrderMap)
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
			this.width, 
			this.height
		)

		// Restore the context params for the next thing being drawn
		context.restore()

		// Now the Entities for this layer
		this.drawEntities(context)
		
		// Next draw any subscenes for this layer
		this.drawScenes(context)

		// Reset the redraw flag
		this._doredraw = false
	}
}

module.exports = BackgroundScene
