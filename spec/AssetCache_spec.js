const AssetCache = require('../lib/AssetCache')

describe('AssetCache', () => {
  var elements
  beforeEach(() => {
    elements = []
    spyOn(document, 'createElement').and.callFake(() => {
      var el = { complete: false, naturalWidth: 0 }
      elements.push(el)
      return el
    })
  })

  it('should create an image with the base prefixed to the path', () => {
    var cache = new AssetCache({ base: 'img/' })
    var entry = cache.image('dock.jpg')
    expect(document.createElement).toHaveBeenCalledWith('img')
    expect(entry.element.src).toEqual('img/dock.jpg')
  })

  it('should return the same entry for the same path', () => {
    var cache = new AssetCache()
    expect(cache.image('a.png')).toBe(cache.image('a.png'))
    expect(elements.length).toEqual(1)
  })

  it('should resolve ready with the element once loaded', (done) => {
    var cache = new AssetCache()
    var entry = cache.image('a.png')
    entry.ready.then((img) => {
      expect(img).toBe(entry.element)
      done()
    })
    entry.element.onload()
  })

  it('should resolve ready with null if loading fails', (done) => {
    var cache = new AssetCache()
    var entry = cache.image('missing.png')
    entry.ready.then((img) => {
      expect(img).toBeNull()
      done()
    })
    entry.element.onerror()
  })

  it('should preload several images', (done) => {
    var cache = new AssetCache()
    cache.preload(['a.png', 'b.png']).then((imgs) => {
      expect(imgs.length).toEqual(2)
      done()
    })
    elements.forEach((el) => el.onload())
  })

  it('should report whether an image has loaded', () => {
    var cache = new AssetCache()
    expect(cache.loaded('a.png')).toBe(false)
    var entry = cache.image('a.png')
    expect(cache.loaded('a.png')).toBe(false)
    entry.element.complete = true
    entry.element.naturalWidth = 10
    expect(cache.loaded('a.png')).toBe(true)
  })
})
