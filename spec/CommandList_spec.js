import CommandList from '../lib/CommandList.js'

describe('CommandList', () => {
  var shown
  var handlers = {
    SHOW: (c, n) => shown.push(n),
    WAIT: (c, n, now) => c.wait(n, now),
    WAIT_RANDOM: (c, n, now) => c.wait(c.random(n + 1), now),
    BACK: (c, n) => c.goto(c.current - n),
    NOTHING: () => {}
  }
  beforeEach(() => { shown = [] })

  it('should run commands until one waits, and the rest when they are due', () => {
    var list = new CommandList({ commands: [['SHOW', 1], ['WAIT', 2], ['SHOW', 2], ['NOTHING', 0]], handlers, now: 10 })
    expect(list.tick(9)).toBe(true)
    expect(shown).toEqual([])
    list.tick(10)
    expect(shown).toEqual([1])
    list.tick(11)
    expect(shown).toEqual([1])
    expect(list.tick(12)).toBe(false)
    expect(shown).toEqual([1, 2])
    expect(list.done).toBe(true)
  })

  it('should go back, wait a random time, and stop at a command it does not know', () => {
    var list = new CommandList({ commands: [['SHOW', 1], ['WAIT_RANDOM', 3], ['BACK', 3], ['NOTHING', 0]], handlers, random: () => 0.5 })
    list.tick(0)
    list.tick(2)
    expect(shown).toEqual([1, 1])
    var unknown = new CommandList({ commands: [['FLY', 1], ['SHOW', 1]], handlers })
    expect(unknown.tick(0)).toBe(false)
    expect(shown).toEqual([1, 1])
  })

  it('should run at most perTick commands a tick when given', () => {
    var shown = []
    var list = new CommandList({
      commands: [['SHOW', 1], ['SHOW', 2], ['WAIT', 3], ['SHOW', 3]],
      handlers: { SHOW: (c, n) => shown.push(n), WAIT: (c, n, now) => c.wait(n, now) },
      perTick: 1
    })
    list.tick(0)
    expect(shown).toEqual([1])
    list.tick(1)
    list.tick(2)
    expect(shown).toEqual([1, 2])
    list.tick(4)
    expect(shown).toEqual([1, 2])
    list.tick(5)
    expect(shown).toEqual([1, 2, 3])
  })
})
