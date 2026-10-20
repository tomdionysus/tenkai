import IndexedFont from '../lib/IndexedFont.js'
import IndexedSurface from '../lib/IndexedSurface.js'
import IndexedText from '../lib/IndexedText.js'
import TextBlocks from '../lib/TextBlocks.js'

// A font whose every glyph is one pixel of ink at its top left, 2 wide (a space 1 wide, ink-less)
function font () {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'
  const characters = { ' ': 0 }
  const widths = [1]
  const ink = [[]]
  for (const ch of chars) {
    characters[ch] = widths.length
    widths.push(2)
    ink.push([0x80])
  }
  return new IndexedFont({ characters, widths, layers: { ink }, height: 3 })
}

// Where ink lies: 'x,y' for each pixel of colour c
function inked (surface, c = 1) {
  const out = []
  for (let y = 0; y < surface.height; y++) for (let x = 0; x < surface.width; x++) if (surface.get(x, y) === c) out.push(x + ',' + y)
  return out
}

describe('IndexedText', () => {
  const text = new IndexedText({ font: font(), lineHeight: 4 })

  it('should break lines at new lines, and at spaces to fit a width, a long word keeping its own line', () => {
    expect(text.lines('AB CD\nE')).toEqual(['AB CD', 'E'])
    expect(text.lines('AB CD EF', 9)).toEqual(['AB CD', 'EF'])
    expect(text.lines('ABCDEF G', 4)).toEqual(['ABCDEF', 'G'])
  })

  it('should draw each line a line height lower, answering the y below the last', () => {
    const s = new IndexedSurface({ width: 10, height: 10 })
    expect(text.draw(s, 'A\nB', 1, 1, { colours: { ink: 1 } })).toEqual(9)
    expect(inked(s)).toEqual(['1,1', '1,5'])
  })

  it('should centre each line halving the width and the line separately, each rounded down', () => {
    const s = new IndexedSurface({ width: 20, height: 4 })
    // width 9 halves to 4, 'AB' (4 wide) to 2: from x 2
    text.draw(s, 'AB', 0, 0, { colours: { ink: 1 }, centre: 9 })
    expect(inked(s)).toEqual(['2,0', '4,0'])
  })

  it('should right-align a number in its places, a 0 wide each', () => {
    const s = new IndexedSurface({ width: 20, height: 4 })
    text.number(s, 42.7, 0, 0, 4, { colours: { ink: 1 } })
    expect(inked(s)).toEqual(['4,0', '6,0'])
  })
})

describe('TextBlocks', () => {
  const text = new IndexedText({ font: font(), lineHeight: 4 })
  const words = (n) => ({ 1: 'AB', 2: 'C' })[n] || ''
  const blocks = {
    plain: { x: 0, y: 0, width: 10, items: [{ op: 'text', text: 1, x: 0, y: 0 }, { op: 'colour', colour: 2 }, { op: 'string', of: 'name', x: 0, y: 4 }, { op: 'number', of: 'n', x: 0, y: 8, digits: 3 }] },
    flags: { x: 0, y: 0, width: 10, items: [{ op: 'text', text: 2, x: 0, y: 0 }, { op: 'skipIfFlag' }, { op: 'text', text: 2, x: 2, y: 0 }, { op: 'stopIfFlag' }, { op: 'text', text: 2, x: 4, y: 0 }] },
    rows: { x: 0, y: 0, width: 10, items: [{ op: 'skipIfFlag', items: 2 }, { op: 'text', text: 2, x: 0, y: 0 }, { op: 'text', text: 2, x: 2, y: 0 }, { op: 'skipIfFlag', items: 2 }, { op: 'text', text: 2, x: 4, y: 0 }, { op: 'text', text: 2, x: 6, y: 0 }] },
    pen: { x: 0, y: 0, width: 10, items: [{ op: 'at', x: 3, y: 2 }, { op: 'string', string: 'A' }, { op: 'text', of: 'which', x: 6, y: 2 }] },
    centred: { x: 2, y: 0, width: 8, centreShift: 1, items: [{ op: 'centre', on: true }, { op: 'text', text: 2, x: 0, y: 0 }] }
  }
  const runner = new TextBlocks({ blocks, text, words, colours: (c) => ({ ink: c }) })

  it('should draw texts by number, values and numbers, in the colours the items set', () => {
    const s = new IndexedSurface({ width: 10, height: 12 })
    runner.draw(s, 'plain', { name: 'Z', n: -7 })
    expect(inked(s, 1)).toEqual(['0,0', '2,0'])
    expect(inked(s, 2)).toEqual(['0,4', '4,8'])
  })

  it('should leave out an item whose value is missing, and stop or skip by the flag', () => {
    const s = new IndexedSurface({ width: 10, height: 12 })
    runner.draw(s, 'plain', {})
    expect(inked(s, 2)).toEqual([])
    s.clear()
    runner.draw(s, 'flags', { flag: true })
    expect(inked(s)).toEqual(['0,0'])
    s.clear()
    runner.draw(s, 'flags', {})
    expect(inked(s)).toEqual(['0,0', '2,0', '4,0'])
  })

  it('should skip so many items, asking a flag function at each skip with its ordinal', () => {
    const s = new IndexedSurface({ width: 10, height: 4 })
    runner.draw(s, 'rows', { flag: (n) => n === 0 })
    expect(inked(s)).toEqual(['4,0', '6,0'])
    s.clear()
    runner.draw(s, 'rows', { flag: (n) => n === 1 })
    expect(inked(s)).toEqual(['0,0', '2,0'])
  })

  it('should put plain strings at the pen, and a value\'s number as its text', () => {
    const s = new IndexedSurface({ width: 10, height: 6 })
    runner.draw(s, 'pen', { which: 2 })
    expect(inked(s)).toEqual(['3,2', '6,2'])
  })

  it('should centre in the block\'s width from its x moved by its shift, in another painter\'s colours when asked', () => {
    const s = new IndexedSurface({ width: 12, height: 4 })
    runner.draw(s, 'centred', {}, { colours: (c) => ({ ink: c + 4 }) })
    // x 2 + shift 1 + 8 / 2 - 2 / 2 = 6
    expect(inked(s, 5)).toEqual(['6,0'])
    expect(runner.has('centred')).toBe(true)
    expect(() => runner.draw(s, 'none')).not.toThrow()
  })
})
