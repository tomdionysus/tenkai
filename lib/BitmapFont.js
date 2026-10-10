/**
 * A BitmapFont draws text from a sheet of glyphs: an image divided into equal cells, as old games stored their
 * fonts. It maps characters to cells, can recolour the glyphs (once per colour, cached), breaks lines at a
 * line-break character or by width, measures text, and can draw into a clipped window, as a status line or a
 * ticker does.
 *
 * Glyphs are fixed-width by default; give `widths` for a proportional font. Characters without a glyph take
 * an empty cell's width (space usually has no glyph).
 *
 * @example
const font = new BitmapFont({
  image: game.getAsset('font'),
  cellWidth: 8,
  cellHeight: 8,
  characters: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ .',
  upperCase: true,
  lineBreak: '#'
})
font.draw(context, 'WARNING#PLASMODIAN WAVE', 40, 32, { colour: '#cc0000' })
 */
class BitmapFont {
  /**
   * @param {object} options
   * @param {Asset|HTMLImageElement|HTMLCanvasElement} options.image The glyph sheet, or an Asset holding it
   * @param {integer} options.cellWidth Width of a glyph cell
   * @param {integer} options.cellHeight Height of a glyph cell
   * @param {integer} options.columns Cells to a row of the sheet (optional, default the image's width / cellWidth)
   * @param {string|object} options.characters The character of each cell in order, as a string, or an object
   *   mapping characters to cell numbers
   * @param {number[]|object} options.widths Advance of each cell (array) or character (object), for proportional
   *   fonts (optional, default cellWidth for all)
   * @param {integer} options.spacing Extra pixels between characters (optional, default 0)
   * @param {integer} options.lineHeight Pixels from one line to the next (optional, default cellHeight + 2)
   * @param {string} options.lineBreak A character that also breaks lines, besides '\n' (optional)
   * @param {boolean} options.upperCase Draw lower case as upper case (optional, default false)
   * @param {string} options.ink The colour of the glyphs' pixels that `colour` replaces (optional, default
   *   '#ffffff'); other pixels, such as a black outline, keep theirs
   */
  constructor (options = {}) {
    this.image = options.image
    this.cellWidth = options.cellWidth
    this.cellHeight = options.cellHeight
    this._columns = options.columns
    this.spacing = options.spacing || 0
    this.lineHeight = options.lineHeight || this.cellHeight + 2
    this.lineBreak = options.lineBreak || null
    this.upperCase = !!options.upperCase
    this.ink = options.ink || '#ffffff'
    this.glyphs = {}
    if (typeof options.characters === 'string') {
      Array.from(options.characters).forEach((c, i) => { if (!(c in this.glyphs)) this.glyphs[c] = i })
    } else Object.assign(this.glyphs, options.characters || {})
    this.widths = options.widths || null
    this._tinted = {}
  }

  /** The image element (resolving an Asset). */
  get element () {
    return this.image && this.image.element ? this.image.element : this.image
  }

  get columns () {
    return this._columns || Math.max(1, Math.floor((this.element ? this.element.width : this.cellWidth) / this.cellWidth))
  }

  /** The cell of a character, or undefined if the font has none. */
  glyph (c) {
    if (this.upperCase) c = c.toUpperCase()
    return this.glyphs[c]
  }

  /** How far a character moves the pen. */
  advance (c) {
    var w = this.cellWidth
    if (this.widths) {
      var g = this.glyph(c)
      if (Array.isArray(this.widths)) w = g !== undefined && this.widths[g] !== undefined ? this.widths[g] : w
      else if (this.widths[c] !== undefined) w = this.widths[c]
    }
    return w + this.spacing
  }

  /** The text split at line breaks. */
  lines (text) {
    var s = String(text)
    if (this.lineBreak) s = s.split(this.lineBreak).join('\n')
    return s.split('\n')
  }

  /**
   * The text's size in pixels.
   * @param {string} text
   * @returns {object} `{ width, height, lines }`
   */
  measure (text) {
    var lines = this.lines(text)
    var width = 0
    for (var line of lines) width = Math.max(width, this.lineWidth(line))
    return { width, height: (lines.length - 1) * this.lineHeight + this.cellHeight, lines: lines.length }
  }

