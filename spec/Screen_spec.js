import GameEngine from '../lib/GameEngine.js'
import Screen from '../lib/Screen.js'
import Hotspots from '../lib/Hotspots.js'

describe('Screen', () => {
  // An engine whose canvas element records its listeners, so a click can be sent to it
  function engine () {
    const game = new GameEngine({ enableScroll: false, enableZoom: false })
    const listeners = {}
    game.element = { addEventListener: (name, fn) => { listeners[name] = fn } }
    game._bindMouseWheel()
    game.click = (x, y) => listeners.mousedown({ x, y })
    game.move = (x, y) => listeners.mousemove({ x, y, preventDefault () {}, stopPropagation () {} })
    game.release = (x, y) => listeners.mouseup({ x, y })
    return game
  }

  it('should take options for its click and update, and do nothing by default', () => {
    const plain = new Screen()
    expect(plain.click(1, 2)).toBe(false)
    expect(() => plain.update(0.1, null)).not.toThrow()
    const s = new Screen({ click: () => true, update: jasmine.createSpy('update') })
    expect(s.click(1, 2)).toBe(true)
    s.update(0.1, 'input')
    expect(s.update).toHaveBeenCalledWith(0.1, 'input')
  })

  it('should let a screen\'s click ask which button was pressed', () => {
    const game = new GameEngine({ enableScroll: false, enableZoom: false })
    const listeners = {}
    game.element = { addEventListener: (name, fn) => { listeners[name] = fn } }
    game._bindMouseWheel()
    const pressed = []
    game.showScreen(new Screen({ click: () => { pressed.push(game.mouseButton); return true } }))
    listeners.mousedown({ x: 1, y: 1, button: 2 })
    listeners.mousedown({ x: 1, y: 1 })
    expect(pressed).toEqual([2, 0])
  })

  it('should be shown on top, moved to the top when shown again, and hidden', () => {
    const game = engine()
    const a = new Screen()
    const b = new Screen()
    expect(game.topScreen).toBeNull()
    game.showScreen(a)
    game.showScreen(b)
    expect(game.screenStack).toEqual([a, b])
    expect(game.topScreen).toBe(b)
    expect(a.parent).toBe(game)
    game.showScreen(a)
    expect(game.screenStack).toEqual([b, a])
    game.hideScreen(a)
    game.hideScreen(a)
    expect(game.screenStack).toEqual([b])
  })

  it('should give a click to the top visible screen first, and to the game only if the screen does not take it', () => {
    const game = engine()
    const seen = []
    // (the engine's events are delivered later: its trigger is watched instead)
    spyOn(game, 'trigger').and.callFake((name) => { if (name === 'mousedown') seen.push('game') })
    const below = new Screen({ click: () => { seen.push('below'); return true } })
    const top = new Screen({ click: (x, y) => { seen.push('top ' + x + ',' + y); return x > 10 } })
    game.showScreen(below)
    game.showScreen(top)
    game.click(20, 5)
    game.click(5, 5)
    expect(seen).toEqual(['top 20,5', 'top 5,5', 'game'])
    // A hidden screen is passed over
    top.visible = false
    game.click(5, 5)
    expect(seen.slice(3)).toEqual(['below'])
  })

  it('should step the visible screens after the game, and draw them over it', () => {
    const game = engine()
    const order = []
    game.update = () => order.push('game')
    const shown = new Screen({ update: () => order.push('shown'), background: () => order.push('drawn') })
    const hidden = new Screen({ update: () => order.push('hidden'), background: () => order.push('hidden drawn') })
    hidden.visible = false
    game.showScreen(shown)
    game.showScreen(hidden)
    game.step(0.05)
    expect(order).toEqual(['game', 'shown'])
    game.element.width = 10
    game.element.height = 10
    const context = jasmine.createSpyObj('context', ['save', 'restore', 'scale', 'translate', 'fillRect'])
    game.drawOver = () => order.push('over')
    game.showScreen(new Screen({ under: true, background: () => order.push('under') }))
    game.draw(context)
    expect(order).toEqual(['game', 'shown', 'under', 'over', 'drawn'])
  })

  it('should give its clicks to its hotspots by default, in their groups', () => {
    const seen = []
    const hotspots = new Hotspots()
    hotspots.add({ rect: [0, 0, 10, 10], group: 'menu', onClick: (spot, x, y) => seen.push('menu ' + x + ',' + y) })
    hotspots.add({ rect: [0, 0, 10, 10], group: 'dialogue', onClick: () => seen.push('dialogue') })
    hotspots.add({ rect: [20, 0, 30, 10] })
    const screen = new Screen({ hotspots })
    expect(screen.click(5, 5)).toBe(true)
    hotspots.setGroup('menu', false)
    expect(hotspots.groupOn('menu')).toBe(false)
    expect(screen.click(5, 6)).toBe(true)
    hotspots.setGroup('dialogue', false)
    expect(screen.click(5, 7)).toBe(false)
    // A hotspot without a handler still takes the click
    expect(screen.click(25, 5)).toBe(true)
    hotspots.setGroup('menu', true)
    expect(screen.click(1, 1)).toBe(true)
    expect(seen).toEqual(['menu 5,5', 'dialogue', 'menu 1,1'])
  })

  it('should take clicks in its own coordinates, centred, and take every click when modal', () => {
    const seen = []
    const hotspots = new Hotspots()
    hotspots.add({ rect: [0, 0, 10, 10], onClick: (spot, x, y) => seen.push(x + ',' + y) })
    const screen = new Screen({ hotspots, width: 100, height: 50 })
    screen.centre(320, 200)
    expect([screen.x, screen.y]).toEqual([110, 75])
    expect(screen.click(115.5, 77)).toBe(true)
    expect(screen.click(5, 5)).toBe(false)
    screen.modal = true
    expect(screen.click(5, 5)).toBe(true)
    expect(seen).toEqual(['5,2'])
  })

  it('should know where the pointer is in its own coordinates, from when it is shown and as it moves', () => {
    const game = engine()
    const screen = new Screen({ x: 10, y: 20 })
    expect(screen.pointer).toEqual({ x: 0, y: 0 })
    game.mouseX = 15
    game.mouseY = 25
    game.showScreen(screen)
    expect(screen.pointer).toEqual({ x: 5, y: 5 })
    game.move(30, 40)
    expect(screen.pointer).toEqual({ x: 20, y: 20 })
  })

  it('should press, drag and release its buttons, the engine passing it the moves and releases', () => {
    const game = engine()
    const seen = []
    const hotspots = new Hotspots()
    hotspots.add({ rect: [0, 0, 10, 10], onDrag: (s, x, y) => seen.push('drag ' + x), onClick: () => seen.push('click') })
    const screen = new Screen({ hotspots, release: true, x: 10 })
    game.showScreen(screen)
    game.click(12, 5)
    expect(seen).toEqual([])
    game.move(14, 5)
    game.release(15, 5)
    expect(seen).toEqual(['drag 4', 'click'])
    // Released off the button: no click; let go: nothing pressed
    game.click(12, 5)
    game.release(40, 5)
    game.click(12, 5)
    screen.letGo()
    game.release(12, 5)
    expect(seen).toEqual(['drag 4', 'click'])
  })

  it('should show while shown() says so, visible then following it', () => {
    let open = false
    const s = new Screen({ shown: () => open })
    expect(s.visible).toBe(false)
    open = true
    expect(s.visible).toBe(true)
    s.visible = false
    expect(s.visible).toBe(true)
    const plain = new Screen({ visible: false })
    expect(plain.visible).toBe(false)
    plain.visible = true
    expect(plain.visible).toBe(true)
  })

  it('should let a click fall through to the game where through() says', () => {
    const game = engine()
    const seen = []
    spyOn(game, 'trigger').and.callFake((name) => { if (name === 'mousedown') seen.push('game') })
    const screen = new Screen({ through: (x, y) => y > 100, click: () => { seen.push('screen'); return true } })
    game.showScreen(screen)
    expect(screen.covers(10, 50)).toBe(true)
    expect(screen.covers(10, 150)).toBe(false)
    game.click(10, 50)
    game.click(10, 150)
    expect(seen).toEqual(['screen', 'game'])
  })
})
