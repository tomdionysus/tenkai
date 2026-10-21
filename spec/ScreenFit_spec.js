import ScreenFit from '../lib/ScreenFit.js'

describe('ScreenFit', () => {
  it('should fit a 320x200 screen with 1.2 pixels into a 16:9 window, at the bottom', () => {
    const f = ScreenFit.fit({ width: 320, height: 200 }, { width: 1920, height: 1080 }, { pixelAspect: 1.2, align: 'bottom' })
    expect(f.scaleX).toBeCloseTo(4.5)
    expect(f.scaleY).toBeCloseTo(5.4)
    expect(f.width).toBeCloseTo(1440)
    expect(f.height).toBeCloseTo(1080)
    expect(f.x).toBeCloseTo(240)
    expect(f.y).toBeCloseTo(0)
  })

  it('should centre by default and put the screen at the top when asked', () => {
    const middle = ScreenFit.fit({ width: 320, height: 200 }, { width: 640, height: 600 })
    expect(middle.scale).toEqual(2)
    expect(middle).toEqual(jasmine.objectContaining({ x: 0, y: 100, width: 640, height: 400 }))
    expect(ScreenFit.fit({ width: 320, height: 200 }, { width: 640, height: 600 }, { align: 'top' }).y).toEqual(0)
  })

  it('should keep to whole scales when asked, never under 1', () => {
    const f = ScreenFit.fit({ width: 320, height: 200 }, { width: 900, height: 700 }, { integer: true })
    expect(f.scale).toEqual(2)
    expect(f.x).toEqual(130)
    expect(ScreenFit.fit({ width: 320, height: 200 }, { width: 100, height: 100 }, { integer: true }).scale).toEqual(1)
  })
})
