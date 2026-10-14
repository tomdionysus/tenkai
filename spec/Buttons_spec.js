import Buttons from '../lib/Buttons.js'
import Hotspots from '../lib/Hotspots.js'

describe('Buttons', () => {
  it('should act at the press on the button shown, draw each in order, and be replaced by the next set', () => {
    const hotspots = new Hotspots()
    const paint = jasmine.createSpy('paint')
    const buttons = new Buttons({ hotspots, paint })
    const act = jasmine.createSpy('act')
    const list = [{ text: 'Go', x: 10, y: 10, width: 50, height: 15, act }, { text: 'No', x: 10, y: 30, width: 50, height: 15, act: null }]
    buttons.show(list)
    hotspots.mouseDown(20, 20)
    expect(act).toHaveBeenCalled()
    hotspots.mouseUp(20, 20)
    hotspots.mouseDown(20, 35)
    hotspots.mouseUp(20, 35)
    expect(act).toHaveBeenCalledTimes(1)
    buttons.draw('frame')
    expect(paint.calls.allArgs()).toEqual([['frame', list[0]], ['frame', list[1]]])
    buttons.show([])
    expect(hotspots.at(20, 20)).toBeNull()
  })

  it('should act at the release over the pressed button with release', () => {
    const hotspots = new Hotspots()
    const buttons = new Buttons({ hotspots, release: true })
    const act = jasmine.createSpy('act')
    buttons.show([{ x: 0, y: 0, width: 10, height: 10, act }])
    hotspots.mouseDown(5, 5)
    expect(act).not.toHaveBeenCalled()
    hotspots.mouseUp(50, 50)
    expect(act).not.toHaveBeenCalled()
    hotspots.mouseDown(5, 5)
    hotspots.mouseUp(6, 6)
    expect(act).toHaveBeenCalledTimes(1)
    expect(() => buttons.draw('frame')).not.toThrow()
  })
})
