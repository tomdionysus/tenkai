import Shake from '../lib/Shake.js'

describe('Shake', () => {
  it('should be still until started, then give the pattern a step at a time, then be still again', () => {
    var s = new Shake({ pattern: [[0, 0], [0, -1], [2, 1]] })
    expect([s.active, s.x, s.y]).toEqual([false, 0, 0])
    s.start()
    var seen = []
    while (s.active) {
      seen.push([s.x, s.y])
      s.step()
    }
    expect(seen).toEqual([[0, 0], [0, -1], [2, 1]])
    expect([s.x, s.y]).toEqual([0, 0])
  })

  it('should begin again from the start when started while shaking', () => {
    var s = new Shake({ pattern: [[0, 1], [0, 2], [0, 3]] })
    s.start()
    s.step()
    s.step()
    expect(s.y).toBe(3)
    s.start()
    expect(s.y).toBe(1)
  })

  it('should do nothing when stepped while still, or given no pattern', () => {
    var s = new Shake()
    s.step()
    expect(s.active).toBe(false)
    var empty = new Shake({ pattern: [] })
    empty.start()
    expect([empty.active, empty.y]).toEqual([false, 0])
  })
})
