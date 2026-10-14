import BackgroundScene from '../lib/BackgroundScene.js'
import ContextMock2D from './mocks/ContextMock2D.js'

describe('BackgroundScene', () => {
  it('should allow New', () => {
    var x1 = new BackgroundScene()
    var x2 = new BackgroundScene()

    expect(x1).not.toBe(x2)
  })

  it('should take defaults from the asset', () => {
    var x1 = new BackgroundScene({ asset: { element: { width: 'WIDTH', height: 'HEIGHT' } } })

    expect(x1.width).toEqual('WIDTH')
    expect(x1.height).toEqual('HEIGHT')
  })

  it('should repeat a strip across its span, scrolled by its offset, over a fill', () => {
    var element = { width: 1000, height: 400 }
    var strip = new BackgroundScene({ asset: { element }, repeatX: true, sourceX: 0, sourceY: 224, width: 800, height: 104, span: 320, fill: '#5a6ea8' })
    strip.offsetX = 1650
    var context = jasmine.createSpyObj('context', ['drawImage', 'fillRect', 'save', 'restore', 'translate', 'scale', 'rotate'])
    strip.drawContent(context)
    expect(context.fillStyle).toEqual('#5a6ea8')
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 320, 104)
    // 1650 mod 800 is 50: the strip starts 50 to the left, and one copy covers the 320
    expect(context.drawImage.calls.allArgs()).toEqual([[element, 0, 224, 800, 104, -50, 0, 800, 104]])
    strip.offsetX = -10
    strip.width = 100
    context.drawImage.calls.reset()
    strip.drawContent(context)
    expect(context.drawImage.calls.allArgs().map((a) => a[5])).toEqual([-90, 10, 110, 210, 310])
    expect(new BackgroundScene({ asset: { element }, repeatX: true, width: 50, height: 10 }).spanWidth).toEqual(50)
  })

  describe('draw', () => {
    var x1, context
    beforeEach(() => {
      x1 = new BackgroundScene({ asset: { element: { width: 'WIDTH', height: 'HEIGHT' } } })
      context = new ContextMock2D()
    })

    it('should return immediately if visible is false', () => {
      x1.visible = false
      x1._doredraw = true
      x1.draw(context)
      expect(context.save).not.toHaveBeenCalled()
    })

    it('should call context save, tranlate, scale, rotate with correct values', () => {
      x1.visible = true
      x1._doredraw = true

      x1.x = 4
      x1.y = 5
      x1.scale = 6
      x1.rotate = 7

      x1.draw(context)

      expect(context.save).toHaveBeenCalledWith()
      expect(context.translate).toHaveBeenCalledWith(4, 5)
      expect(context.scale).toHaveBeenCalledWith(6, 6)
      expect(context.rotate).toHaveBeenCalledWith(7)
      expect(context.drawImage).toHaveBeenCalledWith(x1.asset.element, 0, 0, 'WIDTH', 'HEIGHT', 0, 0, 'WIDTH', 'HEIGHT')
      expect(context.restore).toHaveBeenCalledWith()
    })

    it('should draw the image, then child scenes, then entities', () => {
      x1.visible = true
      x1._doredraw = true
      var order = []
      context.drawImage.and.callFake(() => order.push('image'))
      spyOn(x1, 'drawScenes').and.callFake(() => order.push('scenes'))
      spyOn(x1, 'drawEntities').and.callFake(() => order.push('entities'))

      x1.draw(context)

      expect(order).toEqual(['image', 'scenes', 'entities'])
    })
  })
})
