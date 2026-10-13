import Minimap from '../lib/Minimap.js'
import IndexedSurface from '../lib/IndexedSurface.js'

describe('Minimap', () => {
  var rows = (s) => Array.from({ length: s.height }, (v, y) => Array.from(s.pixels.slice(y * s.width, (y + 1) * s.width)).join(''))

  it('should scale an area of the map to fill its rectangle, with dots and the view outlined', () => {
    var s = new IndexedSurface({ width: 5, height: 5 })
    var m = new Minimap({ rect: { x: 1, y: 1, width: 4, height: 4 }, background: 0, outline: 9 })
    var area = { x: 10, y: 10, width: 2, height: 2 }
    expect(m.scale(area)).toBe(2)
    m.draw(s, { area, colour: (x, y) => (x === 10 ? 1 : null), dots: [{ x: 11, y: 11, colour: 3 }, { x: 0, y: 0, colour: 4 }] })
    expect(rows(s)).toEqual(['00000', '01100', '01100', '01133', '01133'])
    m.draw(s, { area, view: { x: 11, y: 10, width: 1, height: 1 } })
    expect(rows(s)).toEqual(['00000', '00099', '00099', '00000', '00000'])
  })

  it('should find the cell under a point', () => {
    var m = new Minimap({ rect: { x: 1, y: 1, width: 4, height: 4 } })
    var area = { x: 10, y: 10, width: 2, height: 2 }
    expect(m.cellAt(3, 2, area)).toEqual({ x: 11, y: 10 })
    expect(m.cellAt(0, 0, area)).toBe(null)
  })
})
