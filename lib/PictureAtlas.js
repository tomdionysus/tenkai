/**
 * A PictureAtlas is one picture holding many, each a named rectangle of it: a UI sheet's panels, portraits and
 * frames, a map and its route. A piece is drawn by name, whole or a part of it from its left or top (a route
 * revealed bit by bit). Where a {@link Sheet} is a grid of equal tiles, an atlas's pieces are any size, where
 * they were packed.
 *
 * @example
const art = new PictureAtlas({ image: game.getAsset('ui'), regions: { throne: [0, 0, 320, 224], map: [0, 224, 142, 226] } })
art.draw(context, 'throne', 0, 0)
art.draw(context, 'map', 89, 0, { width: reveal })   // the left `reveal` pixels of it
 */
class PictureAtlas {
  /**
   * @param {object} options
   * @param {Asset|HTMLImageElement|HTMLCanvasElement} options.image The picture, or an Asset holding it
   * @param {object} options.regions Each piece's place on the picture by name: `[x, y, width, height]`, or
   *   `{ x, y, width, height }`
   */
  constructor (options = {}) {
    this.image = options.image
    this.regions = {}
    for (const name of Object.keys(options.regions || {})) {
      const r = options.regions[name]
      this.regions[name] = Array.isArray(r) ? { x: r[0], y: r[1], width: r[2], height: r[3] } : Object.assign({}, r)
    }
  }

  /** The image element (resolving an Asset). */
  get element () {
    return this.image && this.image.element ? this.image.element : this.image
  }

  /** Whether the atlas has a piece of that name. */
  has (name) {
    return name in this.regions
  }

  /** A piece's place on the picture, `{ x, y, width, height }`, or undefined. */
  region (name) {
    return this.regions[name]
  }

  /**
   * Piece `name` drawn with its top left at (x, y), whole or in part.
   * @param {CanvasRenderingContext2D} context
   * @param {string} name
   * @param {number} x
   * @param {number} y
   * @param {object} options `width`, `height`: only that much of it, from its left and top (optional)
   */
  draw (context, name, x, y, options = {}) {
    const r = this.regions[name]
    if (!r) return
    const w = Math.max(0, Math.min(r.width, options.width === undefined ? r.width : options.width))
    const h = Math.max(0, Math.min(r.height, options.height === undefined ? r.height : options.height))
    if (!w || !h) return
    const scale = options.scale === undefined ? 1 : options.scale
    if (scale === 1 && !options.flipX && !options.flipY && options.alpha === undefined && !options.filter) {
      context.drawImage(this.element, r.x, r.y, w, h, Math.round(x), Math.round(y), w, h)
      return
    }
    // Scaled, mirrored, see-through or filtered (a weapon in hand, darker in the shade): about its top left
    const dw = w * scale, dh = h * scale
    context.save()
    if (options.alpha !== undefined) context.globalAlpha *= options.alpha
    if (options.filter) context.filter = options.filter
    context.translate(x + (options.flipX ? dw : 0), y + (options.flipY ? dh : 0))
    context.scale(options.flipX ? -1 : 1, options.flipY ? -1 : 1)
    context.drawImage(this.element, r.x, r.y, w, h, 0, 0, dw, dh)
    context.restore()
  }

}

export default PictureAtlas
