import Palette from './Palette.js'

/**
 * A ShadeTable is how 256-colour games darkened their world: a table of rows, one a level of light, each a map
 * from a palette number to the palette number nearest its colour at that light (Build's palookups, Doom's
 * COLORMAP). A pixel is drawn through the table at its light, then through the palette. Several tables stacked
 * (a game's pals: the cultists' robes, the spiders' colours) are rows on after each other.
 *
 * `colors` turns the table into colours through a palette: one RGBA entry a cell, rows as the table's, so a
 * shader can look a pixel's colour up in one fetch (`texelFetch(colors, ivec2(index, row * shades + light))`),
 * and so the whole thing changes palette (under water) by being made again.
 *
 * @example
const table = ShadeTable.fromImage(game.getAsset('shades').element)   // the rows as a grey PNG, a row a level
const palettes = ShadeTable.palettesFromImage(game.getAsset('palettes').element)   // a palette a row
const rgba = table.colors(palettes[0])                                  // width 256, height table.rows
 */
class ShadeTable {
  /**
   * @param {object} options
   * @param {Uint8Array} options.table The rows one after another, `entries` numbers each
   * @param {integer} options.rows How many rows
   * @param {integer} options.entries Numbers a row (default 256)
   */
  constructor (options = {}) {
    this.entries = options.entries || 256
    this.rows = options.rows || Math.floor((options.table ? options.table.length : 0) / this.entries)
    this.table = options.table || new Uint8Array(this.rows * this.entries)
  }

  /**
   * A table from an image whose pixels are the numbers (a grey PNG, the red channel read), a row of the image a
   * row of the table.
   * @param {HTMLImageElement|HTMLCanvasElement} image
   * @returns {ShadeTable}
   */
  static fromImage (image) {
    var p = ShadeTable.pixels(image)
    var table = new Uint8Array(p.width * p.height)
    for (var i = 0; i < table.length; i++) table[i] = p.data[i * 4]
    return new ShadeTable({ table, rows: p.height, entries: p.width })
  }

  /**
   * Palettes from an image with one a row: each pixel's colour an entry.
   * @param {HTMLImageElement|HTMLCanvasElement} image
   * @returns {Palette[]}
   */
  static palettesFromImage (image) {
    var p = ShadeTable.pixels(image)
    var out = []
    for (var row = 0; row < p.height; row++) {
      var colors = new Uint8Array(p.width * 3)
      for (var i = 0; i < p.width; i++) {
        var o = (row * p.width + i) * 4
        colors[i * 3] = p.data[o]
        colors[i * 3 + 1] = p.data[o + 1]
        colors[i * 3 + 2] = p.data[o + 2]
      }
      out.push(new Palette({ size: p.width, colors }))
    }
    return out
  }

  /**
   * An image's pixels, RGBA, through a canvas.
   * @param {HTMLImageElement|HTMLCanvasElement} image
   * @param {function} createCanvas Makes a canvas (default `document.createElement('canvas')`)
   * @returns {object} `{ width, height, data }`
   */
  static pixels (image, createCanvas) {
    var width = image.naturalWidth || image.width
    var height = image.naturalHeight || image.height
    var canvas = createCanvas ? createCanvas() : document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    var c = canvas.getContext('2d')
    c.drawImage(image, 0, 0)
    return { width, height, data: c.getImageData(0, 0, width, height).data }
  }

  /**
   * The table's cells as colours through a palette: RGBA, `entries` wide, `rows` high, every colour opaque.
   * @param {Palette|Uint8Array} palette A Palette, or red, green and blue for each entry in turn
   * @returns {Uint8Array}
   */
  colors (palette) {
    var rgb = palette.colors || palette
    var out = new Uint8Array(this.table.length * 4)
    for (var i = 0, o = 0; i < this.table.length; i++, o += 4) {
      var c = this.table[i] * 3
      out[o] = rgb[c]
      out[o + 1] = rgb[c + 1]
      out[o + 2] = rgb[c + 2]
      out[o + 3] = 255
    }
    return out
  }
}

export default ShadeTable
