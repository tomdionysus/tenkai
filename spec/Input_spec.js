import Input from '../lib/Input.js'

describe('Input', () => {
  var input, listeners
  beforeEach(() => {
    listeners = {}
    var target = { addEventListener: (name, fn) => { listeners[name] = fn } }
    input = new Input({ target, bindings: { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight'], fire: ['Space'] } })
  })

  var key = (type, code, extra = {}) => {
    var e = Object.assign({ code, preventDefault: jasmine.createSpy('preventDefault') }, extra)
    listeners[type](e)
    return e
  }

  it('should report held actions from any of their keys', () => {
    key('keydown', 'KeyA')
    input.beginStep()
    expect(input.down('left')).toBe(true)
    key('keyup', 'KeyA')
    input.beginStep()
    expect(input.down('left')).toBe(false)
  })

  it('should prevent the default action of bound keys only', () => {
    expect(key('keydown', 'Space').preventDefault).toHaveBeenCalled()
    expect(key('keydown', 'KeyQ').preventDefault).not.toHaveBeenCalled()
  })

  it('should report presses and releases for one step', () => {
    key('keydown', 'Space')
    input.beginStep()
    expect(input.pressed('fire')).toBe(true)
    input.beginStep()
    expect(input.pressed('fire')).toBe(false)
    expect(input.down('fire')).toBe(true)
    key('keyup', 'Space')
    input.beginStep()
    expect(input.released('fire')).toBe(true)
  })

  it('should not count key repeat as a press', () => {
    key('keydown', 'Space')
    input.beginStep()
    key('keydown', 'Space', { repeat: true })
    input.beginStep()
    expect(input.pressed('fire')).toBe(false)
  })

  it('should catch a tap that starts and ends between steps', () => {
    key('keydown', 'Space')
    key('keyup', 'Space')
    input.beginStep()
    expect(input.pressed('fire')).toBe(true)
    expect(input.released('fire')).toBe(true)
    expect(input.down('fire')).toBe(false)
  })

  it('should answer for unbound keys by code', () => {
    key('keydown', 'KeyQ')
    input.beginStep()
    expect(input.down('KeyQ')).toBe(true)
  })

  it('should give the most recently pressed of several held actions', () => {
    key('keydown', 'ArrowLeft')
    key('keydown', 'ArrowRight')
    expect(input.latest('left', 'right')).toEqual('right')
    key('keyup', 'ArrowRight')
    expect(input.latest('left', 'right')).toEqual('left')
    key('keyup', 'ArrowLeft')
    expect(input.latest('left', 'right')).toBeNull()
  })

  it('should give an axis from opposing actions', () => {
    key('keydown', 'ArrowRight')
    expect(input.axis('left', 'right')).toEqual(1)
    key('keydown', 'ArrowLeft')
    expect(input.axis('left', 'right')).toEqual(0)
  })

  it('should detect a double tap within the window', () => {
    key('keydown', 'ArrowRight')
    key('keyup', 'ArrowRight')
    input.beginStep()
    expect(input.doubleTapped('right')).toBe(false)
    for (var i = 0; i < 5; i++) input.beginStep()
    key('keydown', 'ArrowRight')
    input.beginStep()
    expect(input.doubleTapped('right')).toBe(true)
  })

  it('should not count presses too far apart as a double tap', () => {
    key('keydown', 'ArrowRight')
    key('keyup', 'ArrowRight')
    input.beginStep()
    for (var i = 0; i < 20; i++) input.beginStep()
    key('keydown', 'ArrowRight')
    input.beginStep()
    expect(input.doubleTapped('right')).toBe(false)
  })

  it('should release everything when the window loses focus', () => {
    key('keydown', 'ArrowRight')
    listeners.blur()
    input.beginStep()
    expect(input.down('right')).toBe(false)
    expect(input.released('right')).toBe(true)
  })

  it('should take input fed by hand', () => {
    input.keyDown({ code: 'Space' })
    input.beginStep()
    expect(input.pressed('fire')).toBe(true)
  })
})
