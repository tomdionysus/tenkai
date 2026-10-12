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
    game.draw(context)
    expect(order).toEqual(['game', 'shown', 'drawn'])
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
})
