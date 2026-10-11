import StartScreen from '../lib/StartScreen.js'
import TenkaiLogo from '../lib/TenkaiLogo.js'

describe('StartScreen', () => {
  var context = () => {
    var c = jasmine.createSpyObj('context', ['save', 'restore', 'fillRect', 'fillText', 'drawImage', 'setTransform', 'measureText'])
    c.measureText.and.returnValue({ width: 10 })
    return c
  }
  var target = () => {
    var listeners = {}
    return {
      listeners,
      addEventListener: (type, fn) => { listeners[type] = fn },
      removeEventListener: (type) => { delete listeners[type] }
    }
  }

  it('should put the year and publisher under the title, and Tenkai\'s logo in the corner by default', () => {
    var s = new StartScreen({ title: 'WRECKERS', publisher: 'Audiogenic Software', year: 1991 })
    expect(s.subtitle).toEqual('1991  Audiogenic Software')
    expect(s.logo).toBe(TenkaiLogo)
    expect(new StartScreen({ subtitle: 'Mine', year: 1991 }).subtitle).toEqual('Mine')
    expect(new StartScreen({ logo: null }).logo).toBe(null)
  })

  it('should size everything from the shorter side', () => {
    var s = new StartScreen({ logo: { complete: true, naturalWidth: 300, naturalHeight: 200 } })
    s._logoImage = s.logo
    var wide = s.layout(1200, 600)
    var tall = s.layout(600, 1200)
    expect(wide.title.size).toEqual(50)
    expect(tall.title.size).toEqual(50)
    expect(wide.prompt.y).toBeGreaterThan(wide.title.y)
    // A seventh of 600 high, 3:2, in the bottom right corner with a 15-pixel margin
    expect(wide.logo).toEqual({ x: 1200 - 129 - 15, y: 600 - 86 - 15, width: 129, height: 86 })
  })

  it('should shrink a title too wide for the screen', () => {
    var s = new StartScreen({ title: 'A VERY LONG TITLE', logo: null })
    var c = context()
    // At 25 pixels (300 / 12) it would be 900 wide: shrunk to 90% of 400, 10 pixels
    c.measureText.and.returnValue({ width: 900 })
    var fonts = {}
    c.fillText.and.callFake((text) => { fonts[text] = c.font })
    s.draw(c, 400, 300, 0)
    expect(fonts['A VERY LONG TITLE']).toEqual('bold 10px sans-serif')
  })

  it('should draw on the game canvas when there is no page, and start on a key but not on Tab', () => {
    var c = context()
    var element = Object.assign(target(), { width: 320, height: 200, getContext: () => c })
    var win = target()
    var started = jasmine.createSpy('start')
    var s = new StartScreen({ title: 'Test', logo: null }).show({ element, window: win, onStart: started })
    expect(c.fillText).toHaveBeenCalledWith('Test', 160, jasmine.any(Number))
    expect(c.fillText).toHaveBeenCalledWith('Click or press any key to start', 160, jasmine.any(Number))
    win.listeners.keydown({ type: 'keydown', key: 'Tab' })
    expect(started).not.toHaveBeenCalled()
    win.listeners.keydown({ type: 'keydown', key: 'Enter' })
    expect(started).toHaveBeenCalled()
    expect(s.showing).toBe(false)
    expect(win.listeners.keydown).toBeUndefined()
    expect(element.listeners.pointerdown).toBeUndefined()
  })

  it('should cover the window on a page of its own, at the screen\'s density, following its size', () => {
    var c = context()
    var overlay = Object.assign(target(), { style: {}, getContext: () => c, parentNode: null })
    var body = { appendChild: (o) => { o.parentNode = body }, removeChild: jasmine.createSpy('removeChild') }
    var doc = { body, createElement: () => overlay }
    var frames = []
    var win = Object.assign(target(), {
      innerWidth: 800,
      innerHeight: 500,
      devicePixelRatio: 2,
      getComputedStyle: () => ({}),
      requestAnimationFrame: (f) => { frames.push(f); return frames.length },
      cancelAnimationFrame: () => {}
    })
    var element = Object.assign(target(), { width: 320, height: 200, getContext: () => context() })
    var started = jasmine.createSpy('start')
    new StartScreen({ title: 'Test', logo: null }).show({ element, window: win, document: doc, onStart: started })
    expect(overlay.width).toEqual(1600)
    expect(overlay.height).toEqual(1000)
    expect(overlay.style.width).toEqual('800px')
    expect(c.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
    expect(c.fillText).toHaveBeenCalledWith('Test', 400, jasmine.any(Number))
    // The window gets smaller: the next frame lays it out again
    win.innerWidth = 400
    win.innerHeight = 600
    frames.pop()(100)
    expect(overlay.width).toEqual(800)
    expect(c.fillText).toHaveBeenCalledWith('Test', 200, jasmine.any(Number))
    // A click on it starts the game and takes it away
    overlay.listeners.pointerdown({ type: 'pointerdown' })
    expect(started).toHaveBeenCalled()
    expect(body.removeChild).toHaveBeenCalledWith(overlay)
  })

  it('should cover only the game canvas when asked, where it shows in the window', () => {
    var c = context()
    var overlay = Object.assign(target(), { style: {}, getContext: () => c })
    var doc = { body: { appendChild: () => {} }, createElement: () => overlay }
    var win = Object.assign(target(), { innerWidth: 1000, innerHeight: 700, getComputedStyle: () => ({}) })
    var element = Object.assign(target(), { width: 960, height: 600, getContext: () => context(), getBoundingClientRect: () => ({ left: 20, top: 50, right: 980, bottom: 650 }) })
    new StartScreen({ fit: 'canvas', logo: null }).show({ element, window: win, document: doc })
    expect(overlay.style.left).toEqual('20px')
    expect(overlay.style.top).toEqual('50px')
    expect(overlay.width).toEqual(960)
    expect(overlay.height).toEqual(600)
  })
})
