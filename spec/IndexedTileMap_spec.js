import IndexedTileMap from '../lib/IndexedTileMap.js'
import IndexedSheet from '../lib/IndexedSheet.js'
import IndexedSurface from '../lib/IndexedSurface.js'

describe('IndexedTileMap', () => {
  // Four 1x1 tiles numbered 1 to 4; a 4x4 map whose cells are tiles 0-3 in turn
  var sheet = new IndexedSheet([1, 2, 3, 4].map((c) => new IndexedSurface({ width: 1, height: 1, pixels: Uint8Array.of(c) })))
  var cells = Array.from({ length: 16 }, (v, i) => i % 4)
  var make = () => new IndexedTileMap({ sheet, columns: 4, rows: 4, tileWidth: 1, tileHeight: 1, window: { x: 1, y: 0, width: 2, height: 2 } })

  it('should draw the tiles under the view into its window', () => {
    var map = make()
    var s = new IndexedSurface({ width: 3, height: 2 })
    map.scrollTo(1, 1)
    map.draw(s, cells)
    expect(Array.from(s.pixels)).toEqual([0, 2, 3, 0, 2, 3])
  })

  it('should draw hidden cells in the hidden colour, and tiles through a colour table', () => {
    var map = make()
    var s = new IndexedSurface({ width: 3, height: 2 })
    map.draw(s, cells, { visible: (x, y) => x === 0, hidden: 9, map: () => [0, 7, 7, 7, 7] })
    expect(Array.from(s.pixels)).toEqual([0, 7, 9, 0, 7, 9])
  })

  it('should keep the view inside the map or its limits', () => {
    var map = make()
    map.scrollTo(10, -3)
    expect([map.x, map.y]).toEqual([2, 0])
    map.limit({ x: 1, y: 1, width: 2, height: 2 })
    expect([map.x, map.y]).toEqual([1, 1])
    expect(map.scrollBy(1, 0)).toBe(false)
    map.centreOn(0, 0)
    expect([map.x, map.y]).toEqual([1, 1])
  })

  it('should find the cell under a point, and a cell\'s point', () => {
    var map = make()
    map.scrollTo(2, 1)
    expect(map.cellAt(2, 1)).toEqual({ x: 3, y: 2 })
    expect(map.cellAt(0, 0)).toBe(null)
    expect(map.pointOf(3, 2)).toEqual({ x: 2, y: 1 })
  })
})
