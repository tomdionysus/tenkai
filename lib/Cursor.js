/**
 * Cursor draws an image cursor on the canvas, so cursors scale with the game and can be any picture.
 * Hide the system cursor over the canvas (`element.style.cursor = 'none'`) when using it.
 *
 * @example
const cursor = new Cursor()
cursor.define('hand', handImage, 6, 1)
cursor.define('forward', arrowImage, 8, 0)
// in a Scene's draw:
cursor.draw(context, game.mouseX, game.mouseY, hotspots.cursorAt(game.mouseX, game.mouseY, 'hand'))
 */
class Cursor {
  constructor () {
    this.cursors = {}
    this.hidden = false
  }

  /**
   * Define a cursor.
   * @param {*} id The cursor's name or number
   * @param {HTMLImageElement|HTMLCanvasElement} image The picture
   * @param {number} x The hotspot (the point that clicks) within the picture
   * @param {number} y
   */
  define (id, image, x = 0, y = 0) {
    this.cursors[id] = { image, x, y }
  }

  /**
   * Draw a cursor with its hotspot at (x, y).
   * @param {CanvasRenderingContext2D} context
   * @param {number} x Mouse position
   * @param {number} y
   * @param {*} id The cursor to draw; nothing is drawn if it is undefined or unknown
   */
  draw (context, x, y, id) {
    if (this.hidden || x == null || isNaN(x) || isNaN(y)) return
    var c = this.cursors[id]
    if (!c) return
    context.drawImage(c.image, Math.round(x - c.x), Math.round(y - c.y))
  }
}

module.exports = Cursor
