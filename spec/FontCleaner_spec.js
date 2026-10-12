import FontCleaner from '../lib/FontCleaner.js'
import BitmapFont from '../lib/BitmapFont.js'

describe('FontCleaner', () => {
  it('should fill a one-pixel gap through a vertical stroke', () => {
    // A stroke down column 0 with a gap at row 2
    const rows = [0x80, 0x80, 0x00, 0x80, 0x80, 0, 0, 0]
    expect(FontCleaner.rows(rows)).toEqual([0x80, 0x80, 0x80, 0x80, 0x80, 0, 0, 0])
    expect(rows[2]).toBe(0)
  })

  it('should leave a diagonal and a stroke only one deep on both sides alone', () => {
    const diagonal = [0x80, 0x40, 0x00, 0x10, 0x08, 0, 0, 0]
    expect(FontCleaner.rows(diagonal)).toEqual(diagonal)
    const dots = [0x00, 0x80, 0x00, 0x80, 0x00, 0, 0, 0]
    expect(FontCleaner.rows(dots)).toEqual(dots)
  })

  it('should clean a list, keeping missing glyphs missing, and take other widths', () => {
    expect(FontCleaner.glyphs([null, [8, 8, 0, 8]], 4)).toEqual([null, [8, 8, 8, 8]])
  })
})

describe('BitmapFont.fromBits', () => {
  it('should draw the glyphs white on a sheet of cells, and make a font of it', () => {
    const filled = []
    const canvas = {
      getContext: () => ({ fillRect: (x, y) => filled.push(x + ',' + y) })
    }
    let size = null
    const font = BitmapFont.fromBits({
      bits: [[0x80], undefined, [0x01, 0x80]],
      cellWidth: 8,
      cellHeight: 2,
      columns: 2,
      characters: 'AB.',
      createCanvas: (w, h) => { size = [w, h]; return canvas }
    })
    expect(size).toEqual([16, 4])
    expect(filled).toEqual(['0,0', '7,2', '0,3'])
    expect(font.image).toBe(canvas)
    expect(font.ink).toBe('#ffffff')
    expect(font.glyph('.')).toBe(2)
    expect(font.lineWidth('AB.')).toBe(24)
  })
})

describe('BitmapFont.readBits', () => {
  it('should read each cell of a sheet as rows of bits', () => {
    // Two 2 x 1 cells side by side: ink, clear | clear, ink
    const rgba = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 200])
    const canvas = { width: 4, height: 1, getContext: () => ({ drawImage () {}, getImageData: () => ({ data: rgba }) }) }
    expect(BitmapFont.readBits({ width: 4, height: 1 }, 2, 1, 2, { createCanvas: () => canvas })).toEqual([[2], [1]])
  })
})
