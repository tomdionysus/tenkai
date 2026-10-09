/**
 * A Sheet is an image divided into a grid of equal tiles, with a description of how to use them. The same
 * class serves sprite sheets, whose tiles are animation frames, and tilesets, whose tiles build maps.
 *
 * A sheet can describe:
 * - where its grid is in the image (`offsetX`, `offsetY`, `spacing`), so several sheets can share one
 *   image laid out as separate grids;
 * - an `anchor`, the point in each tile that an Entity's position refers to, such as a character's feet;
 * - named animation `clips`, shared by every entity that uses the sheet;
 * - for tilesets, what each tile is (`tiles`): flat or upright, its elevation, whether it is solid;
 * - for tilesets, named `objects` made of several tiles, such as a chair, for editors to place whole.
 *
 * @example
const cat = new Sheet({
  image: game.getAsset('cat'),
  tileWidth: 64,
  tileHeight: 64,
  anchor: [32, 60],
  clips: {
    walkDown: { row: 0, columns: [0, 1, 2, 1], delay: 100, loop: true },
    sleep: { frames: [[0, 4], [1, 4], [2, 4, 400]], delay: 200 }
  }
})
 */
class Sheet {
  /**
   * @param {object} options
   * @param {Asset|HTMLImageElement|HTMLCanvasElement} options.image The image, or an Asset holding it
   * @param {integer} options.tileWidth Width of a tile (optional, default the whole image)
   * @param {integer} options.tileHeight Height of a tile (optional, default the whole image)
   * @param {integer} options.offsetX Pixel position of the first tile (optional, default 0)
   * @param {integer} options.offsetY (optional, default 0)
   * @param {integer} options.spacing Pixels between neighbouring tiles (optional, default 0)
   * @param {number[]} options.anchor [x, y] within a tile that positions refer to (optional, default [0, 0])
   * @param {object} options.clips Named animation clips (optional, see {@link Sheet#clip})
   * @param {object} options.tiles Tile descriptions keyed "column,row" (optional, see {@link Sheet#info})
   * @param {object} options.objects Named groups of tiles (optional)
   */
  constructor (options = {}) {
    this.image = options.image
    this._tileWidth = options.tileWidth
    this._tileHeight = options.tileHeight
    this.offsetX = options.offsetX || 0
    this.offsetY = options.offsetY || 0
    this.spacing = options.spacing || 0
    this.anchor = options.anchor || [0, 0]
    this.tiles = options.tiles || {}
    this.objects = options.objects || {}
    this.clips = {}
    for (var name in options.clips || {}) this.addClip(name, options.clips[name])
  }

  /** The image element (resolving an Asset). */
  get element () {
    return this.image && this.image.element ? this.image.element : this.image
  }

  get tileWidth () { return this._tileWidth || (this.element ? this.element.width : 0) }
  get tileHeight () { return this._tileHeight || (this.element ? this.element.height : 0) }

  /**
   * Define a named clip. A clip is a list of frames, each a tile `[column, row]`, optionally with its own
   * delay: `[column, row, delay]`. It can be given as:
   * - `{ frames: [[0, 1], [1, 1, 200]] }`
   * - `{ row: 1, columns: [0, 1, 2, 1] }`: those columns of one row
   * - `{ row: 1, count: 6 }`: the first `count` columns of one row
   *
   * with `delay` (milliseconds per frame, default 100) and `loop` (default false).
   * @returns {object} The clip
   */
  addClip (name, def) {
    var frames = def.frames
    if (!frames) {
      var columns = def.columns || Array.from({ length: def.count || 1 }, (_, i) => i)
      frames = columns.map((c) => [c, def.row || 0])
    }
    var clip = { name, frames, delay: def.delay == null ? 100 : def.delay, loop: !!def.loop }
    this.clips[name] = clip
    return clip
  }

  /** A clip by name, or the clip itself if one is given. */
  clip (nameOrClip) {
    return typeof nameOrClip === 'string' ? this.clips[nameOrClip] : nameOrClip
  }

  /**
   * The source rectangle of a tile in the image.
   * @returns {number[]} [x, y, width, height]
   */
  source (tile) {
    var w = this.tileWidth
    var h = this.tileHeight
    return [this.offsetX + tile[0] * (w + this.spacing), this.offsetY + tile[1] * (h + this.spacing), w, h]
  }

  /** The number of columns and rows in the image. */
  get columns () { return Math.floor((this.element.width - this.offsetX + this.spacing) / (this.tileWidth + this.spacing)) }
  get rows () { return Math.floor((this.element.height - this.offsetY + this.spacing) / (this.tileHeight + this.spacing)) }

  /**
   * Draw a tile with its top-left at (x, y).
   */
  draw (context, tile, x, y) {
    var [sx, sy, w, h] = this.source(tile)
    context.drawImage(this.element, sx, sy, w, h, x, y, w, h)
  }

  /**
   * What a tile is, with defaults filled in:
   * - `flat` (default true): lies on the ground, like floor or a rug, and is drawn under everything upright
   * - `elevation` (default 0): height in pixels; things at the same depth are drawn lowest first
   * - `stand` (default 0): rows below this tile that its object stands on; a chair back drawn one row above
   *   its seat has `stand: 1`
   * - `solid` (default false): blocks movement
   *
   * A description that gives `stand` or `elevation` but not `flat` is upright. Any other properties in a
   * description, such as `seat: true`, are passed through for the game to use.
   * @param {number[]} tile [column, row]
   * @param {object} overrides Values that replace the sheet's for one placement (optional)
   */
  info (tile, overrides) {
    var d = Object.assign({}, this.tiles[tile[0] + ',' + tile[1]], overrides)
    var flat = d.flat != null ? !!d.flat : (d.stand == null && d.elevation == null)
    return Object.assign(d, { flat, elevation: d.elevation || 0, stand: d.stand || 0, solid: !!d.solid })
  }
}

module.exports = Sheet
