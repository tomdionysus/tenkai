/**
 * An IndexedSurface is a picture made of palette indices rather than colours: a width, a height and one
 * number per pixel, shown through a {@link Palette}. Palette games draw everything this way, so that colour
 * cycling, fades and shadow tables work on whatever is on screen.
 *
 * A surface is either opaque, with pixels 0 to 255 in a Uint8Array, or `transparent`, with pixels in an
 * Int16Array where -1 means "nothing here". Transparent surfaces make overlays: drawn over another surface,
 * only their set pixels show.
 *
 * @example
const frame = new IndexedSurface({ width: 320, height: 200 })
const room = new IndexedSurface({ width: 640, height: 144, pixels: roomPixels })
const text = new IndexedSurface({ width: 320, height: 200, transparent: true })
// Show the room scrolled 100 pixels right, under the status line, with the text over it
frame.blit(room, { sx: 100, w: 320, dy: 16 })
frame.blit(text)
 */
class IndexedSurface {
  /**
   * @param {object} options
   * @param {integer} options.width
   * @param {integer} options.height
   * @param {boolean} options.transparent Pixels may be -1, meaning transparent (optional, default false)
   * @param {Uint8Array|Int16Array} options.pixels Pixels to use, row by row, not copied (optional, default
   * all 0, or all -1 when transparent)
   */
  constructor (options = {}) {
    this.width = options.width
    this.height = options.height
    this.transparent = !!options.transparent
    var Type = this.transparent ? Int16Array : Uint8Array
    this.pixels = options.pixels || new Type(this.width * this.height)
    if (!options.pixels && this.transparent) this.pixels.fill(-1)
  }

  /**
   * Set every pixel to a colour.
   * @param {integer} color (optional, default -1 for transparent surfaces, otherwise 0)
   */
  clear (color = this.transparent ? -1 : 0) {
    this.pixels.fill(color)
  }

  /**
   * Fill a rectangle, clipped to the surface.
   * @param {integer} x
   * @param {integer} y
   * @param {integer} w
   * @param {integer} h
   * @param {integer} color
   */
  fill (x, y, w, h, color) {
    var x0 = Math.max(0, x)
    var x1 = Math.min(this.width, x + w)
    var y1 = Math.min(this.height, y + h)
    if (x0 >= x1) return
    for (var yy = Math.max(0, y); yy < y1; yy++) this.pixels.fill(color, yy * this.width + x0, yy * this.width + x1)
  }

  /**
   * One pixel; outside the surface, -1 for transparent surfaces and 0 otherwise.
   * @param {integer} x
   * @param {integer} y
   * @returns {integer}
   */
  get (x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return this.transparent ? -1 : 0
    return this.pixels[y * this.width + x]
  }

  /**
   * Set one pixel, if it is on the surface.
   * @param {integer} x
   * @param {integer} y
   * @param {integer} color
   */
  set (x, y, color) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return
    this.pixels[y * this.width + x] = color
  }

  /**
   * The pixels of a band of whole rows, as a view sharing this surface's memory, for drawing code that
   * works on a plain array.
   * @param {integer} y First row
   * @param {integer} height Number of rows
   * @returns {Uint8Array|Int16Array}
   */
  rows (y, height) {
    return this.pixels.subarray(y * this.width, (y + height) * this.width)
  }

  /**
   * Copy a rectangle of another surface onto this one, clipped to both. Pixels of a transparent source that
   * are -1 are skipped, as are pixels equal to `key` when one is given, and pixels whose `mask` value is 0.
   * @param {IndexedSurface} src
   * @param {object} options
   * @param {integer} options.sx Left of the source rectangle (optional, default 0)
   * @param {integer} options.sy Top of the source rectangle (optional, default 0)
   * @param {integer} options.w Width (optional, default the rest of the source)
   * @param {integer} options.h Height (optional, default the rest of the source)
   * @param {integer} options.dx Where the rectangle goes on this surface (optional, default 0)
   * @param {integer} options.dy (optional, default 0)
   * @param {integer} options.key A colour of the source to treat as transparent (optional)
   * @param {Uint8Array} options.mask One value per source pixel, laid out like it; 0 means do not draw, as
   * for an image with one-bit alpha (optional)
   */
  blit (src, options = {}) {
    var sx = options.sx || 0
    var sy = options.sy || 0
    var dx = options.dx || 0
    var dy = options.dy || 0
    var w = options.w === undefined ? src.width - sx : options.w
    var h = options.h === undefined ? src.height - sy : options.h
    // Clip against the source, then the destination
    if (sx < 0) { w += sx; dx -= sx; sx = 0 }
    if (sy < 0) { h += sy; dy -= sy; sy = 0 }
    if (dx < 0) { w += dx; sx -= dx; dx = 0 }
    if (dy < 0) { h += dy; sy -= dy; dy = 0 }
    w = Math.min(w, src.width - sx, this.width - dx)
    h = Math.min(h, src.height - sy, this.height - dy)
    if (w <= 0 || h <= 0) return
    var sp = src.pixels
    var dp = this.pixels
    var mask = options.mask
    var keyed = options.key !== undefined || src.transparent
    var key = options.key === undefined ? -1 : options.key
    for (var y = 0; y < h; y++) {
      var s = (sy + y) * src.width + sx
      var d = (dy + y) * this.width + dx
      if (!keyed && !mask) {
        dp.set(sp.subarray(s, s + w), d)
        continue
      }
      for (var x = 0; x < w; x++) {
        var c = sp[s + x]
        if (c >= 0 && c !== key && (!mask || mask[s + x])) dp[d + x] = c
      }
    }
  }

  /**
   * Write this surface's colours into RGBA pixels, such as an ImageData's `data`. Transparent pixels are
   * left as they were, so several surfaces can be written in turn.
   * @param {Palette} palette
   * @param {Uint8ClampedArray|Uint8Array} rgba Four values per pixel, the same size as this surface
   */
  toRGBA (palette, rgba) {
    var p = this.pixels
    var colors = palette.colors
    for (var i = 0, o = 0; i < p.length; i++, o += 4) {
      var c = p[i]
      if (c < 0) continue
      c *= 3
      rgba[o] = colors[c]
      rgba[o + 1] = colors[c + 1]
      rgba[o + 2] = colors[c + 2]
      rgba[o + 3] = 255
    }
  }

  /**
   * Write this surface's colours into part of a larger RGBA image, clipped to it, skipping transparent
   * pixels. Used to lay a small surface, such as a cursor, over a frame being shown.
   * @param {Palette} palette
   * @param {Uint8ClampedArray|Uint8Array} rgba Four values per pixel
   * @param {integer} width Width of the RGBA image
   * @param {integer} height Height of the RGBA image
   * @param {integer} x Where this surface's top left goes
   * @param {integer} y
   */
  toRGBAAt (palette, rgba, width, height, x, y) {
    var colors = palette.colors
    for (var row = 0; row < this.height; row++) {
      var ty = y + row
      if (ty < 0 || ty >= height) continue
      for (var col = 0; col < this.width; col++) {
        var tx = x + col
        if (tx < 0 || tx >= width) continue
        var c = this.pixels[row * this.width + col]
        if (c < 0) continue
        var o = (ty * width + tx) * 4
        c *= 3
        rgba[o] = colors[c]
        rgba[o + 1] = colors[c + 1]
        rgba[o + 2] = colors[c + 2]
        rgba[o + 3] = 255
      }
    }
  }
}

export default IndexedSurface
