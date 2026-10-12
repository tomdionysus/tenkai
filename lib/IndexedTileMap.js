/**
 * A map of tiles drawn into part of an {@link IndexedSurface}: a grid of tile numbers, an {@link IndexedSheet} of
 * tiles, and a view onto it (the window it fills on the surface, and which tile is at its top left), as top-down
 * palette games show their maps. Cells can be hidden (never seen, under fog: drawn in the `hidden` colour) and
 * tiles drawn through a colour table. The view scrolls by whole tiles, kept inside the map or a part of it, and
 * finds the cell under a point of the surface.
 *
 * @example
const map = new IndexedTileMap({ sheet: tiles, columns: 64, rows: 64, tileWidth: 16, tileHeight: 16 })
map.window = { x: 0, y: 40, width: 240, height: 160 }
map.scrollTo(20, 30)
map.draw(frame, ground, { visible: (x, y) => seen[y][x] === '1' })
const cell = map.cellAt(game.mouseX, game.mouseY)
 */
class IndexedTileMap {
  /**
   * @param {object} options
   * @param {IndexedSheet} options.sheet The tiles
   * @param {integer} options.columns The map's width in tiles
   * @param {integer} options.rows The map's height in tiles
   * @param {integer} options.tileWidth
   * @param {integer} options.tileHeight
   * @param {object} options.window Where it draws on the surface: { x, y, width, height }
   */
  constructor ({ sheet, columns, rows, tileWidth, tileHeight, window = { x: 0, y: 0, width: 0, height: 0 } }) {
    this.sheet = sheet
    this.columns = columns
    this.rows = rows
    this.tileWidth = tileWidth
    this.tileHeight = tileHeight
    this.window = window
    /** The tile at the window's top left */
    this.x = 0
    this.y = 0
    /** The part of the map the view keeps to: { x, y, width, height } in tiles */
    this.limits = { x: 0, y: 0, width: columns, height: rows }
  }

  /** Tiles the window shows across and down (a part tile counts). */
  get across () {
    return Math.ceil(this.window.width / this.tileWidth)
  }

  get down () {
    return Math.ceil(this.window.height / this.tileHeight)
  }

  /** Keeps the view to a part of the map. */
  limit (rect) {
    this.limits = rect
    this.scrollBy(0, 0)
  }

  /** Puts a tile at the window's top left, kept inside the limits. */
  scrollTo (x, y) {
    this.x = x
    this.y = y
    this.scrollBy(0, 0)
  }

  /** Moves the view by whole tiles, kept inside the limits; whether it moved. */
  scrollBy (dx, dy) {
    var l = this.limits
    var across = Math.min(Math.floor(this.window.width / this.tileWidth), l.width)
    var down = Math.min(Math.floor(this.window.height / this.tileHeight), l.height)
    var x = Math.max(l.x, Math.min(l.x + l.width - across, this.x + dx))
    var y = Math.max(l.y, Math.min(l.y + l.height - down, this.y + dy))
    var moved = x !== this.x || y !== this.y
    this.x = x
    this.y = y
    return moved
  }

  /** Centres the view on a tile, as near as the limits allow. */
  centreOn (x, y) {
    this.scrollTo(Math.round(x - this.window.width / this.tileWidth / 2), Math.round(y - this.window.height / this.tileHeight / 2))
  }

  /** The map cell under a point of the surface, as { x, y }, or null outside the window or the map. */
  cellAt (px, py) {
    var w = this.window
    if (px < w.x || py < w.y || px >= w.x + w.width || py >= w.y + w.height) return null
    var x = this.x + Math.floor((px - w.x) / this.tileWidth)
    var y = this.y + Math.floor((py - w.y) / this.tileHeight)
    return x < this.columns && y < this.rows ? { x, y } : null
  }

  /** Where a map cell's top left is on the surface (it may be outside the window). */
  pointOf (x, y) {
    return { x: this.window.x + (x - this.x) * this.tileWidth, y: this.window.y + (y - this.y) * this.tileHeight }
  }

  /**
   * Draws the tiles under the view into the window, clipped to it.
   * @param {IndexedSurface} surface
   * @param {integer[]} tiles The map's tile numbers, row by row (columns x rows)
   * @param {object} options
   * @param {function} options.visible visible(x, y): whether a cell shows (default all)
   * @param {integer} options.hidden The colour of a cell that does not show (default 0)
   * @param {function} options.map map(x, y): a colour table for a cell's tile, or undefined (optional)
   */
  draw (surface, tiles, options = {}) {
    var w = this.window
    var visible = options.visible
    var hidden = options.hidden || 0
    var tw = this.tileWidth
    var th = this.tileHeight
    for (var ty = 0; ty < this.down; ty++) {
      var y = this.y + ty
      var py = w.y + ty * th
      var h = Math.min(th, w.y + w.height - py)
      for (var tx = 0; tx < this.across; tx++) {
        var x = this.x + tx
        var px = w.x + tx * tw
        var cw = Math.min(tw, w.x + w.width - px)
        if (x >= this.columns || y >= this.rows || (visible && !visible(x, y))) {
          surface.fill(px, py, cw, h, hidden)
          continue
        }
        var tile = this.sheet.get(tiles[y * this.columns + x])
        if (!tile) continue
        surface.blit(tile, { w: cw, h, dx: px, dy: py, map: options.map ? options.map(x, y) : undefined })
      }
    }
  }
}

export default IndexedTileMap
