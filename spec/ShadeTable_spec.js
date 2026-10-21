import ShadeTable from '../lib/ShadeTable.js'
import Palette from '../lib/Palette.js'

describe('ShadeTable', () => {
  // A canvas that gives back an image's pixels as the image holds them
  function image (width, height, rgba) {
    return { width, height, rgba }
  }
  const createCanvas = () => {
    const canvas = { width: 0, height: 0 }
    canvas.getContext = () => ({
      drawImage: (img) => { canvas.data = img.rgba },
      getImageData: () => ({ data: canvas.data })
    })
    return canvas
  }

  it('should turn its cells into colours through a palette, a row a level of light', () => {
    const table = new ShadeTable({ table: new Uint8Array([0, 1, 2, 2, 1, 0]), rows: 2, entries: 3 })
    const palette = new Palette({ size: 3, colors: [255, 0, 0, 0, 255, 0, 0, 0, 255] })
    expect(Array.from(table.colors(palette))).toEqual([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 255, 0, 255, 255, 0, 0, 255])
    expect(Array.from(table.colors(palette.colors))).toEqual(Array.from(table.colors(palette)))
  })

  it('should read a table from an image, and palettes from an image with one a row', () => {
    spyOn(ShadeTable, 'pixels').and.callFake((img) => ({ width: img.width, height: img.height, data: img.rgba }))
    const table = ShadeTable.fromImage(image(2, 2, new Uint8Array([5, 0, 0, 255, 6, 0, 0, 255, 7, 0, 0, 255, 8, 0, 0, 255])))
    expect(table.rows).toEqual(2)
    expect(table.entries).toEqual(2)
    expect(Array.from(table.table)).toEqual([5, 6, 7, 8])
    const palettes = ShadeTable.palettesFromImage(image(2, 2, new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255])))
    expect(palettes.length).toEqual(2)
    expect(palettes[1].get(0)).toEqual([7, 8, 9])
    expect(palettes[1].get(1)).toEqual([10, 11, 12])
  })

  it('should read an image\'s pixels through a canvas', () => {
    const p = ShadeTable.pixels(image(1, 1, new Uint8Array([9, 8, 7, 255])), createCanvas)
    expect(p.width).toEqual(1)
    expect(Array.from(p.data)).toEqual([9, 8, 7, 255])
  })
})
