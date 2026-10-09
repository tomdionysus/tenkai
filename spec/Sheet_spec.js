const Sheet = require('../lib/Sheet')
const ContextMock2D = require('./mocks/ContextMock2D')

describe('Sheet', () => {
  var image = { width: 200, height: 100 }

  it('should default to the whole image as one tile', () => {
    var sheet = new Sheet({ image: { element: image } })
    expect(sheet.element).toBe(image)
    expect([sheet.tileWidth, sheet.tileHeight]).toEqual([200, 100])
    expect(sheet.anchor).toEqual([0, 0])
  })

  it('should find tiles in a grid with an offset and spacing', () => {
    var sheet = new Sheet({ image, tileWidth: 30, tileHeight: 20, offsetX: 2, offsetY: 4, spacing: 1 })
    expect(sheet.source([2, 3])).toEqual([64, 67, 30, 20])
    expect([sheet.columns, sheet.rows]).toEqual([6, 4])
  })

  it('should draw a tile', () => {
    var sheet = new Sheet({ image, tileWidth: 20, tileHeight: 20 })
    var context = new ContextMock2D()
    sheet.draw(context, [1, 2], 5, 6)
    expect(context.drawImage).toHaveBeenCalledWith(image, 20, 40, 20, 20, 5, 6, 20, 20)
  })

  it('should define clips from frames, from columns of a row, or from a count', () => {
    var sheet = new Sheet({
      image,
      clips: {
        a: { frames: [[0, 1], [1, 1, 30]], delay: 50, loop: true },
        b: { row: 2, columns: [0, 1, 0] },
        c: { row: 3, count: 2 }
      }
    })
    expect(sheet.clips.a).toEqual({ name: 'a', frames: [[0, 1], [1, 1, 30]], delay: 50, loop: true })
    expect(sheet.clips.b.frames).toEqual([[0, 2], [1, 2], [0, 2]])
    expect(sheet.clips.c.frames).toEqual([[0, 3], [1, 3]])
    expect(sheet.clips.c.delay).toEqual(100)
    expect(sheet.clip('c')).toBe(sheet.clips.c)
    expect(sheet.clip(sheet.clips.a)).toBe(sheet.clips.a)
  })

  it('should describe tiles, flat by default', () => {
    var sheet = new Sheet({
      image,
      tiles: {
        '1,0': { elevation: 24, solid: true },
        '2,0': { stand: 1 },
        '3,0': { flat: false },
        '4,0': { flat: true, elevation: 2 }
      }
    })
    expect(sheet.info([0, 0])).toEqual({ flat: true, elevation: 0, stand: 0, solid: false })
    expect(sheet.info([1, 0])).toEqual({ flat: false, elevation: 24, stand: 0, solid: true })
    expect(sheet.info([2, 0]).flat).toBe(false)
    expect(sheet.info([3, 0]).flat).toBe(false)
    expect(sheet.info([4, 0])).toEqual({ flat: true, elevation: 2, stand: 0, solid: false })
  })

  it('should pass through other properties of a description', () => {
    var sheet = new Sheet({ image, tiles: { '1,0': { elevation: 24, seat: true } } })
    expect(sheet.info([1, 0]).seat).toBe(true)
  })

  it('should let a placement override a tile description', () => {
    var sheet = new Sheet({ image, tiles: { '1,0': { elevation: 24, solid: true } } })
    expect(sheet.info([1, 0], { solid: false })).toEqual({ flat: false, elevation: 24, stand: 0, solid: false })
  })
})
