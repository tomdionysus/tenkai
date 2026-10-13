import MessageQueue from '../lib/MessageQueue.js'

describe('MessageQueue', () => {
  it('should show one message at a time, held before a click can dismiss it, the next after it', () => {
    var q = new MessageQueue({ hold: 2 })
    var closed = []
    expect(q.show('a', () => closed.push('a'))).toBe(true)
    expect(q.show('b')).toBe(false)
    expect(q.current).toBe('a')
    expect(q.dismiss()).toBe(false)
    q.step()
    q.step()
    expect(q.ready).toBe(true)
    expect(q.dismiss()).toBe(true)
    expect(closed).toEqual(['a'])
    expect(q.current).toBe('b')
    expect(q.ready).toBe(false)
    q.step()
    q.step()
    q.dismiss()
    expect(q.open).toBe(false)
    expect(q.dismiss()).toBe(false)
  })

  it('should forget everything when cleared', () => {
    var q = new MessageQueue()
    q.show('a', () => fail('closed'))
    q.show('b')
    q.clear()
    expect(q.open).toBe(false)
    expect(q.show('c')).toBe(true)
  })
})
