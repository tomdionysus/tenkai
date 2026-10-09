const path = require('path')

const GameEngine = require('../lib/GameEngine')
const Asset = require('../lib/Asset')
const Audio = require('../lib/Audio')
const Util = require('../lib/Util')

describe('GameEngine', () => {
  it('should allow New', () => {
    var x1 = new GameEngine()
    var x2 = new GameEngine()

    expect(x1).not.toBe(x2)
  })

  it('should have correct mixins', () => {
    var x1 = new GameEngine()

    expect(x1._events).not.toBeUndefined()
    expect(x1._scenes).not.toBeUndefined()
    expect(x1._entities).not.toBeUndefined()
  })

  it('should use option defaults', () => {
    var options = {
      targetId: 'targetId',
      fullscreen: 'fullscreen',
      showHUD: 'showHUD',
      scale: 'scale',
      x: 3,
      y: 4,
      maxScale: 5,
      minScale: 6,
      minX: 7,
      minY: 8,
      maxX: 9,
      maxY: 10,
      globalAlpha: 11,
      enableScroll: 'enableScroll',
      enableZoom: 'enableZoom'
    }

    var x1 = new GameEngine(options)

    expect(x1.targetId).toEqual('targetId')
    expect(x1.fullscreen).toBeTruthy()
    expect(x1.showHUD).toBeTruthy()
    expect(x1.scale).toEqual('scale')
    expect(x1.x).toEqual(3)
    expect(x1.y).toEqual(4)
    expect(x1.maxScale).toEqual(5)
    expect(x1.minScale).toEqual(6)
    expect(x1.minX).toEqual(7)
    expect(x1.minY).toEqual(8)
    expect(x1.maxX).toEqual(9)
    expect(x1.maxY).toEqual(10)
    expect(x1.globalAlpha).toEqual(11)
    expect(x1.enableScroll).toBeTruthy()
    expect(x1.enableZoom).toBeTruthy()
  })

  it('should have correct events', () => {
    var x1 = new GameEngine()

    expect(Object(x1._events).keys).toEqual()
  })

  describe('setGlobalAlpha', () => {
    it('should set globalAlpha', () => {
      var x1 = new GameEngine()

      x1.setGlobalAlpha(19)

      expect(x1.globalAlpha).toEqual(19)
    })
  })

  describe('_bindMouseWheel', () => {
    it('should bind to a real EventTarget without throwing', () => {
      var x1 = new GameEngine()
      x1.element = new EventTarget()

      expect(() => x1._bindMouseWheel()).not.toThrow()
    })

    it('should use addEventListener if defined on element', () => {
      var x1 = new GameEngine({ enableScroll: false, enableZoom: false })
      var ele = generateSpyObject(['addEventListener'])

      x1.element = ele

      x1._bindMouseWheel()

      expect(ele.addEventListener).toHaveBeenCalledWith('mousemove', jasmine.any(Function), false)
      expect(ele.addEventListener).toHaveBeenCalledWith('mousedown', jasmine.any(Function))
      expect(ele.addEventListener).toHaveBeenCalledWith('mouseup', jasmine.any(Function))
    })

    it('should bind wheel if enableScroll and enableZoom are true', () => {
      var x1 = new GameEngine({ enableScroll: true, enableZoom: true })
      var ele = generateSpyObject(['addEventListener'])

      x1.element = ele

      x1._bindMouseWheel()

      expect(ele.addEventListener).toHaveBeenCalledWith('wheel', jasmine.any(Function), { passive: false })
    })

    it('should call correct ongoing functions on events', () => {
      var x1 = new GameEngine({ enableScroll: true, enableZoom: true })
      var fns = {}
      var ele = generateSpyObject(['addEventListener'])
      ele.addEventListener.and.callFake((evt, f) => { fns[evt] = f })
      x1.element = ele

      spyOn(x1, '_panZoom')
      spyOn(x1, '_move')
      spyOn(x1, 'trigger')

      x1._bindMouseWheel()

      for (var i in fns) { fns[i]('ONE') }

      expect(x1._panZoom).toHaveBeenCalledWith('ONE')
      expect(x1._move).toHaveBeenCalledWith('ONE')
      expect(x1.trigger).toHaveBeenCalledWith('mousedown', x1, 'ONE')
      expect(x1.trigger).toHaveBeenCalledWith('mouseup', x1, 'ONE')
    })
  })

  describe('init', () => {
    it('should call callback', () => {
      var x1 = new GameEngine()
      var cb = generateSpyObject(['callback'])

      x1.init(cb.callback)

      expect(cb.callback).toHaveBeenCalledWith()
    })
  })

  describe('stop', () => {
    it('should set running to false', () => {
      var x1 = new GameEngine()

      x1.running = true
      x1.stop()

      expect(x1.running).toBeFalsy()
    })
  })

  describe('addAsset', () => {
    it('should set asset name and src', () => {
      var x1 = new GameEngine()

      x1.addAsset('asset', 'source')

      expect(x1._assetDefs.asset).toEqual('source')
    })
  })

  describe('getAsset', () => {
    it('should return asset with name', () => {
      var x1 = new GameEngine()

      x1.assets = {}
      x1.assets.asset = 'source'

      expect(x1.getAsset('asset')).toEqual('source')
    })

    it('should throw if asset not found', () => {
      var x1 = new GameEngine()

      x1.assets = {}
      x1.assets.asset = 'source'

      expect(() => { x1.getAsset('asset2') }).toThrow('Asset not found: asset2')
    })
  })

  describe('addAudio', () => {
    it('should set audio name, type and src', () => {
      var x1 = new GameEngine()

      x1.addAudio('audio', 'source', 'type')

      expect(x1._audioDefs.audio).toEqual({ src: 'source', type: 'type' })
    })
  })

  describe('getAudio', () => {
    it('should return audio with name', () => {
      var x1 = new GameEngine()

      x1.audio = {}
      x1.audio.audio = 'source'

      expect(x1.getAudio('audio')).toEqual('source')
    })

    it('should throw if audio not found', () => {
      var x1 = new GameEngine()

      x1.audio = {}
      x1.audio.audio = 'source'

      expect(() => { x1.getAudio('audio2') }).toThrow('Audio not found: audio2')
    })
  })

  describe('recomputeFullScreen', () => {
    it('should reset width and height from element, redraw and trigger resize', () => {
      var x1 = new GameEngine()

      spyOn(x1, 'trigger')

      x1.window = { innerWidth: 789, innerHeight: 1112 }
      x1.element = { width: 123, height: 456 }
      x1.scale = 3

      x1.recomputeFullScreen()

      expect(x1.width).toEqual(263)
      expect(x1.height).toEqual(371)

      expect(x1.trigger).toHaveBeenCalledWith('resize', x1)
    })
  })

  describe('loadAssets', () => {
    it('should console.debug and create assets', () => {
      var x1 = new GameEngine()

      x1.addAsset('test', path.join(__dirname, 'fixtures/sprite.png'))

      var cb = generateSpyObject(['callback'])

      spyOn(console, 'debug')
      x1.loadAssets(cb.callback)

      var ele = { onload: () => {} }
      spyOn(document, 'createElement').and.returnValue(ele)

      expect(x1.assets.test).toEqual(jasmine.any(Asset))

      x1.assets.test.element.onload({ returnValue: true })

      expect(console.debug).toHaveBeenCalledWith('loading assets')
      expect(cb.callback).toHaveBeenCalledWith(null)
    })
  })

  describe('loadAudio', () => {
    it('should console.debug and create audio', () => {
      var x1 = new GameEngine()

      x1.addAudio('test', path.join(__dirname, 'fixtures/sprite.png'))

      var cb = generateSpyObject(['callback'])

      spyOn(console, 'debug')
      x1.loadAudio(cb.callback)

      expect(x1.audio.test).toEqual(jasmine.any(Audio))

      expect(console.debug).toHaveBeenCalledWith('loading audio')
    })
  })

  describe('_enforceScrollLimits', () => {
    it('should enforce limits of zero', () => {
      var x1 = new GameEngine({ minX: 0, minY: 0 })
      x1.x = -10
      x1.y = -20

      x1._enforceScrollLimits()

      expect(x1.x).toEqual(0)
      expect(x1.y).toEqual(0)
    })

    it('should reset x and y coordinates to minimums respecting scale', () => {
      var x1 = new GameEngine()

      x1.x = 50
      x1.y = 50

      x1.minX = 100
      x1.minY = 100

      x1.scale = 1.5

      x1._enforceScrollLimits()

      expect(x1.x).toEqual(150)
      expect(x1.y).toEqual(150)
    })

    it('should reset x and y coordinates to maximums respecting scale', () => {
      var x1 = new GameEngine()

      x1.x = 200
      x1.y = 200

      x1.maxX = 150
      x1.maxY = 150

      x1.scale = 1.5

      x1._enforceScrollLimits()

      expect(x1.x).toEqual(100)
      expect(x1.y).toEqual(100)
    })
  })

  describe('_move', () => {
    it('should correctly call methods', () => {
      var x1 = new GameEngine()

      spyOn(x1, '_setMouseCoords')
      spyOn(x1, 'trigger')

      var e = generateSpyObject(['preventDefault', 'stopPropagation'])

      x1._move(e)

      expect(x1._setMouseCoords).toHaveBeenCalledWith(e)
      expect(x1.trigger).toHaveBeenCalledWith('mousemove', x1, e)

      expect(e.preventDefault).toHaveBeenCalledWith()
      expect(e.stopPropagation).toHaveBeenCalledWith()
    })
  })

  describe('_setMouseCoords', () => {
    it('should correctly set mouseX and mouseY respecting scale', () => {
      var x1 = new GameEngine()

      x1.x = 50
      x1.y = 50

      x1.scale = 1.5

      var e = { x: 30, y: 60 }

      x1._setMouseCoords(e)

      expect(x1.mouseX).toEqual(-30)
      expect(x1.mouseY).toEqual(-10)
    })

    it('should map client coordinates to canvas pixels when the canvas is offset and scaled by CSS', () => {
      var x1 = new GameEngine()
      x1.element = { width: 640, height: 400, getBoundingClientRect: () => ({ left: 100, top: 50, width: 1280, height: 800 }) }

      x1._setMouseCoords({ clientX: 740, clientY: 450, x: 740, y: 450 })

      expect(x1.mouseX).toEqual(320)
      expect(x1.mouseY).toEqual(200)
    })
  })

  describe('bootElement', () => {
    it('should boot element in DOM', () => {
      var x1 = new GameEngine()
      spyOn(x1, '_bindMouseWheel')

      var cb = generateSpyObject(['callback'])

      spyOn(console, 'debug')
      x1.bootElement(cb.callback)
    })

    it('should not throw when no callback', () => {
      var x1 = new GameEngine()
      spyOn(x1, '_bindMouseWheel')

      var cb = generateSpyObject(['callback'])

      spyOn(console, 'debug')
      x1.bootElement()
    })

    it('should not throw when fullscreen', () => {
      var x1 = new GameEngine({ fullscreen: true })
      spyOn(x1, 'recomputeFullScreen')
      spyOn(x1, '_bindMouseWheel')

      var fn
      spyOn(Util, 'debounce').and.callFake((f) => { fn = f })

      var cb = generateSpyObject(['callback'])

      spyOn(console, 'debug')
      x1.bootElement()

      fn()
    })
  })

  describe('_drawHUD', () => {
    it('should call context functions correctly', () => {
      var context = generateSpyObject(['save', 'fillText', 'restore'])

      var x1 = new GameEngine({
        x: 3,
        y: 4,
        scale: 7,
        rotate: 8,
        minX: 100,
        minY: 100,
        maxX: 150,
        maxY: 150
      })

      x1.width = 5
      x1.height = 6

      x1._drawHUD(context)

      expect(context.save).toHaveBeenCalledWith()
      expect(context.font).toEqual('14px Arial')
      expect(context.fillStyle).toEqual('white')
      expect(context.fillText).toHaveBeenCalledWith('Screen (X: 3 Y: 4 W: 5 H: 6) Zoom: 700% Mouse (X: NaN Y: NaN) Limits Min: (X: 14, Y: 14) Limit Max: (X: 1050, Y: 1050)', 10, 20)
      expect(context.restore).toHaveBeenCalledWith()
    })
  })

  describe('_tick', () => {
    it('should call context functions correctly', () => {
      var context = generateSpyObject(['save', 'fillRect', 'scale', 'translate', 'restore'])

      var x1 = new GameEngine({
        x: 3,
        y: 4,
        scale: 7,
        rotate: 8,
        minX: 100,
        minY: 100,
        maxX: 150,
        maxY: 150
      })

      x1.element = { getContext: () => {}, width: 200, height: 300 }
      x1.running = true

      spyOn(x1.element, 'getContext').and.returnValue(context)

      addSpies(x1, ['update', 'sortScenesZ', 'drawScenes', 'drawEntities'])

      var f
      spyOn(window, 'requestAnimationFrame').and.callFake((fn) => { f = fn })

      x1._tick()

      expect(x1.sortScenesZ).toHaveBeenCalledWith()
      expect(x1.drawScenes).toHaveBeenCalledWith(context)
      expect(x1.drawEntities).toHaveBeenCalledWith(context)

      expect(context.save).toHaveBeenCalledWith()
      expect(context.scale).toHaveBeenCalledWith(7, 7)
      expect(context.translate).toHaveBeenCalledWith(3, 4)
      expect(context.fillRect).toHaveBeenCalledWith(0, 0, 200, 300)
      expect(context.restore).toHaveBeenCalledWith()

      expect(window.requestAnimationFrame).toHaveBeenCalledWith(jasmine.any(Function), 0)
    })

    it('should not call sortScenesZ if order maps exist', () => {
      var context = generateSpyObject(['save', 'fillRect', 'scale', 'translate', 'restore'])

      var x1 = new GameEngine({
        x: 3,
        y: 4,
        scale: 7,
        rotate: 8,
        minX: 100,
        minY: 100,
        maxX: 150,
        maxY: 150
      })

      x1.element = { getContext: () => {}, width: 200, height: 300 }

      x1._sceneOrderMap = {}

      spyOn(x1.element, 'getContext').and.returnValue(context)

      addSpies(x1, ['update', 'sortScenesZ', 'drawScenes', 'drawEntities'])

      x1._tick()

      expect(x1.sortScenesZ).not.toHaveBeenCalledWith()
    })

    it('should call _drawHUD if showHUD is set', () => {
      var context = generateSpyObject(['save', 'fillRect', 'scale', 'translate', 'restore'])

      var x1 = new GameEngine({
        x: 3,
        y: 4,
        scale: 7,
        rotate: 8,
        minX: 100,
        minY: 100,
        maxX: 150,
        maxY: 150,
        showHUD: true
      })

      x1.element = { getContext: () => {}, width: 200, height: 300 }

      x1._sceneOrderMap = {}

      spyOn(x1.element, 'getContext').and.returnValue(context)

      addSpies(x1, ['update', 'sortScenesZ', 'drawScenes', 'drawEntities', '_drawHUD'])

      x1._tick()

      expect(x1._drawHUD).toHaveBeenCalledWith(context)
    })
  })

  describe('steps', () => {
    var x1, context
    beforeEach(() => {
      context = generateSpyObject(['save', 'fillRect', 'scale', 'translate', 'restore'])
      x1 = new GameEngine()
      x1.element = { getContext: () => context, width: 200, height: 300 }
      addSpies(x1, ['drawScenes', 'drawEntities'])
    })

    it('should run fixed steps for the time since the last frame, carrying the remainder', () => {
      spyOn(x1, 'update')
      spyOn(Date, 'now').and.returnValues(1000, 1040, 1050)
      x1._tick()
      expect(x1.update).not.toHaveBeenCalled()
      x1._tick()
      expect(x1.update.calls.count()).toEqual(2)
      expect(x1.update.calls.argsFor(0)).toEqual([1 / 60])
      x1._tick()
      expect(x1.update.calls.count()).toEqual(3)
    })

    it('should catch up at most a quarter of a second', () => {
      spyOn(x1, 'update')
      spyOn(Date, 'now').and.returnValues(1000, 9000)
      x1._tick()
      x1._tick()
      expect(x1.update.calls.count()).toEqual(15)
    })

    it('should follow the step rate', () => {
      x1.stepRate = 30
      spyOn(x1, 'update')
      x1.step()
      expect(x1.update).toHaveBeenCalledWith(1 / 30)
    })

    it('should sample input, update, run timers, then animate, in each step', () => {
      var order = []
      spyOn(x1.input, 'beginStep').and.callFake(() => order.push('input'))
      spyOn(x1, 'update').and.callFake(() => order.push('update'))
      x1.after(0, () => order.push('timer'))
      spyOn(x1, 'animateScenes').and.callFake((ms) => order.push('scenes ' + Math.round(ms)))
      spyOn(x1, 'animateEntities').and.callFake((ms) => order.push('entities ' + Math.round(ms)))
      x1.step()
      expect(order).toEqual(['input', 'update', 'timer', 'scenes 17', 'entities 17'])
    })

    it('should count game time', () => {
      x1.step()
      x1.step()
      expect(x1.time).toBeCloseTo(2 / 60, 9)
    })
  })

  describe('timers', () => {
    var x1
    beforeEach(() => { x1 = new GameEngine() })

    it('should call a function after some game time', () => {
      var fn = jasmine.createSpy('fn')
      x1.after(0.05, fn)
      x1.step(); x1.step()
      expect(fn).not.toHaveBeenCalled()
      x1.step()
      expect(fn).toHaveBeenCalled()
    })

    it('should call a function repeatedly', () => {
      var fn = jasmine.createSpy('fn')
      x1.every(0.1, fn)
      for (var i = 0; i < 30; i++) x1.step()
      expect(fn.calls.count()).toEqual(5)
    })

    it('should cancel a timer, and all timers', () => {
      var a = jasmine.createSpy('a')
      var b = jasmine.createSpy('b')
      x1.after(0.01, a).cancel()
      x1.every(0.01, b)
      x1.clearTimers()
      for (var i = 0; i < 5; i++) x1.step()
      expect(a).not.toHaveBeenCalled()
      expect(b).not.toHaveBeenCalled()
    })
  })

  describe('modes', () => {
    it('should exit the old mode and enter the new one, passing the old one', () => {
      var x1 = new GameEngine()
      var a = { exit: jasmine.createSpy('exit') }
      var b = { enter: jasmine.createSpy('enter') }
      x1.setMode(a)
      x1.setMode(b)
      expect(a.exit).toHaveBeenCalled()
      expect(b.enter).toHaveBeenCalledWith(a)
      expect(x1.mode).toBe(b)
    })

    it('should update the mode each step by default', () => {
      var x1 = new GameEngine()
      var mode = { update: jasmine.createSpy('update') }
      x1.setMode(mode)
      x1.step()
      expect(mode.update).toHaveBeenCalledWith(1 / 60)
    })

    it('should draw the mode over the scenes', () => {
      var context = generateSpyObject(['save', 'fillRect', 'scale', 'translate', 'restore'])
      var x1 = new GameEngine()
      x1.element = { width: 10, height: 10 }
      var order = []
      spyOn(x1, 'drawScenes').and.callFake(() => order.push('scenes'))
      spyOn(x1, 'drawEntities').and.callFake(() => order.push('entities'))
      x1.setMode({ draw: () => order.push('mode') })
      x1.draw(context)
      expect(order).toEqual(['scenes', 'entities', 'mode'])
    })
  })

  describe('_panZoom', () => {
    it('should correctly call methods', () => {
      var x1 = new GameEngine({
        x: 3,
        y: 4,
        scale: 7,
        rotate: 8,
        minX: 100,
        minY: 100,
        maxX: 150,
        maxY: 150,
        showHUD: true,
        enableScroll: false
      })

      addSpies(x1, ['_enforceScrollLimits', '_setMouseCoords'])

      var e = generateSpyObject(['preventDefault', 'stopPropagation'])

      e.deltaX = 10
      e.deltaY = -5

      x1._panZoom(e)

      expect(x1._enforceScrollLimits).toHaveBeenCalledWith()
      expect(x1._setMouseCoords).toHaveBeenCalledWith(e)

      expect(e.preventDefault).toHaveBeenCalledWith()
      expect(e.stopPropagation).toHaveBeenCalledWith()

      expect(x1.x).toEqual(3)
      expect(x1.y).toEqual(4)
    })

    it('should respond to shiftKey and enableZoom', () => {
      var x1 = new GameEngine({
        x: 3,
        y: 4,
        scale: 1,
        rotate: 8,
        minX: 100,
        minY: 100,
        maxX: 150,
        maxY: 150,
        enableZoom: true
      })

      x1.element = { width: 400, height: 500 }
      x1.width = 400
      x1.height = 500

      addSpies(x1, ['_enforceScrollLimits', '_setMouseCoords'])

      var e = generateSpyObject(['preventDefault', 'stopPropagation'])

      e.shiftKey = true
      e.deltaX = 10
      e.deltaY = -5

      x1._panZoom(e)

      expect(x1._enforceScrollLimits).toHaveBeenCalledWith()
      expect(x1._setMouseCoords).toHaveBeenCalledWith(e)

      expect(e.preventDefault).toHaveBeenCalledWith()
      expect(e.stopPropagation).toHaveBeenCalledWith()

      expect(x1.x).toEqual(13.5263157894737)
      expect(x1.y).toEqual(17.157894736842138)
      expect(x1.scale).toEqual(0.95)
    })

    it('should respond to shiftKey and enableZoom and respect minScale', () => {
      var x1 = new GameEngine({
        x: 3,
        y: 4,
        scale: 1,
        rotate: 8,
        minX: 100,
        minY: 100,
        maxX: 150,
        maxY: 150,
        enableZoom: true,
        minScale: 0.98
      })

      x1.element = { width: 400, height: 500 }
      x1.width = 400
      x1.height = 500

      addSpies(x1, ['_enforceScrollLimits', '_setMouseCoords'])

      var e = generateSpyObject(['preventDefault', 'stopPropagation'])

      e.shiftKey = true
      e.deltaX = 10
      e.deltaY = -5

      x1._panZoom(e)

      expect(x1._enforceScrollLimits).toHaveBeenCalledWith()
      expect(x1._setMouseCoords).toHaveBeenCalledWith(e)

      expect(e.preventDefault).toHaveBeenCalledWith()
      expect(e.stopPropagation).toHaveBeenCalledWith()

      expect(x1.x).toEqual(7.081632653061234)
      expect(x1.y).toEqual(9.102040816326536)
      expect(x1.scale).toEqual(0.98)
    })

    it('should respond to shiftKey and enableZoom and respect maxScale', () => {
      var x1 = new GameEngine({
        x: 3,
        y: 4,
        scale: 1,
        rotate: 8,
        minX: 100,
        minY: 100,
        maxX: 150,
        maxY: 150,
        enableZoom: true,
        maxScale: 1.05
      })

      x1.element = { width: 400, height: 500 }
      x1.width = 400
      x1.height = 500

      addSpies(x1, ['_enforceScrollLimits', '_setMouseCoords'])

      var e = generateSpyObject(['preventDefault', 'stopPropagation'])

      e.shiftKey = true
      e.deltaX = 10
      e.deltaY = 20

      x1._panZoom(e)

      expect(x1._enforceScrollLimits).toHaveBeenCalledWith()
      expect(x1._setMouseCoords).toHaveBeenCalledWith(e)

      expect(e.preventDefault).toHaveBeenCalledWith()
      expect(e.stopPropagation).toHaveBeenCalledWith()

      expect(x1.x).toEqual(-6.523809523809518)
      expect(x1.y).toEqual(-7.904761904761926)
      expect(x1.scale).toEqual(1.05)
    })

    it('should respond enableScroll', () => {
      var x1 = new GameEngine({
        x: 3,
        y: 4,
        scale: 1,
        rotate: 8,
        minX: 100,
        minY: 100,
        maxX: 150,
        maxY: 150,
        enableScroll: true
      })

      x1.element = { width: 400, height: 500 }
      x1.width = 400
      x1.height = 500

      addSpies(x1, ['_enforceScrollLimits', '_setMouseCoords'])

      var e = generateSpyObject(['preventDefault', 'stopPropagation'])

      e.deltaX = 10
      e.deltaY = -5

      x1._panZoom(e)

      expect(x1._enforceScrollLimits).toHaveBeenCalledWith()
      expect(x1._setMouseCoords).toHaveBeenCalledWith(e)

      expect(e.preventDefault).toHaveBeenCalledWith()
      expect(e.stopPropagation).toHaveBeenCalledWith()

      expect(x1.x).toEqual(13)
      expect(x1.y).toEqual(-1)
    })
  })

  describe('start', () => {
    it('should correctly call methods', () => {
      var x1 = new GameEngine()

      addSpies(x1, ['loadAssets', 'loadAudio', 'bootElement', 'init', '_tick'])

      x1.loadAssets.and.callFake((f) => { f() })
      x1.loadAudio.and.callFake((f) => { f() })
      x1.bootElement.and.callFake((f) => { f() })
      x1.init.and.callFake((f) => { f() })

      var cb = generateSpyObject(['callback'])

      spyOn(console, 'debug')
      var fn
      spyOn(global, 'setTimeout').and.callFake((f) => { fn = f })

      x1.start(cb.callback)

      expect(x1.loadAssets).toHaveBeenCalledWith(jasmine.any(Function))
      expect(x1.loadAudio).toHaveBeenCalledWith(jasmine.any(Function))
      expect(x1.bootElement).toHaveBeenCalledWith(jasmine.any(Function))
      expect(x1.init).toHaveBeenCalledWith(jasmine.any(Function))

      expect(console.debug).toHaveBeenCalledWith('starting')
      expect(console.debug).toHaveBeenCalledWith('started')

      expect(global.setTimeout).toHaveBeenCalledWith(jasmine.any(Function), 0)

      fn()
      expect(x1._tick).toHaveBeenCalledWith()

      expect(cb.callback).toHaveBeenCalledWith()
    })

    it('should correctly call methods with no callback', () => {
      var x1 = new GameEngine()

      addSpies(x1, ['loadAssets', 'loadAudio', 'bootElement', 'init', '_tick'])

      x1.loadAssets.and.callFake((f) => { f() })
      x1.loadAudio.and.callFake((f) => { f() })
      x1.bootElement.and.callFake((f) => { f() })
      x1.init.and.callFake((f) => { f() })

      spyOn(console, 'debug')
      var fn
      spyOn(global, 'setTimeout').and.callFake((f) => { fn = f })

      x1.start()

      expect(x1.loadAssets).toHaveBeenCalledWith(jasmine.any(Function))
      expect(x1.loadAudio).toHaveBeenCalledWith(jasmine.any(Function))
      expect(x1.bootElement).toHaveBeenCalledWith(jasmine.any(Function))
      expect(x1.init).toHaveBeenCalledWith(jasmine.any(Function))

      expect(console.debug).toHaveBeenCalledWith('starting')
      expect(console.debug).toHaveBeenCalledWith('started')

      expect(global.setTimeout).toHaveBeenCalledWith(jasmine.any(Function), 0)

      fn()
      expect(x1._tick).toHaveBeenCalledWith()
    })

    it('should call error if subinit calls back error', () => {
      var x1 = new GameEngine()

      addSpies(x1, ['loadAssets', 'loadAudio', 'bootElement', 'init', '_tick'])

      x1.loadAssets.and.callFake((f) => { f() })
      x1.loadAudio.and.callFake((f) => { f() })
      x1.bootElement.and.callFake((f) => { f() })
      x1.init.and.callFake((f) => { f('ERROR') })

      spyOn(console, 'debug')
      spyOn(console, 'error')
      var fn
      spyOn(global, 'setTimeout').and.callFake((f) => { fn = f })

      x1.start()

      expect(x1.loadAssets).toHaveBeenCalledWith(jasmine.any(Function))
      expect(x1.loadAudio).toHaveBeenCalledWith(jasmine.any(Function))
      expect(x1.bootElement).toHaveBeenCalledWith(jasmine.any(Function))
      expect(x1.init).toHaveBeenCalledWith(jasmine.any(Function))

      expect(console.debug).toHaveBeenCalledWith('starting')
      expect(console.debug).not.toHaveBeenCalledWith('started')
      expect(console.error).toHaveBeenCalledWith('error while starting', 'ERROR')

      expect(global.setTimeout).not.toHaveBeenCalled()

      expect(x1.fn).toBeUndefined()
    })

    it('should call error if subinit calls back error and call callback', () => {
      var x1 = new GameEngine()

      addSpies(x1, ['loadAssets', 'loadAudio', 'bootElement', 'init', '_tick'])

      x1.loadAssets.and.callFake((f) => { f() })
      x1.loadAudio.and.callFake((f) => { f() })
      x1.bootElement.and.callFake((f) => { f() })
      x1.init.and.callFake((f) => { f('ERROR') })

      spyOn(console, 'debug')
      spyOn(console, 'error')
      var fn
      spyOn(global, 'setTimeout').and.callFake((f) => { fn = f })

      var cb = generateSpyObject(['callback'])
      x1.start(cb.callback)

      expect(x1.loadAssets).toHaveBeenCalledWith(jasmine.any(Function))
      expect(x1.loadAudio).toHaveBeenCalledWith(jasmine.any(Function))
      expect(x1.bootElement).toHaveBeenCalledWith(jasmine.any(Function))
      expect(x1.init).toHaveBeenCalledWith(jasmine.any(Function))

      expect(console.debug).toHaveBeenCalledWith('starting')
      expect(console.debug).not.toHaveBeenCalledWith('started')
      expect(console.error).toHaveBeenCalledWith('error while starting', 'ERROR')

      expect(global.setTimeout).not.toHaveBeenCalled()

      expect(x1.fn).toBeUndefined()

      expect(cb.callback).toHaveBeenCalledWith('ERROR')
    })

    it('should start when init takes no callback, or returns a promise', (done) => {
      var plain = new GameEngine()
      var later = new GameEngine()
      for (var x of [plain, later]) addSpies(x, ['loadAssets', 'loadAudio', 'bootElement', '_tick'])
      for (var y of [plain, later]) {
        // The first frame runs after this spec, with the spies gone, so give it something to draw on
        y.element = { width: 1, height: 1, getContext: () => generateSpyObject(['save', 'fillRect', 'scale', 'translate', 'restore']) }
        y.loadAssets.and.callFake((f) => f())
        y.loadAudio.and.callFake((f) => f())
        y.bootElement.and.callFake((f) => f())
      }
      plain.init = function () {}
      later.init = async function () { await Promise.resolve() }
      spyOn(console, 'debug')
      plain.start(() => {
        expect(plain.running).toBe(true)
        later.start(() => {
          expect(later.running).toBe(true)
          plain.stop()
          later.stop()
          done()
        })
      })
    })
  })
})
