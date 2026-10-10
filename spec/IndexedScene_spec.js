import IndexedScene from '../lib/IndexedScene.js'
import IndexedSurface from '../lib/IndexedSurface.js'
import Palette from '../lib/Palette.js'
import ContextMock2D from './mocks/ContextMock2D.js'

describe('IndexedScene', () => {
  function fakeCanvas (w, h) {
    var context = {
      createImageData: (iw, ih) => ({ width: iw, height: ih, data: new Uint8ClampedArray(iw * ih * 4) }),
      putImageData: jasmine.createSpy('putImageData')
    }
    return { width: w, height: h, getContext: () => context }
  }

  it('should show the surface through the palette, with layers over it', () => {
    var surface = new IndexedSurface({ width: 2, height: 1, pixels: Uint8Array.from([1, 1]) })
    var palette = new Palette({ size: 3, colors: [0, 0, 0, 1, 2, 3, 4, 5, 6] })
    var cursor = new IndexedSurface({ width: 1, height: 1, pixels: Uint8Array.from([2]) })
    var layer = { surface: cursor, x: 1, y: 0 }
    var scene = new IndexedScene({ surface, palette, layers: [layer], createCanvas: fakeCanvas })
    expect(Array.from(scene.render().data)).toEqual([1, 2, 3, 255, 4, 5, 6, 255])
    layer.visible = false
    expect(Array.from(scene.render().data)).toEqual([1, 2, 3, 255, 1, 2, 3, 255])
    // The surface itself is untouched by layers
    expect(Array.from(surface.pixels)).toEqual([1, 1])
  })

  it('should draw its picture as its background', () => {
    var surface = new IndexedSurface({ width: 2, height: 2 })
    var scene = new IndexedScene({ surface, palette: new Palette(), createCanvas: fakeCanvas })
    var context = new ContextMock2D()
    scene.draw(context)
    expect(scene._context.putImageData).toHaveBeenCalled()
    expect(context.drawImage).toHaveBeenCalledWith(scene._canvas, 0, 0)
  })
})
