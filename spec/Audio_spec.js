const Audio = require('../lib/Audio')

describe('Audio', () => {
  it('should allow New', () => {
    var x1 = new Audio()
    var x2 = new Audio()

    expect(x1).not.toBe(x2)
  })

  describe('load', () => {
    it('should call createElement and appendChild and set options', () => {
      var ele = { appendChild: () => {} }

      spyOn(document, 'createElement').and.returnValue(ele)
      spyOn(ele, 'appendChild')
      var x1 = new Audio({
        src: 'SOURCE',
        type: 'TYPE',
        startTime: 'STARTTIME',
        endTime: 'ENDTIME',
        loop: true
      })

      x1.load()

      expect(document.createElement).toHaveBeenCalledWith('audio')
      expect(ele.appendChild).toHaveBeenCalledWith(ele)

      expect(x1.element).toBe(ele)

      expect(ele.src).toEqual('SOURCE')
      expect(ele.type).toEqual('TYPE')

      expect(x1.startTime).toEqual('STARTTIME')
      expect(x1.endTime).toEqual('ENDTIME')
      expect(x1.loop).toBeTruthy()
    })
  })

  describe('play', () => {
    it('should call play on element', () => {
      var ele = { play: () => {} }
      spyOn(ele, 'play')

      var x1 = new Audio()
      x1.element = ele
      x1.play()

      expect(ele.play).toHaveBeenCalledWith()
    })
  })

  describe('playRange', () => {
    it('should set properties and call play on element', () => {
      var ele = { play: () => {} }
      spyOn(ele, 'play')

      var x1 = new Audio()
      x1.element = ele
      x1.playRange('STARTTIME', 'ENDTIME', false)

      expect(ele.play).toHaveBeenCalledWith()
      expect(x1.startTime).toEqual('STARTTIME')
      expect(x1.endTime).toEqual('ENDTIME')
      expect(x1.loop).toBeFalsy()
    })

    it('should use existing properties call play on element', () => {
      var ele = { play: () => {} }
      spyOn(ele, 'play')

      var x1 = new Audio()
      x1.element = ele
      x1.playRange(null, null, true)

      expect(ele.play).toHaveBeenCalledWith()
      expect(x1.startTime).toBeUndefined()
      expect(x1.endTime).toBeUndefined()
      expect(x1.loop).toBeTruthy()
    })

    it('should call play on element when called with defaults', () => {
      var ele = { play: () => {} }
      spyOn(ele, 'play')

      var x1 = new Audio()
      x1.element = ele
      x1.playRange()

      expect(ele.play).toHaveBeenCalledWith()
    })
  })

  describe('pause', () => {
    it('should call pause on element', () => {
      var ele = { pause: () => {} }
      spyOn(ele, 'pause')

      var x1 = new Audio()
      x1.element = ele
      x1.pause()

      expect(ele.pause).toHaveBeenCalledWith()
    })
  })

  describe('stop', () => {
    it('should reset oncanplaythrough and currentTime and call pause on element', () => {
      var ele = { pause: () => {} }
      spyOn(ele, 'pause')

      var x1 = new Audio()
      x1.element = ele
      x1.stop()

      expect(ele.pause).toHaveBeenCalledWith()
      expect(ele.oncanplaythrough).toBeNull()
      expect(ele.currentTime).toEqual('0')
    })
  })

  describe('fadeIn', () => {
    it('should set volume and call play on element, then call _fade', () => {
      var ele = { play: () => {} }
      spyOn(ele, 'play')

      var x1 = new Audio()
      x1.element = ele
      spyOn(x1, '_fade').and.callFake(function (v, d, c) { c() })

      x1.fadeIn()

      expect(ele.play).toHaveBeenCalledWith()
      expect(ele.volume).toEqual(0)

      expect(x1._fade).toHaveBeenCalledWith(1, 1000, jasmine.any(Function))
    })

    it('should call supplied callback ', () => {
      var ele = { play: () => {} }
      var x1 = new Audio()
      x1.element = ele

      var cb = { cb: () => {} }
      spyOn(cb, 'cb')

      spyOn(x1, '_fade').and.callFake(function (v, d, c) { c() })

      x1.fadeIn(200, cb.cb)

      expect(cb.cb).toHaveBeenCalledWith(null, x1)
    })
  })

  describe('fadeOut', () => {
    it('should set volume and call play on element, then call _fade', () => {
      var x1 = new Audio()
      spyOn(x1, '_fade')

      x1.fadeOut()

      expect(x1._fade).toHaveBeenCalledWith(0, 1000, jasmine.any(Function))
    })

    it('should call _fade and pause', () => {
      var x1 = new Audio()
      spyOn(x1, '_fade').and.callFake(function (v, d, c) { c() })
      spyOn(x1, 'pause')

      x1.fadeOut()

      expect(x1._fade).toHaveBeenCalledWith(0, 1000, jasmine.any(Function))
      expect(x1.pause).toHaveBeenCalledWith()
    })

    it('should call _fade and pause and callback', () => {
      var x1 = new Audio()
      spyOn(x1, '_fade').and.callFake(function (v, d, c) { c() })
      spyOn(x1, 'pause')

      var cb = { cb: () => {} }
      spyOn(cb, 'cb')

      x1.fadeOut(500, cb.cb)

      expect(x1._fade).toHaveBeenCalledWith(0, 500, jasmine.any(Function))
      expect(x1.pause).toHaveBeenCalledWith()
    })
  })

  describe('_fade', () => {
    it('should call setTimeout with fn', () => {
      var callback = { cb: () => {} }; var fn
      var ele = { pause: () => {}, duration: 3 }
      spyOn(callback, 'cb')
      spyOn(global, 'setTimeout').and.callFake((f) => { fn = f })

      var x1 = new Audio()
      x1.element = ele

      x1._fade(1, 1000, callback.cb)
      expect(global.setTimeout).toHaveBeenCalledWith(jasmine.any(Function), 10)

      fn()
    })

    it('should call clearTimeout if _fadeTimeout is already set', () => {
      var callback = { cb: () => {} }; var fn
      var ele = { pause: () => {}, duration: 3 }
      spyOn(callback, 'cb')
      spyOn(global, 'clearTimeout')

      var x1 = new Audio(); var ftf = () => {}
      x1._fadeTimeout = ftf
      x1.element = ele

      x1._fade(1, 1000, callback.cb)
      expect(global.clearTimeout).toHaveBeenCalledWith(ftf)
    })

    it('should call callback if value is reached by increasing', () => {
      var callback = { cb: () => {} }; var fn
      var ele = { pause: () => {}, duration: 3, volume: 1 }
      spyOn(callback, 'cb')
      spyOn(global, 'setTimeout').and.callFake((f) => { fn = f })

      var x1 = new Audio()
      x1.element = ele

      x1._fade(2, 1000, callback.cb)

      ele.volume = 2
      fn()

      expect(callback.cb).toHaveBeenCalled()
    })

    it('should call callback if value is reached by deceasing', () => {
      var callback = { cb: () => {} }; var fn
      var ele = { pause: () => {}, duration: 3, volume: 2 }
      spyOn(callback, 'cb')
      spyOn(global, 'setTimeout').and.callFake((f) => { fn = f })

      var x1 = new Audio()
      x1.element = ele

      x1._fade(1, 1000, callback.cb)

      ele.volume = 1
      fn()

      expect(callback.cb).toHaveBeenCalled()
    })

    it('should not call callback if value is reached and callback is undefined', () => {
      var ele = { pause: () => {}, duration: 3, volume: 2 }
      spyOn(global, 'setTimeout').and.callFake((f) => { fn = f })

      var x1 = new Audio()
      x1.element = ele

      x1._fade(1, 1000, null)

      ele.volume = 1
      fn()

      expect(x1._fadeTimeout).toBeUndefined()
    })
  })

  describe('_oncanplaythrough', () => {
    it('should call function in _callonloaded', () => {
      var callback = { cb: () => {} }
      spyOn(callback, 'cb')

      var x1 = new Audio()

      x1._callonloaded = callback.cb

      x1._oncanplaythrough()

      expect(callback.cb).toHaveBeenCalledWith()
    })

    it('should not fail if _callonloaded not set', () => {
      var callback = { cb: () => {} }

      var x1 = new Audio()

      expect(() => { x1._oncanplaythrough() }).not.toThrow()
    })
  })

  describe('_onloadedmetadata', () => {
    it('should set duration from element', () => {
      var ele = { pause: () => {}, duration: 3 }

      var x1 = new Audio()
      x1.element = ele
      x1.endTime = 2000

      x1._onloadedmetadata()

      expect(x1.duration).toEqual(3000)
      expect(x1.endTime).toEqual(2000)
    })

    it('should set duration and endTime from element if endTime not set', () => {
      var ele = { pause: () => {}, duration: 3 }

      var x1 = new Audio()
      x1.element = ele

      x1._onloadedmetadata()

      expect(x1.duration).toEqual(3000)
      expect(x1.endTime).toEqual(3000)
    })
  })

  describe('_ontimeupdate', () => {
    it('should call pause if element currentTime is greater than endTime and not looped', () => {
      var ele = { pause: () => {}, currentTime: 3 }
      spyOn(ele, 'pause')

      var x1 = new Audio()
      x1.element = ele
      x1.endTime = 3000

      x1._ontimeupdate()

      expect(ele.pause).toHaveBeenCalledWith()
    })

    it('should not call pause and reset currentTime if element currentTime is greater than endTime and loop', () => {
      var ele = { pause: () => {}, currentTime: 3 }
      spyOn(ele, 'pause')

      var x1 = new Audio()
      x1.element = ele
      x1.startTime = 1500
      x1.endTime = 3000
      x1.loop = true

      x1._ontimeupdate()

      expect(ele.pause).not.toHaveBeenCalledWith()
      expect(ele.currentTime).toEqual(1.5)
    })

    it('should do nothing if currentTime is not greater than endTime and loop', () => {
      var ele = { pause: () => {}, currentTime: 2 }
      spyOn(ele, 'pause')

      var x1 = new Audio()
      x1.element = ele
      x1.startTime = 1500
      x1.endTime = 3000
      x1.loop = true

      x1._ontimeupdate()

      expect(ele.pause).not.toHaveBeenCalledWith()
      expect(ele.currentTime).toEqual(2)
    })
  })
})
