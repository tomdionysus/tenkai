import BitmapFont from '../lib/BitmapFont.js'

describe('BitmapFont', () => {
  var image = { width: 32, height: 16 }
  var font = (options = {}) => new BitmapFont(Object.assign({ image, cellWidth: 8, cellHeight: 8, characters: '0123ABCD' }, options))
  var context = () => jasmine.createSpyObj('context', ['drawImage', 'save', 'restore', 'beginPath', 'rect', 'clip'])

  it('should map characters to cells, four to a row of this sheet', () => {
    var f = font()
    expect(f.columns).toEqual(4)
    expect(f.glyph('A')).toEqual(4)
    expect(f.glyph('a')).toBeUndefined()
    expect(font({ upperCase: true }).glyph('a')).toEqual(4)
    expect(font({ characters: { X: 7 } }).glyph('X')).toEqual(7)
  })

  it('should draw each glyph from its cell, skipping characters it has no glyph for', () => {
    var c = context()
    font().draw(c, '1 B', 10, 20)
    expect(c.drawImage.calls.count()).toEqual(2)
    expect(c.drawImage.calls.argsFor(0)).toEqual([image, 8, 0, 8, 8, 10, 20, 8, 8])
    expect(c.drawImage.calls.argsFor(1)).toEqual([image, 8, 8, 8, 8, 26, 20, 8, 8])
  })

  it('should break lines at newlines and at its line-break character', () => {
    var f = font({ lineBreak: '#', lineHeight: 10 })
    expect(f.measure('AB#C\nD')).toEqual({ width: 16, height: 28, lines: 3 })
    var c = context()
    f.draw(c, 'A#B', 0, 0)
    expect(c.drawImage.calls.argsFor(1)[6]).toEqual(10)
  })

  it('should measure proportional fonts and spacing', () => {
    var f = font({ widths: { A: 5, B: 6 }, spacing: 1 })
    expect(f.lineWidth('AB')).toEqual(12)
    expect(font({ widths: [1, 2, 3, 4, 5] }).lineWidth('0A')).toEqual(6)
  })

  it('should wrap at spaces by width, and break a word too long for a line', () => {
    var f = font({ characters: 'ABCDEFGH' })
    expect(f.wrap('AB CD EF', 40)).toEqual(['AB CD', 'EF'])
    expect(f.wrap('ABCDEFGH', 24)).toEqual(['ABC', 'DEF', 'GH'])
  })

  it('should align and clip', () => {
    var c = context()
    font().draw(c, 'AB', 100, 0, { align: 'right', clip: { x: 0, y: 0, width: 50, height: 8 } })
    expect(c.rect).toHaveBeenCalledWith(0, 0, 50, 8)
    expect(c.clip).toHaveBeenCalled()
    expect(c.restore).toHaveBeenCalled()
    expect(c.drawImage.calls.argsFor(0)[5]).toEqual(84)
  })

  it('should fall back to the untinted sheet where no canvas can be made', () => {
    expect(font().tinted('#ff0000')).toBe(image)
    expect(BitmapFont.rgb('#c80')).toEqual([204, 136, 0])
  })
})
