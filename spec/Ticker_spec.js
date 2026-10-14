import Ticker from '../lib/Ticker.js'

describe('Ticker', () => {
  // A font of 8-pixel cells that records what it draws
  function font () {
    const f = { cellWidth: 8, drawn: [] }
    f.draw = (context, text, x, y, options) => f.drawn.push({ text, x, y, options })
    return f
  }
  const window = { x: 32, y: 145, width: 128, height: 7 }
  const ticker = (options = {}) => new Ticker(Object.assign({ font: font(), window, colour: '#c00', gap: '.  ' }, options))

  it('should bring a posted message in from the right edge a column a frame, then its gap, then blanks', () => {
    const started = []
    const t = ticker({ onStart: (text) => started.push(text) })
    expect(t.post('HELLO')).toBe(true)
    t.update(1 / 50)
    expect(started).toEqual(['HELLO'])
    expect(t.tape).toEqual('HELLO.  ')
    expect(t.x).toEqual(32 + 128 - 1)
    t.draw('context')
    expect(t.font.drawn[0]).toEqual({ text: 'HELLO.  ', x: 159, y: 145, options: { colour: '#c00', clip: window } })
    // The message and its gap are 8 characters: 64 columns, then blank columns follow
    t.update(63 / 50)
    expect(t.tape).toEqual('HELLO.  ')
    t.update(1 / 50)
    expect(t.tape).toEqual('HELLO.   ')
  })

  it('should queue messages up to the limit, drop a repeat of the last, and accept it again after', () => {
    const t = ticker({ limit: 2 })
    expect(t.post('A')).toBe(true)
    expect(t.post('A')).toBe(false)
    expect(t.post('B')).toBe(true)
    expect(t.post('C')).toBe(false)
    expect(t.queue).toEqual(['A', 'B'])
    // Both start across (4 characters each with the gap); with the queue empty the last is forgotten
    t.update(1 / 50)
    t.update(32 / 50)
    expect(t.tape).toEqual('A.  B.  ')
    t.update(32 / 50)
    expect(t.last).toBeNull()
    expect(t.post('B')).toBe(true)
  })

  it('should keep only what can still be seen', () => {
    const t = ticker()
    t.post('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
    // 26 characters and a 3-character gap: 232 columns; the window shows 16 characters
    t.update(232 / 50)
    expect(t.start).toBeGreaterThan(0)
    expect(t.tape.length).toBeLessThan(29)
    expect(t.tape.endsWith('Z.  ')).toBe(true)
    // What is drawn still lines up: the first kept character where it would be on the whole tape
    expect(t.x).toEqual(32 + 128 - 232 + t.start * 8)
  })

  it('should hold one text alone, scrolled in once and kept, and resume the tape after', () => {
    const t = ticker()
    t.post('NEWS')
    t.update(10 / 50)
    const kept = { tape: t.tape, start: t.start, columns: t.columns }
    t.hold('PAUSED')
    expect(t.holding).toBe(true)
    t.update(100 / 50)
    // 6 characters and one more: 56 columns at most
    expect(t.columns).toEqual(56)
    expect(t.tape).toEqual('PAUSED')
    t.resume()
    expect(t.holding).toBe(false)
    expect({ tape: t.tape, start: t.start, columns: t.columns }).toEqual(kept)
    t.resume()
    expect(t.tape).toEqual(kept.tape)
  })

  it('should take its step from the font and its own rate', () => {
    const t = new Ticker({ font: { cellWidth: 4 }, window, rate: 25 })
    expect(t.step).toEqual(4)
    expect(t.gap).toEqual('   ')
    t.post('X')
    t.update(1 / 25)
    expect(t.columns).toEqual(1)
    expect(new Ticker({ window, step: 6 }).step).toEqual(6)
  })
})
