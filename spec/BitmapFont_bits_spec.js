import BitmapFont from '../lib/BitmapFont.js'

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
