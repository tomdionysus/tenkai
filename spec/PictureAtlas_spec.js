import PictureAtlas from '../lib/PictureAtlas.js'

describe('PictureAtlas', () => {
  const image = { width: 400, height: 500 }
  const atlas = () => new PictureAtlas({ image, regions: { throne: [0, 0, 320, 224], map: { x: 0, y: 224, width: 142, height: 226 } } })
  const context = () => jasmine.createSpyObj('context', ['drawImage'])

  it('should take regions as arrays or objects and answer for them by name', () => {
    const a = atlas()
    expect(a.region('throne')).toEqual({ x: 0, y: 0, width: 320, height: 224 })
    expect(a.region('map')).toEqual({ x: 0, y: 224, width: 142, height: 226 })
    expect(a.has('map')).toBe(true)
    expect(a.has('route')).toBe(false)
    expect(new PictureAtlas({ image: { element: image } }).element).toBe(image)
  })

  it('should draw a piece whole at a rounded place, or a part of it from its left and top', () => {
    const a = atlas()
    const c = context()
    a.draw(c, 'throne', 10.4, 20.6)
    expect(c.drawImage).toHaveBeenCalledWith(image, 0, 0, 320, 224, 10, 21, 320, 224)
    a.draw(c, 'map', 89, 0, { width: 40 })
    expect(c.drawImage).toHaveBeenCalledWith(image, 0, 224, 40, 226, 89, 0, 40, 226)
    a.draw(c, 'map', 89, 0, { width: 1000, height: 10 })
    expect(c.drawImage).toHaveBeenCalledWith(image, 0, 224, 142, 10, 89, 0, 142, 10)
    c.drawImage.calls.reset()
    a.draw(c, 'map', 0, 0, { width: 0 })
    a.draw(c, 'route', 0, 0)
    expect(c.drawImage).not.toHaveBeenCalled()
  })

  it('should draw a piece scaled, mirrored, see-through and filtered, about its top left', () => {
    const image = { width: 512, height: 512 }
    const a = new PictureAtlas({ image, regions: { gun: [10, 20, 30, 40] } })
    const c = jasmine.createSpyObj('context', ['drawImage', 'save', 'restore', 'translate', 'scale'])
    c.globalAlpha = 1
    a.draw(c, 'gun', 100, 50, { scale: 2, flipX: true, alpha: 0.5, filter: 'brightness(0.5)' })
    expect(c.translate).toHaveBeenCalledWith(160, 50)
    expect(c.scale).toHaveBeenCalledWith(-1, 1)
    expect(c.drawImage).toHaveBeenCalledWith(image, 10, 20, 30, 40, 0, 0, 60, 80)
    expect(c.globalAlpha).toEqual(0.5)
    expect(c.filter).toEqual('brightness(0.5)')
    expect(c.restore).toHaveBeenCalled()
  })
})
