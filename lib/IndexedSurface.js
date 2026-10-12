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
   * A line one pixel wide, clipped to the surface: `length` pixels from (x, y), to the right or, when `vertical`,
   * down.
   * @param {integer} x
   * @param {integer} y
   * @param {integer} length
   * @param {integer} color
   * @param {boolean} vertical (optional, default false)
   */
  line (x, y, length, color, vertical = false) {
    for (var i = 0; i < length; i++) {
      if (vertical) this.set(x, y + i, color)
      else this.set(x + i, y, color)
    }
  }

  /**
   * A one-bit picture, such as a font's glyph: each row is a number whose set bits, highest first, are drawn in
   * `color`; the other pixels are left as they are (ink only), or drawn in `paper` when it is given (a solid cell).
   * Clipped to the surface.
   * @param {integer[]} rows One number per row
   * @param {integer} x Left
   * @param {integer} y Top
   * @param {integer} color
   * @param {integer} width Bits a row (optional, default 8)
   * @param {integer} paper The colour of the clear bits (optional: left as they are)
   */
  bits (rows, x, y, color, width = 8, paper) {
    var top = 1 << (width - 1)
    var solid = paper !== undefined && paper !== null
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r] || 0
      if (!row && !solid) continue
      for (var b = 0; b < width; b++) {
        if (row & (top >>> b)) this.set(x + b, y + r, color)
        else if (solid) this.set(x + b, y + r, paper)
      }
    }
  }

  /**
   * Every pixel's number mapped through a table (an array, or a function of the number): palette tricks such as
   * darkening a picture by clearing a bit of its numbers, or swapping two colours. Transparent pixels stay so.
   * @param {integer[]|function} table
   * @returns {IndexedSurface} this surface
   */
  remap (table) {
    var map = typeof table === 'function' ? table : function (c) { return table[c] === undefined ? c : table[c] }
    var p = this.pixels
    for (var i = 0; i < p.length; i++) if (p[i] >= 0) p[i] = map(p[i])
    return this
  }

  /**
   * The surface as a canvas through a palette: a picture to draw again and again (a sprite sheet in one
   * character's colours, a gauge's graphic). Ranges of rows can take other palettes (`regions`, as
   * {@link IndexedScene}'s); transparent pixels are transparent.
   * @param {Palette} palette
   * @param {object} options
   * @param {object[]} options.regions Other palettes from a row down, each `{ from, palette }`, in order (optional)
   * @param {function} options.createCanvas `createCanvas(width, height)` (default a DOM canvas)
   * @returns {HTMLCanvasElement}
   */
  toCanvas (palette, options = {}) {
    var canvas = options.createCanvas ? options.createCanvas(this.width, this.height) : document.createElement('canvas')
    canvas.width = this.width
    canvas.height = this.height
    var context = canvas.getContext('2d')
    var image = context.createImageData(this.width, this.height)
    var regions = options.regions || []
    this.toRGBA(palette, image.data, 0, regions.length ? regions[0].from : this.height)
    for (var i = 0; i < regions.length; i++) {
      this.toRGBA(regions[i].palette, image.data, regions[i].from, i + 1 < regions.length ? regions[i + 1].from : this.height)
    }
    context.putImageData(image, 0, 0)
    return canvas
  }

  /**
   * A picture (an image or canvas in a palette's colours) as palette numbers: each pixel the first entry of exactly
   * its colour, `missing` (0) for a colour not in the palette, and transparent (-1) where the picture is (alpha
   * under 128). Takes part of the picture when given a rectangle.
   * @param {HTMLImageElement|HTMLCanvasElement} image
   * @param {Palette} palette
   * @param {object} options
   * @param {integer} options.x, options.y, options.width, options.height The part taken (default all)
   * @param {integer} options.missing The number for a colour not in the palette (default 0)
   * @param {function} options.createCanvas `createCanvas(width, height)` (default a DOM canvas)
   * @returns {IndexedSurface} A transparent surface
   */
  static fromImage (image, palette, options = {}) {
    var x = options.x || 0
    var y = options.y || 0
    var width = options.width === undefined ? image.width : options.width
    var height = options.height === undefined ? image.height : options.height
    var canvas = options.createCanvas ? options.createCanvas(width, height) : document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    var context = canvas.getContext('2d')
    context.drawImage(image, -x, -y)
    var d = context.getImageData(0, 0, width, height).data
    var lookup = new Map()
    for (var i = palette.size - 1; i >= 0; i--) {
      var c = palette.get(i)
      lookup.set((c[0] << 16) | (c[1] << 8) | c[2], i)
    }
    var missing = options.missing || 0
    var surface = new IndexedSurface({ width, height, transparent: true })
    var p = surface.pixels
    for (var j = 0; j < p.length; j++) {
      var o = j * 4
      if (d[o + 3] < 128) continue
      var key = (d[o] << 16) | (d[o + 1] << 8) | d[o + 2]
      p[j] = lookup.has(key) ? lookup.get(key) : missing
    }
    return surface
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
   * @param {integer[]} options.map A colour table: each pixel drawn as `map[colour]` (a glyph's colours in the
   * text's, a sprite in a shadow's) (optional)
   * @param {boolean} options.flip Mirror the rectangle left to right (a sprite facing the other way) (optional)
   */
  blit (src, options = {}) {
    if (options.flip) return this.blitFlipped(src, options)
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
    var map = options.map
    var keyed = options.key !== undefined || src.transparent
    var key = options.key === undefined ? -1 : options.key
    for (var y = 0; y < h; y++) {
      var s = (sy + y) * src.width + sx
      var d = (dy + y) * this.width + dx
      if (!keyed && !mask && !map) {
        dp.set(sp.subarray(s, s + w), d)
        continue
      }
      for (var x = 0; x < w; x++) {
        var c = sp[s + x]
        if (c >= 0 && c !== key && (!mask || mask[s + x])) dp[d + x] = map ? map[c] : c
      }
    }
  }

  // blit with options.flip: the rectangle mirrored, its rightmost column drawn at dx
  blitFlipped (src, options) {
    var sx = options.sx || 0
    var sy = options.sy || 0
    var dx = options.dx || 0
    var dy = options.dy || 0
    var w = options.w === undefined ? src.width - sx : options.w
    var h = options.h === undefined ? src.height - sy : options.h
    var map = options.map
    var mask = options.mask
    var key = options.key === undefined ? -1 : options.key
    var sp = src.pixels
    var dp = this.pixels
    for (var y = 0; y < h; y++) {
      var ty = dy + y
      var fy = sy + y
      if (ty < 0 || ty >= this.height || fy < 0 || fy >= src.height) continue
      for (var x = 0; x < w; x++) {
        var tx = dx + x
        var fx = sx + w - 1 - x
        if (tx < 0 || tx >= this.width || fx < 0 || fx >= src.width) continue
        var i = fy * src.width + fx
        var c = sp[i]
        if (c >= 0 && c !== key && (!mask || mask[i])) dp[ty * this.width + tx] = map ? map[c] : c
      }
    }
  }

  /**
   * A picture whose pixels are palette numbers written as grey levels (as a game's tools export pictures for an
   * indexed renderer: grey = number * `scale`), and transparent where its alpha is under 128. Unlike `fromImage`
   * it needs no palette, and two entries of the same colour stay apart.
   * @param {HTMLImageElement|HTMLCanvasElement} image
   * @param {object} options
   * @param {integer} options.scale Grey levels a number (default 8: 32 numbers in 0-248)
   * @param {function} options.createCanvas `createCanvas(width, height)` (default a DOM canvas)
   * @returns {IndexedSurface} A transparent surface
   */
  static fromNumbers (image, options = {}) {
    var scale = options.scale || 8
    var width = image.width
    var height = image.height
    var canvas = options.createCanvas ? options.createCanvas(width, height) : document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    var context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    var d = context.getImageData(0, 0, width, height).data
    var surface = new IndexedSurface({ width, height, transparent: true })
    var p = surface.pixels
    for (var j = 0; j < p.length; j++) {
      if (d[j * 4 + 3] >= 128) p[j] = Math.round(d[j * 4] / scale)
    }
    return surface
  }

  /**
   * Write this surface's colours into RGBA pixels, such as an ImageData's `data`. Transparent pixels are
   * left as they were, so several surfaces can be written in turn.
   * @param {Palette} palette
   * @param {Uint8ClampedArray|Uint8Array} rgba Four values per pixel, the same size as this surface
   * @param {integer} from First row (optional, default 0)
   * @param {integer} to The row after the last (optional, default the height): rows outside are left as they were,
   * so ranges of rows can be shown through different palettes
   */
  toRGBA (palette, rgba, from = 0, to = this.height) {
    var p = this.pixels
    var colors = palette.colors
    var end = Math.min(to, this.height) * this.width
    for (var i = Math.max(0, from) * this.width, o = i * 4; i < end; i++, o += 4) {
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
