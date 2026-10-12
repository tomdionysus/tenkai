/**
 * Cleans up an old game's font whose glyphs are drawn as segments with one-pixel gaps through their strokes (they
 * read as clipped text when scaled up). A gap is filled where a vertical stroke runs through it: ink above and
 * below, and the stroke at least two deep on one side, so a diagonal (a zero's slash) is left alone. Fonts come
 * as rows of bits or as a picture of cells; both are cleaned the same way.
 *
 * @example
const glyphs = FontCleaner.glyphs(data.font.glyphs)
const sheet = FontCleaner.image(game.getAsset('font').element, 8)
 */
class FontCleaner {
  /**
   * A glyph's rows of bits (the high bit leftmost), cleaned: a new array.
   * @param {number[]} rows
   * @param {integer} width Bits a row (optional, default 8)
   */
  static rows (rows, width = 8) {
    const top = 1 << (width - 1)
    const ink = (x, y) => y >= 0 && y < rows.length && x >= 0 && x < width && ((rows[y] || 0) & (top >>> x)) !== 0
    const out = rows.slice()
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < width; x++) if (FontCleaner.gap(ink, x, y)) out[y] |= top >>> x
    }
    return out
  }

  /**
   * Every glyph of a font's list cleaned: a new list (a missing glyph stays missing).
   * @param {number[][]} list
   * @param {integer} width Bits a row (optional, default 8)
   */
  static glyphs (list, width = 8) {
    return list.map((rows) => rows && FontCleaner.rows(rows, width))
  }

  /**
   * A font picture of square cells, cleaned: a new canvas, each filled pixel the colour of the one above it.
   * @param {HTMLImageElement|HTMLCanvasElement} image
   * @param {integer} cell The cells' size (optional, default 8)
   * @param {function} createCanvas `createCanvas(width, height)` (optional, default a DOM canvas)
   */
  static image (image, cell = 8, createCanvas = null) {
    const canvas = createCanvas ? createCanvas(image.width, image.height) : document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const c = canvas.getContext('2d')
    c.drawImage(image, 0, 0)
    const data = c.getImageData(0, 0, canvas.width, canvas.height)
    const d = data.data
    const before = d.slice()
    const w = canvas.width
    for (let cy = 0; cy + cell <= canvas.height; cy += cell) {
      for (let cx = 0; cx + cell <= w; cx += cell) {
        const ink = (x, y) => y >= 0 && y < cell && x >= 0 && x < cell && before[((cy + y) * w + cx + x) * 4 + 3] > 0
        for (let y = 0; y < cell; y++) {
          for (let x = 0; x < cell; x++) {
            if (!FontCleaner.gap(ink, x, y)) continue
            const i = ((cy + y) * w + cx + x) * 4
            d.set(before.subarray(i - w * 4, i - w * 4 + 4), i)
          }
        }
      }
    }
    c.putImageData(data, 0, 0)
    return canvas
  }

  /**
   * Whether (x, y) is a gap in a vertical stroke, by `ink(x, y)`.
   * @returns {boolean}
   */
  static gap (ink, x, y) {
    return !ink(x, y) && ink(x, y - 1) && ink(x, y + 1) && (ink(x, y - 2) || ink(x, y + 2))
  }
}

export default FontCleaner
