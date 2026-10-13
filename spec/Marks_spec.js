import Marks from '../lib/Marks.js'
import Palette from '../lib/Palette.js'

describe('Marks', () => {
  // A context that records the pixels filled
  var context = () => {
    var c = { pixels: new Set(), fillStyle: null }
    c.fillRect = (x, y, w, h) => { for (var i = 0; i < w; i++) for (var j = 0; j < h; j++) c.pixels.add((x + i) + ',' + (y + j)) }
    return c
  }
  var marks = new Marks({ palette: Palette.fromCSS(['#000000', '#ff0000']) })

  it('should outline a rectangle in a palette colour', () => {
    var c = context()
    marks.outline(c, 0, 0, 3, 3, 1)
    expect(c.fillStyle).toBe('rgb(255,0,0)')
    expect(c.pixels.size).toBe(8)
    expect(c.pixels.has('1,1')).toBe(false)
  })

  it('should mark the corners, and cross a rectangle', () => {
    var c = context()
    marks.corners(c, 0, 0, 8, 8, 2, 1)
    expect(['0,0', '1,0', '0,1', '7,0', '6,0', '7,1', '0,7', '7,7', '7,6'].every((p) => c.pixels.has(p))).toBe(true)
    expect(c.pixels.size).toBe(12)
    var x = context()
    marks.crossed(x, 0, 0, 5, 5, 1)
    expect(['2,2', '1,1', '3,1', '1,3'].every((p) => x.pixels.has(p))).toBe(true)
  })
})
