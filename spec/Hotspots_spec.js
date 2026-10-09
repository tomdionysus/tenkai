const Hotspots = require('../lib/Hotspots')

describe('Hotspots', () => {
  var spots
  beforeEach(() => { spots = new Hotspots() })

  it('should find a hotspot by rectangle, right and bottom exclusive', () => {
    var a = spots.add({ rect: [10, 10, 20, 20] })
    expect(spots.at(10, 10)).toBe(a)
    expect(spots.at(19, 19)).toBe(a)
    expect(spots.at(20, 15)).toBeNull()
  })

  it('should find a hotspot by circle or custom test', () => {
    var c = spots.add({ circle: [100, 100, 10] })
    var custom = spots.add({ contains: (x, y) => x > 500 })
    expect(spots.at(105, 105)).toBe(c)
    expect(spots.at(600, 0)).toBe(custom)
  })

  it('should prefer earlier hotspots and skip disabled ones', () => {
    var first = spots.add({ rect: [0, 0, 50, 50], enabled: false })
    var second = spots.add({ rect: [0, 0, 50, 50] })
    expect(spots.at(5, 5)).toBe(second)
    first.enabled = () => true
    expect(spots.at(5, 5)).toBe(first)
  })

  it('should give the hotspot cursor or the default', () => {
    spots.add({ rect: [0, 0, 50, 50], cursor: 'hand' })
    spots.add({ rect: [50, 0, 100, 50], cursor: () => 'look' })
    expect(spots.cursorAt(5, 5, 'arrow')).toEqual('hand')
    expect(spots.cursorAt(60, 5, 'arrow')).toEqual('look')
    expect(spots.cursorAt(500, 500, 'arrow')).toEqual('arrow')
  })

  it('should click when released over the pressed hotspot', () => {
    var onClick = jasmine.createSpy('onClick')
    var spot = spots.add({ rect: [0, 0, 50, 50], onClick })
    spots.mouseDown(5, 5)
    spots.mouseUp(6, 6)
    expect(onClick).toHaveBeenCalledWith(spot, 6, 6)
  })

  it('should not click when released elsewhere', () => {
    var onClick = jasmine.createSpy('onClick')
    spots.add({ rect: [0, 0, 50, 50], onClick })
    spots.mouseDown(5, 5)
    spots.mouseUp(200, 200)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('should send press, drag and release to the pressed hotspot', () => {
    var onDown = jasmine.createSpy('onDown')
    var onDrag = jasmine.createSpy('onDrag')
    var onUp = jasmine.createSpy('onUp')
    var spot = spots.add({ rect: [0, 0, 50, 50], onDown, onDrag, onUp })
    spots.mouseDown(5, 5)
    spots.mouseMove(80, 90)
    spots.mouseUp(100, 100)
    expect(onDown).toHaveBeenCalledWith(spot, 5, 5)
    expect(onDrag).toHaveBeenCalledWith(spot, 80, 90)
    expect(onUp).toHaveBeenCalledWith(spot, 100, 100)
  })

  it('should keep the pressed hotspot cursor while dragging', () => {
    spots.add({ rect: [0, 0, 50, 50], cursor: 'grab' })
    spots.mouseDown(5, 5)
    expect(spots.cursorAt(300, 300, 'arrow')).toEqual('grab')
  })

  it('should bind to a game engine mouse events', () => {
    var handlers = {}
    var engine = { mouseX: 5, mouseY: 5, on: (event, fn) => { handlers[event] = fn } }
    var onClick = jasmine.createSpy('onClick')
    spots.add({ rect: [0, 0, 50, 50], onClick })
    spots.bind(engine)
    handlers.mousedown()
    handlers.mousemove()
    handlers.mouseup()
    expect(onClick).toHaveBeenCalled()
  })

  it('should clear all hotspots', () => {
    spots.add({ rect: [0, 0, 50, 50] })
    spots.clear()
    expect(spots.at(5, 5)).toBeNull()
  })
})
