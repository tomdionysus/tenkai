import IndexedSheet from '../lib/IndexedSheet.js'
import IndexedSurface from '../lib/IndexedSurface.js'

describe('IndexedSheet', () => {
  var numbered = (w, h) => new IndexedSurface({ width: w, height: h, pixels: Uint8Array.from({ length: w * h }, (v, i) => i + 1) })

  it('should cut a grid into cells, left to right and down', () => {
    var sheet = IndexedSheet.grid(numbered(4, 2), 2, 1)
    expect(sheet.length).toEqual(4)
    expect(Array.from(sheet.get(1).pixels)).toEqual([3, 4])
    expect(Array.from(sheet.get(2).pixels)).toEqual([5, 6])
    expect(IndexedSheet.grid(numbered(4, 2), 2, 1, 3).length).toEqual(3)
  })

  it('should cut an atlas into frames of their own sizes, and join sheets into one numbering', () => {
    var a = IndexedSheet.atlas(numbered(4, 2), [{ x: 0, y: 0, w: 1, h: 2 }, { x: 1, y: 0, w: 3, h: 1 }])
    expect(Array.from(a.get(0).pixels)).toEqual([1, 5])
    expect(Array.from(a.get(1).pixels)).toEqual([2, 3, 4])
    var joined = IndexedSheet.join([a, IndexedSheet.grid(numbered(2, 1), 1, 1)])
    expect(joined.length).toEqual(4)
    expect(Array.from(joined.get(3).pixels)).toEqual([2])
  })

  it('should draw a picture through a colour table and mirrored, and nothing for a missing one', () => {
    var sheet = IndexedSheet.grid(numbered(3, 1), 3, 1)
    var dst = new IndexedSurface({ width: 4, height: 1 })
    sheet.draw(dst, 0, 1, 0, { map: [0, 9, 8, 7], flip: true })
    expect(Array.from(dst.pixels)).toEqual([0, 7, 8, 9])
    sheet.draw(dst, 5, 0, 0)
    expect(Array.from(dst.pixels)).toEqual([0, 7, 8, 9])
  })
})
