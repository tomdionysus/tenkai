import Shroud from '../lib/Shroud.js'
import TiledScene from '../lib/TiledScene.js'

describe('Shroud', () => {
  // A 3x3 map; edge tiles are [mask, 1], the unseen tile [0, 2]
  var make = (edge) => {
    var scene = new TiledScene({ tileWidth: 1, tileHeight: 1, layers: { 0: [] } })
    return new Shroud({ scene, layer: 1, columns: 3, rows: 3, unseen: [0, 2], edges: (m) => [m, 1], edge })
  }
  var only = (cells) => (x, y) => cells.includes(x + ',' + y)

  it('should cover the whole map until something is seen', () => {
    var shroud = make()
    expect(shroud.scene.layers[1].length).toBe(3)
    expect(shroud.scene.tilesAt(1, 1)).toEqual([{ layer: 1, tile: [0, 2], overrides: null }])
  })

  it('should edge seen cells by their seen neighbours, and clear those seen all round', () => {
    var shroud = make()
    shroud.update(only(['1,1', '1,0', '2,1']))
    var g = shroud.grid
    expect(g[1][1]).toEqual([1 | 2, 1])
    expect(g[0][0]).toEqual([0, 2])
    // The top edge's cell: off the map counts as seen
    expect(g[0][1]).toEqual([1 | 4, 1])
    shroud.update(() => true)
    expect(g[1][1]).toBe(null)
  })

  it('should count off the map as unseen if asked', () => {
    var shroud = make('unseen')
    shroud.update(() => true)
    expect(shroud.grid[0][0]).toEqual([2 | 4, 1])
    expect(shroud.grid[1][1]).toBe(null)
  })

  it('should update only the area given', () => {
    var shroud = make()
    shroud.update(() => true, { x: 2, y: 0, width: 5, height: 1 })
    expect(shroud.grid[0][2]).toBe(null)
    expect(shroud.grid[0][1]).toEqual([0, 2])
  })
})
