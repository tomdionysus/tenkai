import IndexedSprites from '../lib/IndexedSprites.js'
import IndexedSheet from '../lib/IndexedSheet.js'
import IndexedSurface from '../lib/IndexedSurface.js'
import Palette from '../lib/Palette.js'

describe('IndexedSprites', () => {
  // A canvas that keeps the pixels put into it
  var createCanvas = () => {
    var canvas = {
      getContext: () => ({
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: (image) => { canvas.data = image.data }
      })
    }
    return canvas
  }
  var palette = Palette.fromCSS(['#000000', '#100000', '#200000', '#300000'])
  var sheet = new IndexedSheet([new IndexedSurface({ width: 3, height: 1, transparent: true, pixels: Int16Array.of(1, 2, -1) })])
  var reds = (s) => Array.from({ length: 3 }, (v, i) => s.image.data[i * 4])

  it('should make each picture in a colouring once, mirrored or not, anchored as asked', () => {
    var sprites = new IndexedSprites({ sheet, palette, anchor: 'centre', createCanvas })
    var table = IndexedSurface.table([1], [3], 4)
    var a = sprites.get(0, { map: table })
    expect(reds(a)).toEqual([0x30, 0x20, 0])
    expect(a.anchor).toEqual([1, 0])
    expect(sprites.get(0, { map: table })).toBe(a)
    expect(reds(sprites.get(0, { flip: true }))).toEqual([0, 0x20, 0x10])
    expect(sprites.size).toBe(2)
    // A picture one row high is the same upside down, but kept as a picture of its own
    expect(reds(sprites.get(0, { upsideDown: true }))).toEqual([0x10, 0x20, 0])
    expect(sprites.get(0, { upsideDown: true })).not.toBe(sprites.get(0))
    expect(sprites.size).toBe(4)
    expect(sprites.get(5)).toBe(null)
  })

  it('should keep pictures made some other way', () => {
    var sprites = new IndexedSprites({ sheet, palette, createCanvas })
    var paints = 0
    var make = () => sprites.make('two', 6, 1, (s, pictures) => { paints++; pictures.draw(s, 0, 3, 0) })
    expect(make()).toBe(make())
    expect(paints).toBe(1)
    expect(make().anchor).toEqual([0, 0])
  })
})
