import IndexedSurface from '../lib/IndexedSurface.js'
import Palette from '../lib/Palette.js'

describe('IndexedSurface', () => {
  var numbered = (w, h) => new IndexedSurface({ width: w, height: h, pixels: Uint8Array.from({ length: w * h }, (v, i) => i + 1) })

  it('should start opaque at 0, or transparent at -1', () => {
    expect(Array.from(new IndexedSurface({ width: 2, height: 1 }).pixels)).toEqual([0, 0])
    var t = new IndexedSurface({ width: 2, height: 1, transparent: true })
    expect(t.pixels instanceof Int16Array).toBe(true)
    expect(Array.from(t.pixels)).toEqual([-1, -1])
    expect(t.get(5, 5)).toEqual(-1)
  })

  it('should fill clipped rectangles and set pixels', () => {
    var s = new IndexedSurface({ width: 3, height: 2 })
    s.fill(-1, 1, 3, 5, 7)
    s.set(0, 0, 9)
    s.set(9, 9, 9)
    expect(Array.from(s.pixels)).toEqual([9, 0, 0, 7, 7, 0])
    s.clear(2)
    expect(Array.from(s.pixels)).toEqual([2, 2, 2, 2, 2, 2])
  })

  it('should share rows as a view', () => {
    var s = numbered(2, 3)
    var band = s.rows(1, 2)
    band[0] = 99
    expect(s.get(0, 1)).toEqual(99)
    expect(band.length).toEqual(4)
  })

  it('should blit a clipped rectangle', () => {
    var src = numbered(4, 2)
    var dst = new IndexedSurface({ width: 3, height: 3 })
    dst.blit(src, { sx: 1, w: 3, dx: 1, dy: 2 })
    expect(Array.from(dst.pixels)).toEqual([0, 0, 0, 0, 0, 0, 0, 2, 3])
    dst.clear()
    dst.blit(src, { dx: -2, dy: -1 })
    expect(Array.from(dst.pixels)).toEqual([7, 8, 0, 0, 0, 0, 0, 0, 0])
  })

  it('should skip transparent and keyed pixels', () => {
    var over = new IndexedSurface({ width: 2, height: 1, transparent: true })
    over.set(1, 0, 5)
    var dst = new IndexedSurface({ width: 2, height: 1, pixels: Uint8Array.from([1, 1]) })
    dst.blit(over)
    expect(Array.from(dst.pixels)).toEqual([1, 5])
    dst.blit(numbered(2, 1), { key: 2 })
    expect(Array.from(dst.pixels)).toEqual([1, 5])
    dst.blit(numbered(2, 1), { mask: Uint8Array.from([0, 1]) })
    expect(Array.from(dst.pixels)).toEqual([1, 2])
  })

  it('should write colours through a palette, leaving transparent pixels', () => {
    var palette = new Palette({ size: 3, colors: [0, 0, 0, 10, 20, 30, 40, 50, 60] })
    var s = new IndexedSurface({ width: 2, height: 1, transparent: true })
    s.set(0, 0, 2)
    var rgba = new Uint8Array(8).fill(7)
    s.toRGBA(palette, rgba)
    expect(Array.from(rgba)).toEqual([40, 50, 60, 255, 7, 7, 7, 7])
    var small = new IndexedSurface({ width: 1, height: 1, pixels: Uint8Array.from([1]) })
    small.toRGBAAt(palette, rgba, 2, 1, 1, 0)
    small.toRGBAAt(palette, rgba, 2, 1, 5, 0)
    expect(Array.from(rgba)).toEqual([40, 50, 60, 255, 10, 20, 30, 255])
  })
})
