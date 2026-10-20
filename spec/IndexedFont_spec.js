import IndexedFont from '../lib/IndexedFont.js'
import IndexedSurface from '../lib/IndexedSurface.js'

describe('IndexedFont', () => {
  // Two glyphs: 'A' (2 wide: a column of ink and a shadow beside it) and 'b' (1 wide, one row lower)
  var font = new IndexedFont({
    characters: { A: 0, b: 1 },
    widths: [2, 1],
    tops: [0, 1],
    cellWidth: 8,
    layers: { ink: [[0x80, 0x80], [0x80]], shadow: [[0x40, 0x40], []] }
  })

  it('should measure by the glyphs\' advances, skipping characters it lacks', () => {
    expect(font.measure('AbA')).toEqual(5)
    expect(font.measure('A?b')).toEqual(3)
  })

  it('should draw each layer in its colour, a layer without a colour not at all', () => {
    var s = new IndexedSurface({ width: 3, height: 2 })
    font.draw(s, 'Ab', 0, 0, { colours: { ink: 5, shadow: 6 } })
    expect(Array.from(s.pixels)).toEqual([5, 6, 0, 5, 6, 5])
    s.clear()
    font.draw(s, 'A', 0, 0, { colours: { ink: 5 } })
    expect(Array.from(s.pixels)).toEqual([5, 0, 0, 5, 0, 0])
  })

  it('should align to the right or the centre of x', () => {
    var s = new IndexedSurface({ width: 4, height: 2 })
    font.draw(s, 'A', 4, 0, { colours: { ink: 1 }, align: 'right' })
    expect(s.get(2, 0)).toEqual(1)
    s.clear()
    font.draw(s, 'A', 2, 0, { colours: { ink: 1 }, align: 'center' })
    expect(s.get(1, 0)).toEqual(1)
  })

  it('should read a font from a sheet of glyphs, a rectangle each, its ink the pixels above 0', () => {
    // 'I' a column of 2 at (0, 0), 'L' two pixels wide at (8, 0), on a sheet of 8-wide cells; the clear pixels -1
    var sheet = new IndexedSurface({ width: 16, height: 2, transparent: true })
    sheet.set(0, 0, 3)
    sheet.set(0, 1, 3)
    sheet.set(8, 1, 1)
    sheet.set(9, 1, 1)
    var font = IndexedFont.fromSheet(sheet, { I: { x: 0, y: 0, width: 2 }, L: { x: 8, y: 0, width: 3, top: 1 } }, { height: 2 })
    expect(font.layers.ink).toEqual([[0x80, 0x80], [0, 0xC0]])
    expect(font.measure('IL')).toEqual(5)
    var s = new IndexedSurface({ width: 5, height: 3 })
    font.draw(s, 'IL', 0, 0, { colours: { ink: 7 } })
    expect(Array.from(s.pixels)).toEqual([7, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 7, 7, 0])
  })

  it('should space letters wider by a spacing, measuring with it', () => {
    expect(font.measure('AA', 1)).toEqual(6)
    var s = new IndexedSurface({ width: 6, height: 1 })
    expect(font.draw(s, 'AA', 0, 0, { colours: { ink: 1 }, spacing: 1 })).toEqual(6)
    expect(Array.from(s.pixels)).toEqual([1, 0, 0, 1, 0, 0])
  })
})
