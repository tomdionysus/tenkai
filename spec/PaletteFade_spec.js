import PaletteFade from '../lib/PaletteFade.js'
import Palette from '../lib/Palette.js'
import IndexedSurface from '../lib/IndexedSurface.js'
import IndexedScene from '../lib/IndexedScene.js'

describe('PaletteFade', () => {
  it('should move every component one level towards its target each step, after the wait', () => {
    const fade = new PaletteFade({ from: [0, 15, 4], to: [2, 0, 4], every: 2, wait: 1, steps: 3 })
    expect(fade.length).toBe(7)
    const seen = []
    while (!fade.done) {
      fade.step()
      seen.push(fade.colours.join(','))
    }
    // Frame 0 waits; steps on frames 1, 3 and 5; the fade ends on frame 7
    expect(seen).toEqual(['0,15,4', '1,14,4', '1,14,4', '2,13,4', '2,13,4', '2,12,4', '2,12,4'])
    expect(fade.level).toBe(3)
    expect(fade.step()).toBe(false)
  })

  it('should run speed frames a tick, and say when it stepped', () => {
    const fade = new PaletteFade({ from: [0], to: [15], every: 4, speed: 2 })
    expect(fade.length).toBe(65)
    expect(fade.tick()).toBe(true)
    expect(fade.tick()).toBe(false)
    expect(fade.tick()).toBe(true)
    expect(fade.colours).toEqual([2])
    let ticks = 3
    while (!fade.done) { fade.tick(); ticks++ }
    expect(ticks).toBe(33)
    expect(fade.colours).toEqual([15])
  })

  it('should not change the colours it was given', () => {
    const from = [3, 3, 3]
    const fade = new PaletteFade({ from, to: [0, 0, 0], wait: 0 })
    fade.step()
    expect(from).toEqual([3, 3, 3])
    expect(fade.colours).toEqual([2, 2, 2])
  })

  it('should write its colours into a palette, scaled to 0-255', () => {
    const palette = new Palette({ size: 4 })
    new PaletteFade({ from: [15, 0, 5, 1, 2, 3] }).apply(palette, 1)
    expect(palette.get(0)).toEqual([0, 0, 0])
    expect(palette.get(1)).toEqual([255, 0, 85])
    expect(palette.get(2)).toEqual([17, 34, 51])
  })
})

describe('Palette.fromCSS', () => {
  it('should read #rrggbb and #rgb colours', () => {
    const p = Palette.fromCSS(['#ff8000', '#0f0'])
    expect(p.size).toBe(2)
    expect(p.get(0)).toEqual([255, 128, 0])
    expect(p.get(1)).toEqual([0, 255, 0])
  })
})

describe('IndexedSurface lines and bits', () => {
  it('should draw lines across and down, clipped', () => {
    const s = new IndexedSurface({ width: 4, height: 3 })
    s.line(2, 0, 5, 1)
    s.line(0, 1, 9, 2, true)
    expect(Array.from(s.pixels)).toEqual([0, 0, 1, 1, 2, 0, 0, 0, 2, 0, 0, 0])
  })

  it('should draw the set bits of each row in a colour, leaving the rest', () => {
    const s = new IndexedSurface({ width: 5, height: 2 })
    s.fill(0, 0, 5, 2, 7)
    s.bits([0b1010, 0b0110], 1, 0, 3, 4)
    expect(Array.from(s.pixels)).toEqual([7, 3, 7, 3, 7, 7, 7, 3, 3, 7])
    const g = new IndexedSurface({ width: 8, height: 1 })
    g.bits([0x81], 0, 0, 1)
    expect(Array.from(g.pixels)).toEqual([1, 0, 0, 0, 0, 0, 0, 1])
  })
})

describe('IndexedScene regions', () => {
  it('should show ranges of lines through other palettes', () => {
    const surface = new IndexedSurface({ width: 1, height: 3 })
    surface.fill(0, 0, 1, 3, 1)
    const a = Palette.fromCSS(['#000', '#100000'])
    const b = Palette.fromCSS(['#000', '#200000'])
    const c = Palette.fromCSS(['#000', '#300000'])
    const fake = () => ({ width: 1, height: 3, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }) })
    const scene = new IndexedScene({ surface, palette: a, regions: [{ from: 1, palette: b }, { from: 2, palette: c }], createCanvas: fake })
    const d = scene.render().data
    expect([d[0], d[4], d[8]]).toEqual([0x10, 0x20, 0x30])
  })
})

