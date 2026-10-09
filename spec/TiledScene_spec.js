const TiledScene = require('../lib/TiledScene')
const Sheet = require('../lib/Sheet')
const Entity = require('../lib/Entity')
const ContextMock2D = require('./mocks/ContextMock2D')

describe('TiledScene', () => {
  it('should allow New', () => {
    var x1 = new TiledScene()
    var x2 = new TiledScene()

    expect(x1).not.toBe(x2)
  })

  it('should have the correct defaults', () => {
    var x1 = new TiledScene()

    expect(x1.tileWidth).toEqual(32)
    expect(x1.tileHeight).toEqual(32)
    expect(x1.perspectiveMode).toEqual(TiledScene.PERSPECTIVE_OVERHEAD)
  })

  describe('draw', () => {
    var x1, context
    beforeEach(() => {
      x1 = new TiledScene({ asset: { element: { width: 'WIDTH', height: 'HEIGHT' } } })
      context = new ContextMock2D()
    })

    it('should return immediately if visible is false', () => {
      x1.visible = false
      x1.draw(context)
      expect(context.save).not.toHaveBeenCalled()
    })

    it('should call context save, tranlate, scale, rotate and _drawLayer with correct values', () => {
      x1.visible = true

      x1.x = 4
      x1.y = 5
      x1.scale = 6
      x1.rotate = 7
      x1.layers = { 1: {} }
      spyOn(x1, '_drawLayer')

      x1.draw(context)

      expect(context.save).toHaveBeenCalledWith()
      expect(context.translate).toHaveBeenCalledWith(4, 5)
      expect(context.scale).toHaveBeenCalledWith(6, 6)
      expect(context.rotate).toHaveBeenCalledWith(7)
      expect(context.restore).toHaveBeenCalledWith()

      expect(x1._drawLayer).toHaveBeenCalledWith(context, 1)
    })

    it('should interleave layers and child scenes by z, including scenes with no layer', () => {
      x1.visible = true
      x1.layers = { 0: [], 2: [] }
      var order = []
      var scene = (z) => ({ z, redraw: () => {}, draw: () => order.push('scene' + z) })
      x1.addScene('a', scene(1))
      x1.addScene('b', scene(2))
      x1.addScene('c', scene(-1))
      spyOn(x1, 'drawScenes').and.callThrough()
      var drawLayer = x1._drawLayer.bind(x1)
      spyOn(x1, '_drawLayer').and.callFake((ctx, z) => { order.push('layer' + z); drawLayer(ctx, z) })

      x1.draw(context)

      expect(order).toEqual(['layer-1', 'scene-1', 'layer0', 'layer1', 'scene1', 'layer2', 'scene2'])
    })
  })

  describe('_drawLayer', () => {
    var x1, context, ele
    beforeEach(() => {
      ele = { width: 'WIDTH', height: 'HEIGHT' }
      x1 = new TiledScene({ asset: { element: ele } })
      context = new ContextMock2D()
    })

    it('should not call drawImage if layer does not exist', () => {
      x1.visible = true

      x1.sheet = new Sheet({ image: x1.sheet.image, tileWidth: 16, tileHeight: 32 })

      x1.x = 4
      x1.y = 5
      x1.scale = 6
      x1.rotate = 7
      x1.layers = { 1: [[[0, 1], [1, 1], [2, 1], null], []] }

      x1._drawLayer(context, 2)

      expect(context.drawImage).not.toHaveBeenCalled()
    })

    it('should call drawImage repeatedly with correct values', () => {
      x1.visible = true

      x1.sheet = new Sheet({ image: x1.sheet.image, tileWidth: 16, tileHeight: 32 })

      x1.x = 4
      x1.y = 5
      x1.scale = 6
      x1.rotate = 7
      x1.layers = { 1: [[[0, 1], [1, 1], [2, 1], null], []] }

      x1._drawLayer(context, 1)

      expect(context.drawImage).toHaveBeenCalledWith(ele, 0, 32, 16, 32, 0, 0, 16, 32)
      expect(context.drawImage).toHaveBeenCalledWith(ele, 16, 32, 16, 32, 16, 0, 16, 32)
      expect(context.drawImage).toHaveBeenCalledWith(ele, 32, 32, 16, 32, 32, 0, 16, 32)
    })

    it('should draw the subscenes for the layer', () => {
      x1.layers = { 1: [] }
      spyOn(x1, 'drawScenes')

      x1._drawLayer(context, 1)

      expect(x1.drawScenes).toHaveBeenCalledWith(context, 1)
    })
  })

  describe('depth', () => {
    // A chair: its back drawn in row 3 but standing in row 4 with its seat; tiles 64 px
    var sheet, room, context, drawn
    beforeEach(() => {
      sheet = new Sheet({
        image: { width: 640, height: 640 },
        tileWidth: 64,
        tileHeight: 64,
        tiles: {
          '0,0': { flat: true },
          '1,0': { flat: true, elevation: 4 },
          '2,0': { elevation: 48, stand: 1 },
          '2,1': { elevation: 24, solid: true }
        }
      })
      room = new TiledScene({
        sheet,
        perspectiveMode: TiledScene.PERSPECTIVE_DEPTH,
        layers: [
          [[[0, 0], [0, 0]], [[0, 0], [0, 0]], [[0, 0], [0, 0]], [[0, 0], [0, 0]], [[0, 0], [0, 0]], [[0, 0], [0, 0]]],
          [[], [], [[1, 0]], [[2, 0]], [[2, 1]]]
        ]
      })
      context = new ContextMock2D()
      drawn = []
      context.drawImage.and.callFake((img, sx, sy, sw, sh, dx, dy) => drawn.push(sx + ',' + sy + '@' + dx + ',' + dy))
    })

    function catAt (y, elevation = 0) {
      var cat = new Entity({ sheet: new Sheet({ image: { width: 64, height: 64 }, anchor: [32, 60] }), x: 32, y, elevation })
      cat.draw = () => drawn.push('cat')
      room.addEntity('cat', cat)
      room.draw(context)
      return drawn.filter((d) => d === 'cat' || d.startsWith('128,0') || d.startsWith('128,64'))
    }

    it('should draw flat tiles first, the floor before a rug', () => {
      room.draw(context)
      var rug = drawn.indexOf('64,0@0,128')
      expect(drawn.slice(0, 12).every((d) => d.startsWith('0,0@'))).toBe(true)
      expect(rug).toEqual(12)
    })

    it('should draw a character behind a chair hidden by it', () => {
      expect(catAt(250)).toEqual(['cat', '128,64@0,256', '128,0@0,192'])
    })

    it('should draw a character on the seat over the seat but under the back', () => {
      expect(catAt(320, 24)).toEqual(['128,64@0,256', 'cat', '128,0@0,192'])
    })

    it('should draw a character in front of the chair over it', () => {
      expect(catAt(380)).toEqual(['128,64@0,256', '128,0@0,192', 'cat'])
    })

    it('should stand a tile with a negative stand on a row above, so a character in its row is in front', () => {
      sheet.tiles['3,0'] = { elevation: 48, stand: -1 }
      room.setTile(1, 1, 4, [3, 0])
      var cat = new Entity({ sheet: new Sheet({ image: { width: 64, height: 64 }, anchor: [32, 64] }), x: 96, y: 320 })
      cat.draw = () => drawn.push('cat')
      room.addEntity('cat', cat)
      room.draw(context)
      expect(drawn.indexOf('192,0@64,256')).toBeLessThan(drawn.indexOf('cat'))
    })

    it('should redraw changes made with setTile', () => {
      room.draw(context)
      room.setTile(1, 1, 3, [2, 0])
      drawn.length = 0
      room.draw(context)
      expect(drawn).toContain('128,0@64,192')
    })
  })

  describe('map', () => {
    var room
    beforeEach(() => {
      var sheet = new Sheet({ image: { width: 128, height: 64 }, tileWidth: 64, tileHeight: 64, tiles: { '1,0': { solid: true } } })
      room = new TiledScene({ sheet, layers: { 0: [[[0, 0], [0, 0]]], 2: [[null, [1, 0, { elevation: 10 }]]] } })
    })

    it('should list the tiles in a cell, lowest layer first', () => {
      expect(room.tilesAt(1, 0)).toEqual([{ layer: 0, tile: [0, 0], overrides: null }, { layer: 2, tile: [1, 0], overrides: { elevation: 10 } }])
    })

    it('should be solid where a tile is solid, or where there are no tiles', () => {
      expect(room.isSolid(0, 0)).toBe(false)
      expect(room.isSolid(1, 0)).toBe(true)
      expect(room.isSolid(5, 5)).toBe(true)
    })

    it('should let a cell override its solidity', () => {
      room.setSolid(1, 0, false)
      expect(room.isSolid(1, 0)).toBe(false)
      room.setSolid(1, 0, null)
      expect(room.isSolid(1, 0)).toBe(true)
    })

    it('should clear all solidity overrides', () => {
    room.setSolid(1, 0, false)
    room.clearSolid()
    expect(room.isSolid(1, 0)).toBe(true)
  })

  it('should find the cell at a point', () => {
      expect(room.cellAt(70, 10)).toEqual([1, 0])
    })
  })
})
