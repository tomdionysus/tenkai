import Dissolve from '../lib/Dissolve.js'
import IndexedSurface from '../lib/IndexedSurface.js'

describe('Dissolve', () => {
  const surfaces = () => {
    const from = new IndexedSurface({ width: 6, height: 5 })
    from.fill(0, 0, 6, 5, 7)
    from.set(2, 2, 0)
    const to = new IndexedSurface({ width: 6, height: 5 })
    to.fill(0, 0, 6, 5, 3)
    return { from, to }
  }
  const count = (s, colour) => Array.from(s.pixels).filter((p) => p === colour).length

  it('should copy one pixel in every column of the rectangle a step, and all of it after a step a row', () => {
    const { from, to } = surfaces()
    const d = new Dissolve({ x: 1, y: 1, width: 4, height: 3 })
    expect(d.step(from, to)).toBe(false)
    expect(count(to, 7) + count(to, 0)).toBe(4)
    d.step(from, to, 2)
    expect(d.done).toBe(true)
    // The rectangle copied (its colour 0 too), the rest untouched
    expect(count(to, 7) + count(to, 0)).toBe(12)
    expect(to.get(2, 2)).toBe(0)
    expect(to.get(0, 0)).toBe(3)
    expect(to.get(5, 4)).toBe(3)
  })

  it('should leave colour 0 alone when told, and finish at once', () => {
    const { from, to } = surfaces()
    const d = new Dissolve({ x: 0, y: 0, width: 6, height: 5, skipZero: true })
    expect(d.finish(from, to)).toBe(true)
    expect(count(to, 7)).toBe(29)
    expect(to.get(2, 2)).toBe(3)
  })

  it('should shuffle with the random given', () => {
    expect(Dissolve.shuffled(4, () => 0)).toEqual([3, 0, 1, 2])
  })
})
