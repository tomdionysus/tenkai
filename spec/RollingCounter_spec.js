import RollingCounter from '../lib/RollingCounter.js'

describe('RollingCounter', () => {
  it('should show its first target at once, then run toward the next by a share of the difference', () => {
    var c = new RollingCounter()
    c.step(100)
    expect(c.shown).toBe(100)
    c.step(200)
    // a quarter of 100 is 25 parts: 3 whole and 1 part over
    expect([c.shown, c.offset]).toEqual([103, 1])
    for (var i = 0; i < 200; i++) c.step(200)
    expect([c.shown, c.offset]).toEqual([200, 0])
  })

  it('should take at most `most` parts a step, and never roll below nothing', () => {
    var c = new RollingCounter({ most: 16 })
    c.step(0)
    c.step(10000)
    expect(c.shown).toBe(2)
    var d = new RollingCounter()
    d.step(0)
    d.step(-50)
    expect([d.shown, d.offset]).toEqual([0, 0])
  })

  it('should say which digits roll, up to the next number or down from the one below', () => {
    var c = new RollingCounter()
    c.step(19)
    c.offset = 3
    expect(c.digits(3)).toEqual([{ from: ' ', to: ' ', rolling: false }, { from: '1', to: '2', rolling: true }, { from: '9', to: '0', rolling: true }])
    c.offset = -3
    expect(c.digits(2).map((d) => d.from + d.to)).toEqual(['11', '89'])
  })
})
