import IndexedSurface from './IndexedSurface.js'

/**
 * A set of pictures in palette numbers, by number: the cells of a grid (a tileset) or the frames of an atlas (a
 * game's sprites, each its own size), cut once from one {@link IndexedSurface}. Several sheets can be joined into
 * one numbering, as old games number their sprites across the files they load. Drawn into a surface with
 * {@link IndexedSurface#blit}'s options: a colour table (`map`, a house's or a shadow's colours) and `flip`.
 *
 * @example
const tiles = IndexedSheet.grid(tileSurface, 16, 16, 418)
const sprites = IndexedSheet.join([IndexedSheet.atlas(mouse, mouseFrames), IndexedSheet.atlas(units, unitFrames)])
sprites.draw(frame, 111, 40, 60, { map: houseColours, flip: true })
 */
class IndexedSheet {
  /**
   * @param {IndexedSurface[]} pictures
   */
  constructor (pictures = []) {
    this.pictures = pictures
  }

  /** How many pictures. */
  get length () {
    return this.pictures.length
  }

  /** Picture `n`, or undefined. */
  get (n) {
    return this.pictures[n]
  }

  /**
   * Draws picture `n` with its top left at x, y. Options as `blit`'s (`map`, `flip`, `key`, `mask`). Drawing a
   * missing picture draws nothing.
   */
  draw (surface, n, x, y, options = {}) {
    var p = this.pictures[n]
    if (!p) return
    surface.blit(p, Object.assign({}, options, { dx: x, dy: y }))
  }

  /**
   * The cells of a grid, left to right and top to bottom.
   * @param {IndexedSurface} source
   * @param {integer} width A cell's width
   * @param {integer} height A cell's height
   * @param {integer} count How many cells (default all the grid holds)
   */
  static grid (source, width, height, count) {
    var across = Math.floor(source.width / width)
    var n = count === undefined ? across * Math.floor(source.height / height) : count
    var out = []
    for (var k = 0; k < n; k++) out.push(IndexedSheet.cut(source, (k % across) * width, Math.floor(k / across) * height, width, height))
    return new IndexedSheet(out)
  }

  /**
   * The frames of an atlas, each `{ x, y, w, h }`.
   * @param {IndexedSurface} source
   * @param {object[]} frames
   */
  static atlas (source, frames) {
    return new IndexedSheet(frames.map((f) => IndexedSheet.cut(source, f.x, f.y, f.w, f.h)))
  }

  /** Several sheets as one, numbered on from one to the next. */
  static join (sheets) {
    var out = []
    for (var s of sheets) out.push(...s.pictures)
    return new IndexedSheet(out)
  }

  /** A rectangle of a surface as a transparent surface of its own. */
  static cut (source, x, y, w, h) {
    var p = new IndexedSurface({ width: Math.max(1, w), height: Math.max(1, h), transparent: true })
    p.blit(source, { sx: x, sy: y, w, h })
    return p
  }
}

export default IndexedSheet
