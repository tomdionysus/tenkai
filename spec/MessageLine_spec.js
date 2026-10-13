import MessageLine from '../lib/MessageLine.js'

describe('MessageLine', () => {
  var steps = (line, n) => { for (var i = 0; i < n; i++) line.step() }

  it('should scroll a message in, the old line going down as the new one comes down', () => {
    var line = new MessageLine({ hold: 100, scroll: 4, gap: 5 })
    line.say('one', 1)
    expect(line.rows()).toEqual([{ text: 'one', y: -4 }])
    steps(line, 2)
    expect(line.rows()).toEqual([{ text: 'one', y: -2 }])
    steps(line, 3)
    expect(line.rows()).toEqual([{ text: 'one', y: 0 }])
    expect(line.text).toBe('one')
  })

  it('should hold a line against messages of no more importance, and not hold it against a more important one', () => {
    var line = new MessageLine({ hold: 50, scroll: 2 })
    line.say('one', 2)
    steps(line, 4)
    line.say('two', 0)
    steps(line, 20)
    expect(line.text).toBe('one')
    steps(line, 40)
    expect(line.text).toBe('two')
    line.say('three', 5)
    steps(line, 4)
    expect(line.text).toBe('three')
  })

  it('should not take a message already showing or waiting again', () => {
    var line = new MessageLine({ scroll: 0 })
    line.say('Same', 1)
    steps(line, 2)
    line.say('same', 3)
    expect(line.scrolling).toBe(false)
  })
})