describe('IndexedSurface.fromImage and solid bits', () => {
  // A canvas stand-in holding RGBA pixels
  const canvasOf = (width, height, rgba) => ({
    width,
    height,
    getContext: () => ({ drawImage () {}, getImageData: () => ({ data: rgba }) })
  })

  it('should read a picture as palette numbers, the first entry of a colour, transparent where it is', () => {
    const palette = Palette.fromCSS(['#000', '#f00', '#f00', '#0f0'])
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 9, 9, 9, 255, 255, 0, 0, 0])
    const s = IndexedSurface.fromImage({ width: 4, height: 1 }, palette, { createCanvas: () => canvasOf(4, 1, rgba), missing: 7 })
    expect(s.transparent).toBe(true)
    expect(Array.from(s.pixels)).toEqual([1, 3, 7, -1])
  })

  it('should draw the clear bits in a paper colour when given one', () => {
    const s = new IndexedSurface({ width: 4, height: 1 })
    s.fill(0, 0, 4, 1, 9)
    s.bits([0b1010], 0, 0, 3, 4, 0)
    expect(Array.from(s.pixels)).toEqual([3, 0, 3, 0])
  })
})

describe('IndexedSurface remap and toCanvas, Palette clone', () => {
  it('should map every pixel through a table, leaving the transparent ones', () => {
    const s = new IndexedSurface({ width: 4, height: 1, transparent: true })
    s.pixels.set([8, 9, -1, 3])
    s.remap((c) => (c >= 8 ? c & ~1 : c))
    expect(Array.from(s.pixels)).toEqual([8, 8, -1, 3])
    s.remap([0, 0, 0, 5])
    expect(Array.from(s.pixels)).toEqual([8, 8, -1, 5])
  })

  it('should make a canvas through a palette, rows below a region through its own, transparent stays clear', () => {
    let image = null
    const canvas = {
      getContext: () => ({
        createImageData: (w, h) => { image = { data: new Uint8ClampedArray(w * h * 4) }; return image },
        putImageData () {}
      })
    }
    const s = new IndexedSurface({ width: 1, height: 3, transparent: true })
    s.pixels.set([1, 1, -1])
    const a = Palette.fromCSS(['#000', '#100000'])
    const b = Palette.fromCSS(['#000', '#200000'])
    expect(s.toCanvas(a, { regions: [{ from: 1, palette: b }], createCanvas: () => canvas })).toBe(canvas)
    expect([image.data[0], image.data[4], image.data[8], image.data[11]]).toEqual([0x10, 0x20, 0, 0])
  })

  it('should clone a palette, its colours its own', () => {
    const p = Palette.fromCSS(['#000', '#fff'])
    const q = p.clone()
    q.set(1, 1, 2, 3)
    expect(p.get(1)).toEqual([255, 255, 255])
    expect(q.get(1)).toEqual([1, 2, 3])
  })
})

describe('Palette.setLevels and PaletteFade.fadeRGBA', () => {
  it('should set entries from 4-bit levels', () => {
    const p = new Palette({ size: 3 })
    p.setLevels([15, 1, 0, 2, 3, 4], 15, 1)
    expect(p.get(1)).toEqual([255, 17, 0])
    expect(p.get(2)).toEqual([34, 51, 68])
  })

  it('should fade a picture down by levels, or up to it', () => {
    const rgba = new Uint8ClampedArray([255, 34, 17, 255])
    PaletteFade.fadeRGBA(rgba, 2)
    expect(Array.from(rgba)).toEqual([221, 0, 0, 255])
    const up = new Uint8ClampedArray([255, 34, 17, 255])
    PaletteFade.fadeRGBA(up, 1, { up: true })
    expect(Array.from(up)).toEqual([17, 17, 17, 255])
  })
})
