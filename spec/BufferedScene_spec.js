const BufferedScene = require('../lib/BufferedScene')
const ContextMock2D = require('./mocks/ContextMock2D')

function fakeCanvas () {
  var context = new ContextMock2D()
  return { getContext: () => context, context }
}

describe('BufferedScene', () => {
  var scene
  beforeEach(() => {
    scene = new BufferedScene({ width: 544, height: 333, createCanvas: fakeCanvas })
  })

  it('should create a back buffer and a screen of the given size', () => {
    expect(scene.back.width).toEqual(544)
    expect(scene.screen.height).toEqual(333)
    expect(scene.back).not.toBe(scene.screen)
  })

  it('should copy all of the back buffer to the screen', () => {
    scene.copyToScreen()
    expect(scene.screen.context.drawImage).toHaveBeenCalledWith(scene.back, 0, 0, 544, 333, 0, 0, 544, 333)
  })

  it('should copy part of the back buffer to the screen', () => {
    scene.copyToScreen([10, 20, 110, 70])
    expect(scene.screen.context.drawImage).toHaveBeenCalledWith(scene.back, 10, 20, 100, 50, 10, 20, 100, 50)
  })

  it('should snapshot the screen into a new canvas', () => {
    var snap = scene.snapshot()
    expect(snap.context.drawImage).toHaveBeenCalledWith(scene.screen, 0, 0)
  })

  it('should draw the screen, then child scenes, then entities', () => {
    var context = new ContextMock2D()
    var order = []
    context.drawImage.and.callFake(() => order.push('screen'))
    spyOn(scene, 'drawScenes').and.callFake(() => order.push('scenes'))
    spyOn(scene, 'drawEntities').and.callFake(() => order.push('entities'))
    scene.draw(context)
    expect(context.drawImage).toHaveBeenCalledWith(scene.screen, 0, 0)
    expect(order).toEqual(['screen', 'scenes', 'entities'])
  })

  it('should resolve a transition of type none at once', async () => {
    await scene.transition(scene.snapshot(), { type: 'none' })
    expect(scene.transitioning).toBe(false)
  })

  it('should fade the old picture out over a dissolve, then resolve', async () => {
    var now = 1000
    spyOn(Date, 'now').and.callFake(() => now)
    var before = scene.snapshot()
    var done = scene.transition(before, { type: 'dissolve', duration: 200 })
    var context = new ContextMock2D()
    now = 1100
    scene.draw(context)
    expect(context.drawImage).toHaveBeenCalledWith(before, 0, 0, 544, 333, 0, 0, 544, 333)
    expect(scene.transitioning).toBe(true)
    now = 1200
    scene.draw(context)
    await done
    expect(scene.transitioning).toBe(false)
  })

  it('should finish a transition on time even if nothing draws', async () => {
    jasmine.clock().install()
    var done = scene.transition(scene.snapshot(), { duration: 300 })
    jasmine.clock().tick(300)
    jasmine.clock().uninstall()
    await done
    expect(scene.transitioning).toBe(false)
  })

  it('should resolve a transition that is replaced by another', async () => {
    var first = scene.transition(scene.snapshot(), { duration: 1000 })
    scene.transition(scene.snapshot(), { type: 'wipeLeft', duration: 1000 })
    await first
    expect(scene.transitioning).toBe(true)
  })

  it('should keep the uncovered part of the old picture during a wipe', () => {
    var now = 0
    spyOn(Date, 'now').and.callFake(() => now)
    var before = scene.snapshot()
    scene.transition(before, { type: 'wipeRight', rect: [0, 0, 100, 50], duration: 100 })
    var context = new ContextMock2D()
    now = 25
    scene.draw(context)
    expect(context.drawImage).toHaveBeenCalledWith(before, 25, 0, 75, 50, 25, 0, 75, 50)
  })
})
