import IsometricScene from '../lib/IsometricScene.js'
import IsometricProjection from '../lib/IsometricProjection.js'
import Scene from '../lib/Scene.js'

describe('IsometricScene', () => {
  var projection = new IsometricProjection({ xAxis: [-2, -1], yAxis: [2, -1], origin: [2048, 3072] })
  var fakeEntity = (log, name) => ({ draw: () => log.push(name) })

  it('should place entities by world position, projected to ground point and height', () => {
    var view = new IsometricScene({ projection })
    var e = view.place('officer', {}, 1020, 356, 896)
    expect([e.x, e.y, e.elevation]).toEqual([720, 1696, 896])
    e.world.x = 1000
    view.projectEntity(e)
    expect(e.x).toEqual(760)
  })

  it('should draw the ground first, then entities farthest first', () => {
    var log = []
    var view = new IsometricScene({ projection })
    view.addScene('ground', new Scene({ background: () => log.push('ground') }))
    view.place('near', fakeEntity(log, 'near'), 100, 100, 0)
    view.place('far', fakeEntity(log, 'far'), 500, 500, 0)
    view.place('farHigh', fakeEntity(log, 'farHigh'), 500, 500, 50)
    var context = jasmine.createSpyObj('context', ['save', 'restore', 'translate', 'scale', 'rotate'])
    view.draw(context)
    expect(log).toEqual(['ground', 'far', 'farHigh', 'near'])
  })

  it('should draw entities on the camera\'s grid when asked, so a followed one keeps still', () => {
    var view = new IsometricScene({ projection, snap: 1 / 3 })
    var e = view.place('officer', {}, 1020.4, 356.2, 896)
    var screen = projection.toScreen(1020.4, 356.2, 896)
    expect(e.x).toBeCloseTo(Math.floor(screen.x * 3) / 3, 9)
    expect(e.y - e.elevation).toBeCloseTo(Math.floor(screen.y * 3) / 3, 9)
    view.centerOn(e.world, 120, 96, 1 / 3)
    expect(e.x - view.camera.x).toBeCloseTo(120, 9)
    expect(e.y - e.elevation - view.camera.y).toBeCloseTo(96, 9)
  })

  it('should keep the screen position of entities without a world position', () => {
    var view = new IsometricScene({ projection })
    var label = { x: 5, y: 6, draw: () => {} }
    view.addEntity('label', label)
    view.draw(jasmine.createSpyObj('context', ['save', 'restore', 'translate', 'scale', 'rotate']))
    expect([label.x, label.y]).toEqual([5, 6])
  })

  it('should centre the camera on a world position, in steps if asked, and find the world under a point', () => {
    var view = new IsometricScene({ projection })
    view.centerOn({ x: 1020, y: 356, z: 896 }, 120, 96, [8, 1])
    // The game: scroll x = (720 - 120) rounded down to 8, scroll y = 800 - 96
    expect([view.camera.x, view.camera.y]).toEqual([600, 704])
    var w = view.worldAt(120, 96, 896)
    expect([w.x, w.y]).toEqual([1020, 356])
    var context = jasmine.createSpyObj('context', ['save', 'restore', 'translate', 'scale', 'rotate'])
    view.draw(context)
    expect(context.translate).toHaveBeenCalledWith(-600, -704)
    // One number rounds both axes
    view.centerOn({ x: 1020, y: 356, z: 899 }, 120, 99, 8)
    expect([view.camera.x, view.camera.y]).toEqual([600, 696])
  })
})

describe('IsometricScene occluders', () => {
  var projection = new IsometricProjection({ xAxis: [-2, -1], yAxis: [2, -1], origin: [2048, 3072] })
  function context () {
    var c = jasmine.createSpyObj('context', ['save', 'restore', 'translate', 'scale', 'rotate', 'beginPath', 'rect', 'clip', 'drawImage'])
    c.log = []
    c.drawImage.and.callFake((img) => c.log.push(img.name))
    return c
  }
  // An entity 32 by 34, anchored at its bottom left, that logs its drawing
  function sprite (name, ctx) {
    return { width: 32, height: 34, origin: [0, 34], visible: true, draw: () => ctx.log.push(name) }
  }

  it('should draw an occluder over the entities behind it, clipped to each', () => {
    var view = new IsometricScene({ projection })
    var ctx = context()
    var arch = { name: 'arch', width: 64, height: 64 }
    var a = view.place('a', sprite('a', ctx), 1200, 371, 896)   // screen box from (390, 571)
    view.place('b', sprite('b', ctx), 1000, 300, 896)           // far from the arch
    view.addOccluder({ image: arch, x: 380, y: 560, hides: (e) => e.world.x > 1100 })
    view.draw(ctx)
    expect(ctx.log).toEqual(['a', 'arch', 'b'])
    expect(ctx.rect).toHaveBeenCalledWith(a.x, a.y - a.elevation - 34, 32, 34)
    expect(view.occludersOf(a).length).toEqual(1)
  })

  it('should leave entities in front alone, and clear occluders', () => {
    var view = new IsometricScene({ projection })
    var ctx = context()
    view.place('a', sprite('a', ctx), 1200, 371, 896)
    var o = view.addOccluder({ image: { name: 'arch', width: 64, height: 64 }, x: 380, y: 560, hides: () => false })
    expect([o.sx, o.sy, o.width]).toEqual([0, 0, 64])
    view.draw(ctx)
    expect(ctx.log).toEqual(['a'])
    view.clearOccluders()
    expect(view.occluders).toEqual([])
  })

  it('should take a live occluder\'s art from its source through its mask, again only when invalidated', () => {
    var view = new IsometricScene({ projection })
    var ground = { drawContent: jasmine.createSpy('drawContent') }
    var mask = { width: 32, height: 16 }
    var a = view.addOccluder({ image: mask, x: 100, y: 50, source: ground })
    var b = view.addOccluder({ image: mask, x: 400, y: 50, source: ground })
    var drawn = jasmine.createSpyObj('context', ['clearRect', 'save', 'restore', 'translate', 'drawImage'])
    var canvas = { getContext: () => drawn }
    var create = document.createElement
    document.createElement = () => canvas
    try {
      expect(view.occluderArt(a)).toEqual({ image: canvas, sx: 0, sy: 0 })
      expect(drawn.translate).toHaveBeenCalledWith(-100, -50)
      expect(ground.drawContent).toHaveBeenCalledWith(drawn)
      expect(drawn.drawImage).toHaveBeenCalledWith(mask, 0, 0, 32, 16, 0, 0, 32, 16)
      view.occluderArt(a)
      expect(ground.drawContent.calls.count()).toEqual(1)
      view.occluderArt(b)
      ground.drawContent.calls.reset()
      view.invalidateOccluders(110, 60, 4, 4)
      expect([a.dirty, b.dirty]).toEqual([true, false])
      view.occluderArt(a)
      expect(ground.drawContent.calls.count()).toEqual(1)
    } finally {
      document.createElement = create
    }
    var plain = view.addOccluder({ image: mask, x: 0, y: 0, sx: 4 })
    expect(view.occluderArt(plain)).toEqual({ image: mask, sx: 4, sy: 0 })
  })
})
