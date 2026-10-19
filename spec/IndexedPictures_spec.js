import IndexedSurface from '../lib/IndexedSurface.js'
import IndexedPictures from '../lib/IndexedPictures.js'
import HeadlessCanvas from '../lib/HeadlessCanvas.js'

describe('IndexedPictures', () => {
  const sheet = new IndexedSurface({ width: 4, height: 2, transparent: true })
  sheet.set(1, 0, 7)
  sheet.set(3, 1, 9)
  const pictures = new IndexedPictures({
    pictures: { dot: { sheet: 'one', x: 0, y: 0, w: 2, h: 1 }, foot: { sheet: 'one', x: 2, y: 0, w: 2, h: 2, anchor: [1, 1] } },
    sheets: { one: sheet }
  })

  it('should cut each picture once and draw it by its top left or its anchor, through a colour table', () => {
    expect(pictures.has('dot')).toBe(true)
    expect(pictures.get('foot').anchor).toEqual([1, 1])
    const s = new IndexedSurface({ width: 6, height: 4 })
    pictures.draw(s, 'dot', 2, 1)
    expect(s.get(3, 1)).toEqual(7)
    pictures.place(s, 'foot', 4, 3, { map: IndexedSurface.table([9], [4]) })
    expect(s.get(4, 3)).toEqual(4)
    expect(() => pictures.draw(s, 'none', 0, 0)).not.toThrow()
  })
})

describe('HeadlessCanvas', () => {
  it('should take every drawing call, answer blank images, and keep its listeners', () => {
    const canvas = new HeadlessCanvas(320, 200)
    const context = canvas.getContext('2d')
    expect(() => { context.fillRect(0, 0, 1, 1); context.save(); context.restore() }).not.toThrow()
    context.fillStyle = 'black'
    expect(context.fillStyle).toEqual('black')
    expect(context.createImageData(2, 3).data.length).toEqual(24)
    expect(context.canvas).toBe(canvas)
    const seen = []
    canvas.addEventListener('mousedown', (e) => seen.push(e.x))
    canvas.listeners.mousedown({ x: 5 })
    expect(seen).toEqual([5])
  })
})
