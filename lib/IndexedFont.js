/**
 * Text drawn into an {@link IndexedSurface} in palette colours, from glyphs kept as rows of bits, the way old
 * palette games keep their fonts: each glyph may have several layers of bits, one per colour of the original
 * (the letter, its shadow, an outline), drawn in turn in the colours the text asks for. Proportional: each glyph
 * has its own advance, and may sit lower than the line's top.
 *
 * @example
const font = new IndexedFont({ characters, widths, tops, cellWidth: 16, layers: { 1: letterBits, 31: shadowBits } })
font.draw(frame, 'Credits', 260, 4, { colours: { 1: 15, 31: 0 } })
 */
class IndexedFont {
  /**
   * @param {object} options
   * @param {object} options.characters Each character's glyph number ({ 'A': 64, ... })
   * @param {integer[]} options.widths Each glyph's advance in pixels
   * @param {integer[]} options.tops Each glyph's rows down from the line's top (default 0)
   * @param {integer} options.cellWidth Bits a row (the widest glyph, a multiple of 8)
   * @param {object} options.layers By layer name (often the original colour): each glyph's rows of bits, highest
   * bit leftmost
   * @param {integer} options.height The line's height (default the tallest glyph)
   */
  constructor ({ characters, widths, tops = [], cellWidth = 8, layers, height }) {
    this.characters = characters
    this.widths = widths
    this.tops = tops
    this.cellWidth = cellWidth
    this.layers = layers
    this.layerNames = Object.keys(layers)
    this.height = height || 8
  }

  /** The width of a text in pixels, with `spacing` more after each letter (default 0). */
  measure (text, spacing = 0) {
    var w = 0
    for (var ch of String(text)) {
      var g = this.characters[ch]
      if (g !== undefined) w += (this.widths[g] || 0) + spacing
    }
    return w
  }

  /**
   * Draws a text with its top left at x, y (or its centre or right, by `align`). `colours` gives each layer's
   * palette colour; a layer not given is not drawn. Returns the width drawn.
   * @param {IndexedSurface} surface
   * @param {string} text
   * @param {integer} x
   * @param {integer} y
   * @param {object} options
   * @param {object} options.colours By layer name: the palette colour to draw it in
   * @param {string} options.align 'left' (default), 'center' or 'right'
   * @param {integer} options.spacing Pixels more after each letter, as some games set their buttons' text wider
   * than their labels' (default 0)
   */
  draw (surface, text, x, y, options = {}) {
    text = String(text)
    var colours = options.colours || {}
    var spacing = options.spacing || 0
    var width = this.measure(text, spacing)
    if (options.align === 'center') x -= Math.floor(width / 2)
    else if (options.align === 'right') x -= width
    for (var ch of text) {
      var g = this.characters[ch]
      if (g === undefined) continue
      for (var name of this.layerNames) {
        if (colours[name] === undefined) continue
        var rows = this.layers[name][g]
        if (rows && rows.length) surface.bits(rows, x, y + (this.tops[g] || 0), colours[name], this.cellWidth)
      }
      x += (this.widths[g] || 0) + spacing
    }
    return width
  }

  /**
   * A font read from a sheet of glyphs drawn in palette numbers (the way fonts are exported as pictures): each
   * glyph a rectangle of the sheet, its ink the pixels `inked` says (default any above 0), one layer.
   * @param {IndexedSurface} sheet
   * @param {object} glyphs By character: `{ x, y, width }` its rectangle's top left and its advance (its `top`,
   *   rows down from the line, optional)
   * @param {object} options
   * @param {integer} options.height Each glyph's rows
   * @param {integer} options.cellWidth Bits a row (default 8; a multiple of 8)
   * @param {string} options.layer The one layer's name (default 'ink')
   * @param {function} options.inked `(value) => boolean`: whether a pixel of the sheet is ink
   * @returns {IndexedFont}
   */
  static fromSheet (sheet, glyphs, { height, cellWidth = 8, layer = 'ink', inked = (v) => v > 0 } = {}) {
    var characters = {}
    var widths = []
    var tops = []
    var rows = []
    var n = 0
    for (var ch of Object.keys(glyphs)) {
      var g = glyphs[ch]
      var bits = []
      for (var y = 0; y < height; y++) {
        var row = 0
        for (var x = 0; x < cellWidth; x++) if (inked(sheet.get(g.x + x, g.y + y))) row |= 1 << (cellWidth - 1 - x)
        bits.push(row >>> 0)
      }
      characters[ch] = n
      widths[n] = g.width
      tops[n] = g.top || 0
      rows[n] = bits
      n++
    }
    var layers = {}
    layers[layer] = rows
    return new IndexedFont({ characters, widths, tops, cellWidth, layers, height })
  }
}

export default IndexedFont
