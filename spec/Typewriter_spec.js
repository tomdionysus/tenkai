import Typewriter from '../lib/Typewriter.js'

describe('Typewriter', () => {
  it('should let out a letter a tick, telling each as it comes, and say when all are out', () => {
    const came = []
    const typing = new Typewriter({ letter: (ch, i) => came.push(ch + i) })
    expect(typing.tick('AB')).toBe(false)
    expect(typing.shown('AB')).toEqual('A')
    expect(typing.tick('AB')).toBe(true)
    expect(typing.tick('AB')).toBe(true)
    expect(came).toEqual(['A0', 'B1'])
    expect(typing.done('AB')).toBe(true)
    typing.reset()
    expect(typing.shown('AB')).toEqual('')
  })

  it('should wait so many ticks between letters, and take a count in place of the text', () => {
    const came = []
    const typing = new Typewriter({ every: 3, letter: (ch) => came.push(ch) })
    typing.tick(2)
    typing.tick(2)
    expect(typing.typed).toBe(0)
    typing.tick(2)
    expect(typing.typed).toBe(1)
    expect(came).toEqual([''])
  })

  it('should show each later text by the letters before it, and let the rest out at once', () => {
    const typing = new Typewriter()
    for (let i = 0; i < 4; i++) typing.tick('ABC' + 'DE')
    expect(typing.shown('ABC')).toEqual('ABC')
    expect(typing.shown('DE', 3)).toEqual('D')
    typing.all('ABCDE')
    expect(typing.shown('DE', 3)).toEqual('DE')
    expect(typing.done(5)).toBe(true)
  })
})
