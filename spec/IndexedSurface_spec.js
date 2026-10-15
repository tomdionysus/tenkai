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

  it('should fill a rectangle with a source rectangle repeated, from a phase, and make colour tables', () => {
    var s = new IndexedSurface({ width: 7, height: 3 })
    // Source columns 2-3 of row 0 (values 2, 3) over x 1-5, starting at its second column; then rows by phase
    s.repeat(numbered(4, 2), { sx: 1, sy: 0, w: 2, h: 1, dx: 1, dy: 0, width: 5, height: 1, phaseX: 1 })
    expect(Array.from(s.pixels.slice(0, 7))).toEqual([0, 3, 2, 3, 2, 3, 0])
    s.repeat(numbered(1, 3), { sx: 0, sy: 0, w: 1, h: 3, dx: 0, dy: 1, width: 1, height: 2, phaseY: 2 })
    expect([s.get(0, 1), s.get(0, 2)]).toEqual([3, 1])
    s.repeat(numbered(1, 1), { sx: 0, sy: 0, w: 1, h: 1, dx: 0, dy: 0, width: 0, height: 1 })
    expect(IndexedSurface.table([1, 2], [5, 6], 4)).toEqual([0, 5, 6, 3])
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

  it('should outline a rectangle, its far edges in a second colour, clipped', () => {
    var s = new IndexedSurface({ width: 4, height: 3 })
    s.outline(0, 0, 4, 3, 1, 2)
    expect(Array.from(s.pixels)).toEqual([1, 1, 1, 2, 1, 0, 0, 2, 2, 2, 2, 2])
    s.clear()
    s.outline(2, 1, 5, 5, 3)
    expect(Array.from(s.pixels)).toEqual([0, 0, 0, 0, 0, 0, 3, 3, 0, 0, 3, 0])
    s.outline(0, 0, 0, 3, 9)
    expect(s.get(0, 0)).toEqual(0)
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

  it('should blit mirrored, clipped to the destination', () => {
    var src = numbered(3, 1)
    var dst = new IndexedSurface({ width: 3, height: 1 })
    dst.blit(src, { flip: true })
    expect(Array.from(dst.pixels)).toEqual([3, 2, 1])
    dst.clear()
    dst.blit(src, { flip: true, dx: -1, map: [0, 5, 6, 7] })
    expect(Array.from(dst.pixels)).toEqual([6, 5, 0])
  })

  it('should read palette numbers written as grey, clear where alpha is low', () => {
    var data = Uint8ClampedArray.of(16, 16, 16, 255, 248, 248, 248, 255, 0, 0, 0, 0)
    var canvas = { width: 0, height: 0, getContext: () => ({ drawImage: () => {}, getImageData: () => ({ data }) }) }
    var s = IndexedSurface.fromNumbers({ width: 3, height: 1 }, { createCanvas: () => canvas })
    expect(Array.from(s.pixels)).toEqual([2, 31, -1])
  })

  it('should blit only inside a clip rectangle, mirrored or not', () => {
    var src = numbered(3, 2)
    var dst = new IndexedSurface({ width: 4, height: 2 })
    dst.blit(src, { dx: 0, clip: { x: 1, y: 1, width: 2, height: 5 } })
    expect(Array.from(dst.pixels)).toEqual([0, 0, 0, 0, 0, 5, 6, 0])
    dst.clear()
    dst.blit(src, { dx: 0, flip: true, clip: { x: 1, y: 0, width: 1, height: 1 } })
    expect(Array.from(dst.pixels)).toEqual([0, 2, 0, 0, 0, 0, 0, 0])
  })

  it('should clear the colour reaching a rectangle\'s edge, keeping what it encloses', () => {
    // A ring of 1s on 0s, with a 0 inside it; the 0 outside the rectangle stays
    var s = new IndexedSurface({ width: 6, height: 5, transparent: true })
    s.pixels.set([
      0, 0, 0, 0, 0, 0,
      0, 0, 1, 1, 0, 0,
      0, 1, 0, 0, 1, 0,
      0, 0, 1, 1, 0, 0,
      0, 0, 0, 0, 0, 0
    ])
    s.clearEdges({ x: 0, y: 0, width: 5, height: 5 }, 0)
    expect(Array.from(s.pixels)).toEqual([
      -1, -1, -1, -1, -1, 0,
      -1, -1, 1, 1, -1, 0,
      -1, 1, 0, 0, 1, 0,
      -1, -1, 1, 1, -1, 0,
      -1, -1, -1, -1, -1, 0
    ])
  })

  it('should leave an opaque surface as it is when clearing edges', () => {
    var s = new IndexedSurface({ width: 2, height: 1 })
    s.clearEdges({ x: 0, y: 0, width: 2, height: 1 }, 0)
    expect(Array.from(s.pixels)).toEqual([0, 0])
  })

  it('should shade what is under a shape through a table, within a clip', () => {
    var shape = new IndexedSurface({ width: 2, height: 2, transparent: true, pixels: Int16Array.from([5, -1, 5, 5]) })
    var s = numbered(4, 3)
    expect(s.shade(shape, { dx: 1, dy: 1, table: (c) => c & ~1 })).toBe(s)
    expect(Array.from(s.pixels)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 12])
    s = numbered(4, 3)
    s.shade(shape, { dx: 1, dy: 1, table: [0, 0, 0, 0, 0, 0, 99], clip: { x: 0, y: 0, width: 4, height: 2 } })
    expect(Array.from(s.pixels)).toEqual([1, 2, 3, 4, 5, 99, 7, 8, 9, 10, 11, 12])
  })

  it('should not shade where the shape has its key colour', () => {
    var shape = new IndexedSurface({ width: 2, height: 1, pixels: Uint8Array.from([0, 3]) })
    var s = numbered(2, 1)
    s.shade(shape, { table: (c) => c + 10, key: 0 })
    expect(Array.from(s.pixels)).toEqual([1, 12])
  })

  it('should turn upside down in place', () => {
    var s = numbered(2, 3)
    expect(s.flipVertical()).toBe(s)
    expect(Array.from(s.pixels)).toEqual([5, 6, 3, 4, 1, 2])
  })
})
