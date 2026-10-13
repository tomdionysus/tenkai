/**
 * Marks draws what a strategy or tile game marks over its map on a canvas, one pixel wide, in a palette's colours:
 * a selected thing's outline, the corners round a selected unit, and a box crossed by both diagonals (a place a
 * building may not go). Coordinates are the canvas's pixels (a scene's foreground draws them in the scene's own).
 *
 * @example
const marks = new Marks({ palette: mapPalette })
things.foreground = (context) => {
  marks.outline(context, 32, 48, 48, 32, 28)
  marks.corners(context, tank.x - 8, tank.y - 8, 16, 16, 3, 28)
  if (!allowed) marks.crossed(context, cell.x * 16, cell.y * 16, 32, 32, 28)
}
 */
class Marks {
  /**
   * @param {object} options
   * @property {Palette} palette The colours marks are given in by number
   */
  constructor (options) {
    this.palette = options.palette
    this._styles = {}
  }

  /** A palette number as a canvas colour. */
  colour (n) {
    if (!this._styles[n]) {
      var [r, g, b] = this.palette.get(n)
      this._styles[n] = 'rgb(' + r + ',' + g + ',' + b + ')'
    }
    return this._styles[n]
  }

  /** A rectangle's edges. */
  outline (context, x, y, w, h, n) {
    context.fillStyle = this.colour(n)
    context.fillRect(x, y, w, 1)
    context.fillRect(x, y + h - 1, w, 1)
    context.fillRect(x, y, 1, h)
    context.fillRect(x + w - 1, y, 1, h)
  }

  /** The four corners of a rectangle, each `length` pixels along both edges. */
  corners (context, x, y, w, h, length, n) {
    context.fillStyle = this.colour(n)
    var r = x + w - 1
    var b = y + h - 1
    for (var [cx, cy, dx, dy] of [[x, y, 1, 1], [r, y, -1, 1], [x, b, 1, -1], [r, b, -1, -1]]) {
      context.fillRect(Math.min(cx, cx + (length - 1) * dx), cy, length, 1)
      context.fillRect(cx, Math.min(cy, cy + (length - 1) * dy), 1, length)
    }
  }

  /** A rectangle's edges and both its diagonals. */
  crossed (context, x, y, w, h, n) {
    this.outline(context, x, y, w, h, n)
    var W = w - 1
    var H = h - 1
    for (var i = 0; i <= W; i++) {
      var j = Math.round(i * H / W)
      context.fillRect(x + i, y + j, 1, 1)
      context.fillRect(x + i, y + H - j, 1, 1)
    }
  }
}

export default Marks
