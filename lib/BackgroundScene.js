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
  constructor (options = {}) {
    super(options)

    this.offsetX = options.offsetX || 0
    this.offsetY = options.offsetY || 0

    this.width = options.width
    this.height = options.height
    if (typeof (this.width) === 'undefined' && this.asset) this.width = this.asset.element.width
    if (typeof (this.height) === 'undefined' && this.asset) this.height = this.asset.element.height
  }

  /**
	* Draw the image, then child scenes and entities.
	* @param {CanvasRenderingContext2D} context The context in which to draw
	*/
  drawContent (context) {
    context.drawImage(this.asset.element, this.offsetX, this.offsetY, this.width, this.height, 0, 0, this.width, this.height)
    super.drawContent(context)
  }
}

module.exports = BackgroundScene
