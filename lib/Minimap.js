/**
 * Minimap draws a tile map small, as strategy games' radars show it: part of the map (its playable area) a few
 * pixels a tile, scaled up as far as whole pixels go to fill a rectangle of an {@link IndexedSurface}, each cell in a
 * palette colour the game picks, dots for things, and the outline of the part the main view shows, clipped to the
 * rectangle. A cell or a dot may instead be drawn by the game (a function in place of its colour), as games that
 * show a tiny picture a tile on a scaled-up map do. It also finds the cell under a point on it, for a click that
 * moves the view there.
 *
 * @example
const radar = new Minimap({ rect: { x: 256, y: 136, width: 64, height: 64 }, background: 0, outline: 28 })
radar.draw(frame, {
  area: map.limits,
  colour: (x, y) => seen(x, y) ? ground[y][x].radarColour : null,
  dots: units.map((u) => ({ x: u.x, y: u.y, colour: houseColour(u) })),
  view: { x: map.x, y: map.y, width: map.across, height: map.down }
})
const cell = radar.cellAt(mouseX, mouseY, map.limits)
 */
class Minimap {
  /**
   * @param {object} options
   * @property {object} rect Where it draws: `{ x, y, width, height }`
   * @property {integer} background The colour under it (default 0; null leaves what is there)
   * @property {integer} outline The view's outline colour
   */
  constructor (options) {
    this.rect = options.rect
    this.background = options.background === undefined ? 0 : options.background
    this.outline = options.outline
  }

  /** Pixels a cell, for an area of the map: as many whole pixels as fill the rectangle (at least 1). */
  scale (area) {
    var r = this.rect
    return Math.max(1, Math.floor(Math.min(r.width / area.width, r.height / area.height)))
  }

  /**
   * Draws it.
   * @param {IndexedSurface} surface
   * @param {object} options
   * @param {object} options.area The part of the map shown: `{ x, y, width, height }` in cells
   * @param {function} options.colour `(x, y) => colour or null`, for each cell of the area (optional); a function
   *   `(surface, px, py, size)` in place of a colour draws the cell itself
   * @param {object[]} options.dots `{ x, y, colour }` each, in map cells (optional); `colour` may be such a function
   * @param {object} options.view The main view's cells, `{ x, y, width, height }`, outlined (optional)
   */
  draw (surface, options) {
    var r = this.rect
    var a = options.area
    var k = this.scale(a)
    if (this.background !== null) surface.fill(r.x, r.y, r.width, r.height, this.background)
    var cell = (x, y, c) => {
      if (c === null || c === undefined) return
      var px = r.x + (x - a.x) * k
      var py = r.y + (y - a.y) * k
      if (px >= r.x + r.width || py >= r.y + r.height) return
      if (typeof c === 'function') c(surface, px, py, k)
      else surface.fill(px, py, k, k, c)
    }
    if (options.colour) {
      for (var y = a.y; y < a.y + a.height; y++) {
        for (var x = a.x; x < a.x + a.width; x++) cell(x, y, options.colour(x, y))
      }
    }
    for (var d of options.dots || []) {
      if (d.x < a.x || d.y < a.y || d.x >= a.x + a.width || d.y >= a.y + a.height) continue
      cell(d.x, d.y, d.colour)
    }
    if (options.view && this.outline !== undefined) this._outline(surface, options.view, a, k)
  }

  /** The cell `{ x, y }` under a point on the minimap, or null. */
  cellAt (px, py, area) {
    var r = this.rect
    if (px < r.x || py < r.y || px >= r.x + r.width || py >= r.y + r.height) return null
    var k = this.scale(area)
    return { x: area.x + Math.floor((px - r.x) / k), y: area.y + Math.floor((py - r.y) / k) }
  }

  // The view's edges, a pixel wide, clipped to the rectangle
  _outline (surface, view, a, k) {
    var r = this.rect
    var vx = r.x + (view.x - a.x) * k
    var vy = r.y + (view.y - a.y) * k
    var vw = Math.min(view.width, a.width) * k
    var vh = Math.min(view.height, a.height) * k
    var c = this.outline
    var line = (x, y, len, vertical) => {
      for (var i = 0; i < len; i++) {
        var px = vertical ? x : x + i
        var py = vertical ? y + i : y
        if (px >= r.x && py >= r.y && px < r.x + r.width && py < r.y + r.height) surface.set(px, py, c)
      }
    }
    line(vx, vy, vw, false)
    line(vx, vy + vh - 1, vw, false)
    line(vx, vy, vh, true)
    line(vx + vw - 1, vy, vh, true)
  }
}

export default Minimap
