/**
 * Text laid out with an {@link IndexedFont}, as old palette games write into their windows: lines broken at `\n` a
 * fixed height apart, each line centred within a width or the text wrapped at spaces to fit one, and numbers
 * right-aligned in so many places (the empty places blank, each as wide as a `0`). Centring halves the width and the
 * line's width separately, each rounded down, as such games do (an odd width lands a pixel left of the exact
 * centre).
 *
 * @example
const text = new IndexedText({ font, lineHeight: 10 })
text.draw(frame, 'COMPLETE FACILITIES FOR THE COMFORT OF 50 EMPLOYEES.', 16, 120, { colours: { 1: 28 }, wrap: 280 })
text.draw(frame, 'ENGINEERING SECTION', 96, 6, { colours: { 1: 27 }, centre: 160 })
text.number(frame, 1000, 128, 82, 6, { colours: { 1: 28 } })   // '  1000'
 */
class IndexedText {
  /**
   * @param {object} options
   * @param {IndexedFont} options.font
   * @param {integer} options.lineHeight Pixels from one line's top to the next's (default the font's height)
   */
  constructor ({ font, lineHeight }) {
    this.font = font
    this.lineHeight = lineHeight || font.height
  }

  /**
   * Draws a text from (x, y), a line at a time.
   * @param {IndexedSurface} surface
   * @param {string} text `\n` starts a line `lineHeight` lower at x
   * @param {integer} x
   * @param {integer} y
   * @param {object} options
   * @param {object} options.colours By the font's layer: the palette colour, as {@link IndexedFont#draw}'s
   * @param {integer} options.centre A width from x to centre each line in (default none)
   * @param {integer} options.wrap A width to break the lines at spaces within (default none)
   * @returns {integer} The y below the last line
   */
  draw (surface, text, x, y, options = {}) {
    var drawOptions = { colours: options.colours || {} }
    for (var line of this.lines(text, options.wrap || 0)) {
      var lx = options.centre ? x + (options.centre >> 1) - (this.font.measure(line) >> 1) : x
      this.font.draw(surface, line, lx, y, drawOptions)
      y += this.lineHeight
    }
    return y
  }

  /**
   * The lines a text is drawn as: broken at `\n`, and with `width` at the spaces too, so no line is wider (a single
   * word wider than the width keeps a line to itself).
   * @param {string} text
   * @param {integer} width 0 for no wrapping
   * @returns {string[]}
   */
  lines (text, width = 0) {
    var lines = String(text).split('\n')
    if (!width) return lines
    var out = []
    for (var line of lines) {
      var current = ''
      for (var word of line.split(' ')) {
        var next = current ? current + ' ' + word : word
        if (current && this.font.measure(next) > width) {
          out.push(current)
          current = word
        } else current = next
      }
      out.push(current)
    }
    return out
  }

  /**
   * A whole number right-aligned in `places` places from x, the empty places blank (each a `0`'s width). A number
   * longer than its places starts that many places further left.
   * @returns {integer} The y below it
   */
  number (surface, n, x, y, places, options = {}) {
    var s = String(Math.trunc(n))
    var cell = this.font.measure('0')
    return this.draw(surface, s, x + (places - s.length) * cell, y, options)
  }
}

export default IndexedText
