import Palette from '../lib/Palette.js'

describe('Palette', () => {
  var ramp = () => new Palette({ size: 8, colors: [0, 0, 0, 10, 10, 10, 20, 20, 20, 30, 30, 30, 40, 40, 40, 50, 50, 50, 60, 60, 60, 70, 70, 70] })

  it('should default to 256 black entries', () => {
    var p = new Palette()
    expect(p.size).toEqual(256)
    expect(p.colors.length).toEqual(768)
    expect(p.get(5)).toEqual([0, 0, 0])
  })

  it('should set, get and load entries', () => {
    var p = new Palette({ size: 4 })
    p.set(1, 1, 2, 3)
    expect(p.get(1)).toEqual([1, 2, 3])
    p.load([9, 9, 9, 8, 8, 8, 7, 7, 7, 6, 6, 6], 2, 3)
    expect(Array.from(p.colors)).toEqual([0, 0, 0, 1, 2, 3, 7, 7, 7, 6, 6, 6])
  })

  it('should rotate a range forward and back', () => {
    var p = ramp()
    p.rotate(2, 4)
    expect([p.get(2)[0], p.get(3)[0], p.get(4)[0]]).toEqual([40, 20, 30])
    p.rotate(2, 4, false)
    expect([p.get(2)[0], p.get(3)[0], p.get(4)[0]]).toEqual([20, 30, 40])
  })

  it('should scale a range from a source, capped', () => {
    var p = new Palette({ size: 2 })
    p.scale([200, 100, 50, 255, 255, 255], 0, 1, 128, 255, 0, 252)
    expect(Array.from(p.colors)).toEqual([100, 100, 0, 128, 252, 0])
  })

  it('should find the nearest entry, at a lower precision if asked', () => {
    var p = ramp()
    expect(p.nearest(33, 33, 33)).toEqual(3)
    expect(p.nearest(33, 33, 33, 5, 7)).toEqual(5)
    // At 6 bits, 40 is 10 and 50 is 12
    expect(p.nearest(11, 11, 11, 0, 7, 6)).toEqual(4)
  })

  it('should run colour cycles by their delays', () => {
    var p = ramp()
    var rotated = []
    var c = p.addCycle({ start: 1, end: 3, delay: 3 })
    p.addCycle({ start: 5, end: 6, delay: 0 })
    p.advanceCycles(2, (cycle) => rotated.push(cycle))
    expect(p.get(1)[0]).toEqual(10)
    p.advanceCycles(2, (cycle) => rotated.push(cycle))
    expect([p.get(1)[0], p.get(2)[0], p.get(3)[0]]).toEqual([30, 10, 20])
    expect(rotated).toEqual([c])
    expect(c.counter).toEqual(1)
    expect(p.get(5)[0]).toEqual(50)
    c.reverse = true
    p.advanceCycles(3)
    expect([p.get(1)[0], p.get(2)[0], p.get(3)[0]]).toEqual([10, 20, 30])
    p.clearCycles()
    expect(p.cycles).toEqual([])
  })

  it('should keep a remapping table pointing at the same colours after a rotation', () => {
    var table = [0, 1, 2, 3, 3, 4]
    Palette.rotateRemap(table, 1, 3, true)
    // Entries pointing into 1..3 move one place; the table's own entries 1..3 rotate
    expect(table).toEqual([0, 1, 2, 3, 1, 4])
  })
})
