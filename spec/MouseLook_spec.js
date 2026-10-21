import MouseLook from '../lib/MouseLook.js'

describe('MouseLook', () => {
  function page () {
    const listeners = {}
    const doc = {
      pointerLockElement: null,
      hidden: false,
      hasFocus: () => true,
      addEventListener: (type, fn) => { listeners[type] = fn },
      removeEventListener: (type) => { delete listeners[type] },
      exitPointerLock: jasmine.createSpy('exitPointerLock')
    }
    const win = { addEventListener: (type, fn) => { listeners['window:' + type] = fn }, removeEventListener: () => {} }
    const canvas = { style: {}, requestPointerLock: jasmine.createSpy('requestPointerLock').and.callFake(() => { doc.pointerLockElement = canvas; listeners.pointerlockchange() }) }
    const fire = (type, e = {}) => listeners[type](Object.assign({ target: canvas, preventDefault: () => {} }, e))
    return { doc, win, canvas, fire, listeners }
  }

  it('should not turn until the game has the mouse, and take it on a click without firing', () => {
    const { doc, win, canvas, fire } = page()
    const mouse = new MouseLook({ elements: [canvas], document: doc, window: win })
    fire('mousemove', { movementX: 5, movementY: 2 })
    expect(mouse.read()).toEqual({ dx: 0, dy: 0 })
    fire('mousedown', { button: 0 })
    expect(mouse.held).toBe(true)
    expect(mouse.locked).toBe(true)
    expect(canvas.requestPointerLock).toHaveBeenCalled()
    expect(mouse.buttons.left).toBe(false)
    fire('mousemove', { movementX: 5, movementY: 2 })
    fire('mousemove', { movementX: 1, movementY: -1 })
    expect(mouse.read()).toEqual({ dx: 6, dy: 1 })
    expect(mouse.read()).toEqual({ dx: 0, dy: 0 })
    fire('mousedown', { button: 0 })
    expect(mouse.buttons.left).toBe(true)
    fire('mouseup', { button: 0 })
    expect(mouse.buttons.left).toBe(false)
  })

  it('should have the mouse from the start when told, and let it go on Escape, blur or hiding', () => {
    const { doc, win, canvas, fire, listeners } = page()
    const mouse = new MouseLook({ elements: [canvas], document: doc, window: win, held: true, sensitivity: 2 })
    fire('mousemove', { movementX: 3, movementY: 0 })
    expect(mouse.read()).toEqual({ dx: 6, dy: 0 })
    fire('keydown', { key: 'w' })
    expect(mouse.locked).toBe(true)
    fire('keydown', { key: 'Escape' })
    expect(mouse.held).toBe(false)
    expect(doc.exitPointerLock).toHaveBeenCalled()
    mouse.take()
    listeners['window:blur']()
    expect(mouse.held).toBe(false)
    mouse.take()
    doc.hidden = true
    fire('visibilitychange')
    expect(mouse.held).toBe(false)
  })

  it('should turn over the game without the pointer while the page has the focus', () => {
    const { doc, win, canvas, fire } = page()
    canvas.requestPointerLock = null
    const mouse = new MouseLook({ elements: [canvas], document: doc, window: win, held: true })
    fire('mousemove', { movementX: 4, movementY: 4 })
    expect(mouse.read()).toEqual({ dx: 4, dy: 4 })
    fire('mousemove', { movementX: 4, movementY: 4, target: {} })
    expect(mouse.read()).toEqual({ dx: 0, dy: 0 })
    doc.hasFocus = () => false
    fire('mousemove', { movementX: 4, movementY: 4 })
    expect(mouse.read()).toEqual({ dx: 0, dy: 0 })
  })

  it('should ask for the pointer on the element that is shown', () => {
    const { doc, win, canvas, fire } = page()
    const other = { style: { visibility: 'hidden' }, requestPointerLock: jasmine.createSpy('other') }
    const mouse = new MouseLook({ elements: [other, canvas], document: doc, window: win })
    fire('mousedown', { button: 0, target: other })
    expect(other.requestPointerLock).not.toHaveBeenCalled()
    expect(canvas.requestPointerLock).toHaveBeenCalled()
    expect(mouse.locked).toBe(true)
  })
})
