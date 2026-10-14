import Camera from '../lib/Camera.js'

describe('Camera', () => {
  const belt = () => new Camera({ width: 1536, height: 224, viewWidth: 320, viewHeight: 224, lead: 150, leadY: 150, speed: 2, forwardOnly: true, ease: 0.1 })

  it('should scroll forward only, so far a step, no further than the limit or the stage', () => {
    const camera = belt()
    camera.follow({ x: 400, y: 100 }, Infinity)
    expect(camera.x).toEqual(2)
    for (let i = 0; i < 200; i++) camera.follow({ x: 400, y: 100 })
    expect(camera.x).toEqual(250)
    camera.follow({ x: 100, y: 100 })
    expect(camera.x).toEqual(250)
    camera.follow({ x: 1000, y: 100 }, 251)
    expect(camera.x).toEqual(251)
    camera.snap(500)
    expect(camera.x).toEqual(500)
    for (let i = 0; i < 1000; i++) camera.follow({ x: 5000, y: 100 })
    expect(camera.x).toEqual(camera.maxX)
    expect(camera.maxX).toEqual(1536 - 320)
  })

  it('should scroll both ways when not forward only, centring the target by default', () => {
    const camera = new Camera({ width: 2000, height: 300, viewWidth: 320, viewHeight: 240 })
    camera.follow({ x: 500, y: 150 })
    expect([camera.x, camera.y]).toEqual([340, 30])
    camera.follow({ x: 100, y: 150 })
    expect(camera.x).toEqual(0)
    const slow = new Camera({ width: 2000, height: 240, viewWidth: 320, viewHeight: 240, speed: 5 })
    slow.snap(100)
    slow.follow({ x: 0, y: 0 })
    expect(slow.x).toEqual(95)
  })

  it('should ease up and down after the target on a tall stage, and not on a flat one', () => {
    const tall = new Camera({ width: 1536, height: 448, viewWidth: 320, viewHeight: 224, leadY: 150, ease: 0.1 })
    tall.follow({ x: 0, y: 350 })
    expect(tall.y).toBeCloseTo(20, 9)
    for (let i = 0; i < 200; i++) tall.follow({ x: 0, y: 350 })
    expect(tall.y).toBeCloseTo(200, 6)
    expect(tall.maxY).toEqual(224)
    const flat = belt()
    flat.follow({ x: 0, y: 350 })
    expect(flat.y).toEqual(0)
  })

  it('should say what is off screen by a margin', () => {
    const camera = belt()
    camera.snap(100)
    expect(camera.offscreen(90)).toBe(true)
    expect(camera.offscreen(90, 20)).toBe(false)
    expect(camera.offscreen(430)).toBe(true)
    expect(camera.offscreen(430, 20)).toBe(false)
    expect(camera.offscreen(410, -16)).toBe(true)
  })
})
