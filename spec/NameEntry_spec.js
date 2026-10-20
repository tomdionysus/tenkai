import NameEntry from '../lib/NameEntry.js'

describe('NameEntry', () => {
  it('should type letters in capitals, digits, space and signs from the key codes, up to the longest', () => {
    const entry = new NameEntry({ longest: 5 })
    entry.begin()
    expect(entry.key('KeyA', 'a')).toEqual('typed')
    entry.key('Digit1')
    entry.key('Numpad2')
    entry.key('Space')
    entry.key('Minus')
    expect(entry.key('KeyB')).toBe(null)
    expect(entry.text).toEqual('A12 -')
    expect(entry.key('ShiftLeft')).toBe(null)
  })

  it('should take a letter back, end on Enter and give up on Escape, and do nothing while not begun', () => {
    const entry = new NameEntry()
    expect(entry.key('KeyA')).toBe(null)
    entry.begin('AB')
    expect(entry.key('Backspace')).toEqual('typed')
    expect(entry.text).toEqual('A')
    expect(entry.key('NumpadEnter')).toEqual('done')
    expect(entry.active).toBe(false)
    entry.begin('')
    expect(entry.key('Backspace')).toBe(null)
    expect(entry.key('Escape')).toEqual('cancelled')
  })

  it('should keep the case of the key when not in capitals, and take allowed keys the codes do not cover', () => {
    const entry = new NameEntry({ upper: false, signs: {}, allowed: /[!?]/ })
    entry.begin()
    entry.key('KeyA', 'a')
    entry.key('KeyB', 'B')
    entry.key('Minus', '-')
    entry.key('Digit1', '!')
    expect(entry.key('Slash', '?')).toEqual('typed')
    expect(entry.text).toEqual('aB1?')
  })
})
