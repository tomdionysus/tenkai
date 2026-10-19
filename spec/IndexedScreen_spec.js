import IndexedScreen from '../lib/IndexedScreen.js'
import Palette from '../lib/Palette.js'
import HeadlessCanvas from '../lib/HeadlessCanvas.js'

describe('IndexedScreen', () => {
  const palette = new Palette({ size: 4 })

  it('should own a surface of its size shown through its palette, painted afresh before each drawing', () => {
    let painted = 0
    class Window extends IndexedScreen {
      paint (surface) {
        painted++
        surface.set(1, 1, 3)
      }
    }
    const w = new Window({ width: 8, height: 4, palette, transparent: true, modal: true, createCanvas: (width, height) => new HeadlessCanvas(width, height) })
    expect([w.surface.width, w.surface.height, w.surface.transparent]).toEqual([8, 4, true])
    expect(w.palette).toBe(palette)
    expect(w.modal).toBe(true)
    w.draw(new HeadlessCanvas(8, 4).getContext('2d'))
    w.draw(new HeadlessCanvas(8, 4).getContext('2d'))
    expect(painted).toEqual(2)
    expect(w.surface.get(1, 1)).toEqual(3)
    const other = new Palette({ size: 4 })
    w.palette = other
    expect(w.picture.palette).toBe(other)
  })
})
