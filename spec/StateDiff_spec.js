import StateDiff from '../lib/StateDiff.js'

describe('StateDiff', () => {
  const roundTrip = (a, b) => {
    const patch = StateDiff.diff(a, b)
    const sent = patch === undefined ? undefined : JSON.parse(JSON.stringify(patch))
    return StateDiff.apply(a, sent)
  }

  it('should give no patch for equal states', () => {
    expect(StateDiff.diff({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBeUndefined()
  })

  it('should turn one state into another through JSON', () => {
    const cases = [
      [{ x: 1 }, { x: 2 }],
      [{ x: 1, y: 2 }, { x: 1 }],
      [{ x: 1 }, { x: 1, y: { z: [1, 2] } }],
      [[1, 2, 3], [1, 5]],
      [[1], [1, 2, { a: null }]],
      [{ a: [1, 2] }, { a: { 0: 1 } }],
      [{ a: null }, { a: { b: 1 } }],
      [5, 'five'],
      [{ deep: { deeper: { n: 1, keep: 'k' } } }, { deep: { deeper: { n: 2, keep: 'k' } } }]
    ]
    for (const [a, b] of cases) expect(roundTrip(a, b)).toEqual(b)
  })

  it('should send only what changed', () => {
    const a = { big: new Array(100).fill(7), n: 1 }
    const b = { big: new Array(100).fill(7), n: 2 }
    expect(StateDiff.diff(a, b)).toEqual({ __patch: { n: { __value: 2 } } })
  })

  it('should not change the state it is given', () => {
    const a = { list: [1, 2], o: { k: 1 } }
    const copy = JSON.parse(JSON.stringify(a))
    StateDiff.apply(a, StateDiff.diff(a, { list: [3], o: {} }))
    expect(a).toEqual(copy)
  })
})
