import Facings from '../lib/Facings.js'

describe('Facings', () => {
  it('should round a facing to the nearest direction', () => {
    var f = new Facings({ directions: 8 })
    expect([0, 15, 16, 47, 48, 240, 255].map((x) => f.direction(x))).toEqual([0, 0, 1, 1, 2, 0, 0])
    expect(new Facings({ directions: 4, turn: 360 }).direction(-80)).toBe(3)
  })

  it('should give each direction its own picture, or mirror the west side', () => {
    var own = new Facings({ directions: 8 })
    expect(own.pick(160)).toEqual({ offset: 5, flip: false })
    var half = new Facings({ directions: 8, mirror: true })
    expect([0, 64, 128, 160, 224].map((x) => half.pick(x))).toEqual([
      { offset: 0, flip: false }, { offset: 2, flip: false }, { offset: 4, flip: false },
      { offset: 3, flip: true }, { offset: 1, flip: true }])
    var rocket = new Facings({ directions: 16, mirror: true })
    expect(rocket.pick(144)).toEqual({ offset: 7, flip: true })
  })

  it('should share pictures between directions, with frames to each', () => {
    var soldier = new Facings({ directions: 8, mirror: true, pictures: [0, 1, 1, 1, 2], frames: 3 })
    expect(soldier.pick(32, 1)).toEqual({ offset: 4, flip: false })
    expect(soldier.pick(128, 5)).toEqual({ offset: 8, flip: false })
    expect(soldier.pick(192, 0)).toEqual({ offset: 3, flip: true })
  })
})
