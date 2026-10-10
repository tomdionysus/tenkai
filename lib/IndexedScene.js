import Scene from './Scene.js'

/**
 * IndexedScene shows an {@link IndexedSurface} through a {@link Palette}: each frame it turns the surface's
 * indices into colours and draws the result as its background, under any child scenes and entities. The
 * game draws into the surface and changes the palette; the scene only presents them.
 *
 * Small surfaces can be laid over the picture as `layers`, such as a cursor drawn in the game's own colours.
 * Layers are composed only into what is shown, never into the surface, so game code that reads the surface
 * back does not see them.
 *
 * The picture is drawn at one canvas pixel per surface pixel; use the scene's or the engine's `scale` to
 * enlarge it, with the engine's `pixelated` option for sharp pixels.
 *
 * @extends Scene
 * @example
const frame = new IndexedSurface({ width: 320, height: 200 })
const palette = new Palette({ colors: roomColors })
const pointer = { surface: cursorSurface, x: 0, y: 0, visible: true }
game.addScene('screen', new IndexedScene({ surface: frame, palette, layers: [pointer] }))
 */
class IndexedScene extends Scene {
  /**
   * @param {object} options Scene options, and:
   * @param {IndexedSurface} options.surface The picture
   * @param {Palette} options.palette Its colours
   * @param {object[]} options.layers Surfaces laid over it, each `{ surface, x, y, visible }`, first
   * lowest (optional)
   * @param {function} options.createCanvas Makes the offscreen canvas, as `createCanvas(width, height)`
   * (optional, default a DOM canvas)
   */
  constructor (options = {}) {
    super(options)
    this.surface = options.surface
    this.palette = options.palette
    this.layers = options.layers || []
    this._createCanvas = options.createCanvas || ((w, h) => {
      var canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      return canvas
    })
    this._canvas = null
    this._image = null
  }

  /**
   * Turn the surface and its layers into colours, in an ImageData kept between frames.
   * @returns {ImageData} The image, the size of the surface
   */
  render () {
    var s = this.surface
    if (!this._canvas || this._canvas.width !== s.width || this._canvas.height !== s.height) {
      this._canvas = this._createCanvas(s.width, s.height)
      this._context = this._canvas.getContext('2d')
      this._image = this._context.createImageData(s.width, s.height)
    }
    var rgba = this._image.data
    s.toRGBA(this.palette, rgba)
    for (var layer of this.layers) {
      if (layer.visible === false || !layer.surface) continue
      layer.surface.toRGBAAt(layer.palette || this.palette, rgba, s.width, s.height, Math.round(layer.x || 0), Math.round(layer.y || 0))
    }
    return this._image
  }

  /**
   * Draw the surface, through the palette and with its layers, at the scene's origin.
   * @param {CanvasRenderingContext2D} context
   */
  background (context) {
    if (!this.surface || !this.palette) return
    var image = this.render()
    this._context.putImageData(image, 0, 0)
    context.drawImage(this._canvas, 0, 0)
  }
}

export default IndexedScene
