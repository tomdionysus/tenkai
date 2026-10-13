import IndexedSurface from './IndexedSurface.js'
import Sheet from './Sheet.js'

/**
 * The pictures of an {@link IndexedSheet} as {@link Sheet}s for {@link Entity}s: each picture through a palette and
 * a colour table (a house's colours, a blink's white), mirrored or not, made into a canvas the first time it is asked
 * for and kept. Palette games draw one picture in many colourings; this is how a canvas-drawn scene shows them
 * without recolouring every frame. Pictures made some other way (several tiles of a building put together) are made
 * once and kept the same way (`make`).
 *
 * A colour table is kept by identity: build each once (`IndexedSurface.table`) and pass the same array again.
 *
 * @example
const sprites = new IndexedSprites({ sheet: unitPictures, palette, anchor: 'centre' })
const blue = IndexedSurface.table([1, 2, 3], [5, 6, 7], 32)
tank.sheet = sprites.get(111, { map: blue, flip: true })
 */
class IndexedSprites {
  /**
   * @param {object} options
   * @property {IndexedSheet} sheet The pictures
   * @property {Palette} palette The palette they are shown through
   * @property {string|function} anchor `'centre'`, `'topleft'` (the default), or `(width, height) => [x, y]`
   * @property {function} createCanvas `createCanvas(width, height)` (default a DOM canvas)
   */
  constructor (options) {
    this.sheet = options.sheet
    this.palette = options.palette
    this.anchor = options.anchor || 'topleft'
    this.createCanvas = options.createCanvas
    this.cache = new Map()
    this._tables = new WeakMap()
    this._nextTable = 1
  }

  /** How many canvases are kept. */
  get size () {
    return this.cache.size
  }

  /**
   * Picture `n` as a one-picture Sheet, through a colour table, mirrored either way or not; null if there is no such
   * picture.
   * @param {integer} n
   * @param {object} options
   * @param {integer[]} options.map A colour table (optional)
   * @param {boolean} options.flip Mirrored left to right (optional)
   * @param {boolean} options.upsideDown Mirrored top to bottom (optional)
   */
  get (n, options = {}) {
    var key = (options.flip ? 'f' : 'p') + (options.upsideDown ? 'u' : '') + n + ':' + this._tableKey(options.map)
    return this._kept(key, () => {
      var pic = this.sheet.get(n)
      if (!pic) return null
      var s = new IndexedSurface({ width: pic.width, height: pic.height, transparent: true })
      s.blit(pic, { map: options.map, flip: !!options.flip })
      if (options.upsideDown) s.flipVertical()
      return s
    })
  }

  /**
   * A picture made once by `paint` into a transparent surface of its size, kept under `key`.
   * @param {string} key
   * @param {integer} width
   * @param {integer} height
   * @param {function} paint `(surface, sheet) => {}`
   */
  make (key, width, height, paint) {
    return this._kept('m' + key, () => {
      var s = new IndexedSurface({ width, height, transparent: true })
      paint(s, this.sheet)
      return s
    })
  }

  /** Forget every canvas (after the palette changes). */
  clear () {
    this.cache.clear()
  }

  _kept (key, surface) {
    if (!this.cache.has(key)) {
      var s = surface()
      this.cache.set(key, s ? this._toSheet(s) : null)
    }
    return this.cache.get(key)
  }

  _toSheet (s) {
    var anchor = typeof this.anchor === 'function' ? this.anchor(s.width, s.height)
      : this.anchor === 'centre' ? [s.width >> 1, s.height >> 1] : [0, 0]
    return new Sheet({ image: s.toCanvas(this.palette, { createCanvas: this.createCanvas }), anchor })
  }

  _tableKey (table) {
    if (!table) return 0
    if (!this._tables.has(table)) this._tables.set(table, this._nextTable++)
    return this._tables.get(table)
  }
}

export default IndexedSprites
