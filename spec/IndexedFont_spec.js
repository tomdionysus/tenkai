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

  it('should space letters wider by a spacing, measuring with it', () => {
    expect(font.measure('AA', 1)).toEqual(6)
    var s = new IndexedSurface({ width: 6, height: 1 })
    expect(font.draw(s, 'AA', 0, 0, { colours: { ink: 1 }, spacing: 1 })).toEqual(6)
    expect(Array.from(s.pixels)).toEqual([1, 0, 0, 1, 0, 0])
  })
})
