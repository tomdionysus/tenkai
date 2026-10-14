import Scene from './Scene.js'

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
	* @property {boolean} repeatX Repeat the region across the scene's span, a parallax strip (optional, default
	*   false): `offsetX` then scrolls within the strip, which starts at `sourceX`, `sourceY` of the image
	* @property {integer} sourceX With `repeatX`, where the strip is on the image (optional, default 0)
	* @property {integer} sourceY
	* @property {integer} span With `repeatX`, how far across to cover in pixels (optional, default the game's
	*   width, else the region's)
	* @property {string} fill A colour painted over the span before the image (optional): the sky behind a strip
	*/
  constructor (options = {}) {
    super(options)

    this.offsetX = options.offsetX || 0
    this.offsetY = options.offsetY || 0
    this.repeatX = !!options.repeatX
    this.sourceX = options.sourceX || 0
    this.sourceY = options.sourceY || 0
    this.span = options.span
    this.fill = options.fill || null

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
    if (this.repeatX) this.drawStrip(context)
    else context.drawImage(this.asset.element, this.offsetX, this.offsetY, this.width, this.height, 0, 0, this.width, this.height)
    super.drawContent(context)
  }

  /** How far across a repeating strip covers: `span`, else the game's width, else the strip's own. */
  get spanWidth () {
    if (this.span) return this.span
    var game = this.game
    return game && game.width ? game.width : this.width
  }

  // The strip repeated across the span, scrolled by offsetX (any amount, either way), after the fill
  drawStrip (context) {
    var span = this.spanWidth
    if (this.fill) {
      context.fillStyle = this.fill
      context.fillRect(0, 0, span, this.height)
    }
    var w = this.width
    var start = -(((Math.round(this.offsetX) % w) + w) % w)
    for (var x = start; x < span; x += w) {
      context.drawImage(this.asset.element, this.sourceX, this.sourceY, w, this.height, x, 0, w, this.height)
    }
  }
}

export default BackgroundScene
