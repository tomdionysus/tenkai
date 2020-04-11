const HasScenesMixin = require('./HasScenesMixin')
const HasEntitiesMixin = require('./HasEntitiesMixin')

/**
 * Scene is the base class for scenes, which can contain child Scenes, {@link Entity}s, and {@link Props}
 *
 * @mixes HasScenesMixin
 * @mixes HasEntitiesMixin
 * @abstract
 */
class Scene {
	/**
	* Create a new Scene with the specified options.
	* @param {object} options The options for the GameEngine, composed of the properties.
	* @property {Asset} asset The {@link Asset} to use for the Scene tiles 
	* @property {Object} parent The parent of this Scene
	* @property {integer} x The x-coordinate in pixels relative to its parent (optional, default 0)
	* @property {integer} y The y-coordinate in pixels relative to its parent (optional, default 0)
	* @property {integer} z The z-coordinate relative to its parent (optional, default 0)
	* @property {float} scale The current scale (zoom) where 1 = 100% (optional, default 1)
	* @property {boolean} visible Set if this Scene is visible (optional, default true)
	* @property {boolean} enableScroll Enable mouse scrolling (optional, default true)
	*/
	constructor(options = {}) {
		// A Scene can have subscenes
		HasScenesMixin(this, options)
		
		// A Scene can have mobs
		HasEntitiesMixin(this)

		// Asset is the graphical asset used for drawing this Scene.
		// Usually, an asset will be divided up into 'layers' of a specified width and height. 
		// A Scene will display a large array of these layers for each layer, and a Scene may contain multiple layers.
		// Layers are drawn in ascending order, and each layer be associated with a group of mobs, based on the mob's z.
		this.asset = options.asset

		// The current X/Y from the origin of the container (the GameEngine, or the parent Scene)
		this.x = options.x || 0
		this.y = options.y || 0

		// The Z index, in the stack of the container (the GameEngine, or the parent Scene)
		this.z = options.z || 0
		
		// The Parent container (the GameEngine, or the parent Scene)
		this.parent = typeof(options.parent)=='undefined' ? null : options.parent

		// The visible flag. Invisible Scenes and their children are not drawn
		this.visible = typeof(options.visible)=='undefined' ? true : !!options.visible

		// The scale and rotation settings for this Scene. This context affects all child scenes and mobs also
		this.scale = typeof(options.scale)=='undefined' ? 1 : options.scale
		this.rotate = typeof(options.rotate)=='undefined' ? 0 : options.rotate

		this.redraw()
	}

	redraw() {
		this._doredraw = true
		this.redrawEntities()
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

		// Scene Drawing Logic should go here.

		// Restore the context params for the next thing being drawn
		context.restore()

		// Reset the redraw flag
		this._doredraw = false
	}
}

module.exports = Scene