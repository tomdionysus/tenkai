import Autotile from '../lib/Autotile.js'

describe('Autotile', () => {
  // A 3 x 3 map: rock (1) in a column down the middle, sand (0) either side
  var kinds = [0, 1, 0, 0, 1, 0, 0, 1, 0]
  var at = (x, y) => (x < 0 || y < 0 || x > 2 || y > 2) ? undefined : kinds[y * 3 + x]

  it('should set a bit for each of the four neighbours that is the same kind, north, east, south, west', () => {
    var tiles = new Autotile()
    expect(tiles.piece(1, 1, at)).toEqual(1 | 4)
    expect(tiles.piece(1, 0, at)).toEqual(4)
    expect(tiles.piece(1, 2, at)).toEqual(1)
    // Sand at the edge: its sand neighbours join, the cells off the map do not
    expect(tiles.piece(0, 1, at)).toEqual(1 | 4)
    expect(tiles.pieceOf(1, [1, 1, 1, 1])).toEqual(15)
  })

  it('should take what joins, a table and a base, the base by the centre', () => {
    var table = Array.from({ length: 16 }, (v, i) => 100 - i)
    var tiles = new Autotile({ joins: (c, n) => n === c || n === c + 1, table, base: (c) => c * 1000 })
    // 1 joins 1 and 2: the centre of a map of 1 under a 2
    expect(tiles.pieceOf(1, [2, 0, 1, 0])).toEqual(1000 + 100 - 5)
    expect(new Autotile({ table, base: 7 }).pieceOf(1, [1, 1, 0, 0])).toEqual(7 + 100 - 3)
  })

  it('should give a further set of bits for each way a neighbour joins', () => {
    // 1 is a wall, 2 its rubble: rubble joins both as a wall and as rubble
    var walls = new Autotile({ joins: (c, n) => n === 2 ? 3 : n === 1 ? 1 : 0 })
    expect(walls.pieceOf(1, [1, 2, 0, 0])).toEqual(1 | 2 | (2 << 4))
    expect(walls.pieceOf(1, [0, 0, 0, 2])).toEqual(8 | (8 << 4))
  })

  it('should take other neighbourhoods', () => {
    var eight = new Autotile({ around: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] })
    expect(eight.piece(1, 1, at)).toEqual(2 | 64)
    // The corner: only the sand below it joins (east is rock, the rest off the map)
    expect(eight.piece(0, 0, at)).toEqual(64)
  })
})