  lineWidth (line) {
    var w = 0
    for (var c of Array.from(line)) w += this.advance(c)
    return w ? w - this.spacing : 0
  }

  /**
   * Break text into lines no wider than `width` pixels, at spaces where it can (a word too long for a line is
   * broken anywhere). Existing line breaks are kept.
   * @returns {string[]}
   */
  wrap (text, width) {
    var out = []
    for (var para of this.lines(text)) {
      var line = ''
      for (var word of para.split(' ')) {
        var next = line ? line + ' ' + word : word
        if (!line || this.lineWidth(next) <= width) {
          line = next
          continue
        }
        out.push(line)
        line = word
      }
      while (this.lineWidth(line) > width && line.length > 1) {
        var n = line.length
        while (n > 1 && this.lineWidth(line.slice(0, n)) > width) n--
        out.push(line.slice(0, n))
        line = line.slice(n)
      }
      out.push(line)
    }
    return out
  }

  /**
   * Draw text with its top left at (x, y).
   * @param {CanvasRenderingContext2D} context
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {object} options
   * @param {string} options.colour Recolour the glyphs' ink (optional)
   * @param {number} options.maxWidth Wrap to this width (optional)
   * @param {string} options.align 'left', 'center' or 'right' of x (optional, default 'left')
   * @param {object} options.clip `{ x, y, width, height }`: draw only inside this window (optional)
   * @returns {object} The size drawn, as from {@link BitmapFont#measure}
   */
  draw (context, text, x, y, options = {}) {
    var lines = options.maxWidth ? this.wrap(text, options.maxWidth) : this.lines(text)
    var image = options.colour ? this.tinted(options.colour) : this.element
    if (options.clip) {
      context.save()
      context.beginPath()
      context.rect(options.clip.x, options.clip.y, options.clip.width, options.clip.height)
      context.clip()
    }
    var columns = this.columns
    var width = 0
    lines.forEach((line, i) => {
      var lw = this.lineWidth(line)
      width = Math.max(width, lw)
      var cx = options.align === 'center' ? x - Math.floor(lw / 2) : options.align === 'right' ? x - lw : x
      var cy = y + i * this.lineHeight
      for (var c of Array.from(line)) {
        var g = this.glyph(c)
        if (g !== undefined && image) {
          context.drawImage(image, (g % columns) * this.cellWidth, Math.floor(g / columns) * this.cellHeight,
            this.cellWidth, this.cellHeight, cx, cy, this.cellWidth, this.cellHeight)
        }
        cx += this.advance(c)
      }
    })
    if (options.clip) context.restore()
    return { width, height: (lines.length - 1) * this.lineHeight + this.cellHeight, lines: lines.length }
  }

  /**
   * The sheet with its ink pixels recoloured, made once per colour. Where no canvas is available the sheet is
   * used as it is.
   */
  tinted (colour) {
    if (this._tinted[colour]) return this._tinted[colour]
    var image = this.element
    var canvas = typeof document !== 'undefined' && document.createElement ? document.createElement('canvas') : null
    var context = canvas && canvas.getContext ? canvas.getContext('2d') : null
    if (!image || !context) return image
    canvas.width = image.width
    canvas.height = image.height
    context.drawImage(image, 0, 0)
    var data = context.getImageData(0, 0, canvas.width, canvas.height)
    var from = BitmapFont.rgb(this.ink)
    var to = BitmapFont.rgb(colour)
    var d = data.data
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] && d[i] === from[0] && d[i + 1] === from[1] && d[i + 2] === from[2]) {
        d[i] = to[0]
        d[i + 1] = to[1]
        d[i + 2] = to[2]
      }
    }
    context.putImageData(data, 0, 0)
    this._tinted[colour] = canvas
    return canvas
  }

  /** '#rgb' or '#rrggbb' as [r, g, b]. */
  static rgb (colour) {
    var h = colour.replace('#', '')
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  }
}

export default BitmapFont
