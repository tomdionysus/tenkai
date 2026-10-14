import FrameClock from '../lib/FrameClock.js'

describe('FrameClock', () => {
  it('should turn elapsed seconds into whole frames, keeping the rest', () => {
    const clock = new FrameClock(50)
    expect(clock.period).toEqual(1 / 50)
    expect(clock.frames(0.01)).toEqual(0)
    expect(clock.frames(0.015)).toEqual(1)
    expect(clock.time).toBeCloseTo(0.005, 9)
    expect(clock.frames(0.1)).toEqual(5)
    expect(clock.time).toBeCloseTo(0.005, 9)
  })

  it('should count a frame that steps add up to a hair short of', () => {
    const clock = new FrameClock(50)
    let n = 0
    for (let i = 0; i < 6; i++) n += clock.frames(0.02 / 6)
    expect(n).toEqual(1)
  })

  it('should run at any rate, once a second for a game clock, and reset', () => {
    const seconds = new FrameClock(1)
    expect(seconds.frames(0.6)).toEqual(0)
    expect(seconds.frames(0.6)).toEqual(1)
    seconds.reset()
    expect(seconds.time).toEqual(0)
    expect(seconds.frames(0.9)).toEqual(0)
    expect(new FrameClock().rate).toEqual(50)
  })
})
