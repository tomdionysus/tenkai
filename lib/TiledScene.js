const Scene = require('./Scene')

/**
 * TiledScene is the base class for tiled backgrounds.
 *
 * @extends Scene
 * @example
 <caption>Create a new TiledScene with 16x16 tiles from an {@link Asset}</caption>
var mainMapTilesAsset = new Asset({ name: 'mainMapTilesAsset', src: 'assets/mainmap_tileset.png' })
var scene = new TiledScene({ asset: mainMapTilesAsset, tileWidth: 16, tileHeight: 16, x: 0, y: 0 })
 */
class TiledScene extends Scene {
  /**
	* Create a new TiledScene with the specified options.
	* @param {object} options The options for the TiledScene, composed of the properties.
	* @property {integer} tileWidth The width of each tile in the asset
	* @property {integer} tileHeight The height of each tile in the asset
	* @property {integer} perspectiveMode The perspective mode of this TiledScene
	*/
  constructor (options = {}) {
    super(options)

    // The width and height of the layers in the asset
    this.tileWidth = options.tileWidth || 32
    this.tileHeight = options.tileHeight || 32

    // The perspective mode for the TiledScene
    this.perspectiveMode = options.perspectiveMode || TiledScene.PERSPECTIVE_OVERHEAD

    this.layers = options.layers || {}

    this.redraw()
  }

  /**
	* Draw the TiledScene into the given context.
	* @param {CanvasRenderingContext2D} context The context in which to draw
	*/
  draw (context) {
    // If we're not marked for a redraw or we're invisible, return
    if (!this._doredraw || !this.visible) return

    // Save the context params
    context.save()

    // Reset the origin to our coordinates (so child entities are relative to us)
    context.translate(this.x, this.y)
    context.scale(this.scale, this.scale)
    context.rotate(this.rotate)

    var i

    // Ensure Scene sort order
    if (!this._sceneOrderMap) this.sortScenesZ()

    // Draw layers in order, with scenes
    for (i in this.layers) this._drawLayer(context, i)

    // Draw Entities
    this.drawEntities(context)

    // Restore the context params for the next thing being drawn
    context.restore()

    // Reset the redraw flag
    this._doredraw = false
  }

  _drawLayer (context, z) {
    // Draw the layer
    var layer = this.layers[z]

    if (layer) {
      for (var y = 0; y < layer.length; y++) {
        for (var x = 0; x < layer[y].length; x++) {
          if (!layer[y][x]) continue
          context.drawImage(
            this.asset.element,
            layer[y][x][0] * this.tileWidth,
            layer[y][x][1] * this.tileHeight,
            this.tileWidth,
            this.tileHeight,
            x * this.tileWidth,
            y * this.tileHeight,
            this.tileWidth,
            this.tileHeight
          )
        }
      }
    }

    // Next draw any subscenes for this layer
    this.drawScenes(context, z)
  }
}

module.exports = TiledScene
