import Page from '../lib/Page.js'

describe('Page', () => {
  function window () {
    const w = {
      document: { title: 'doc' },
      performance: { now: () => 1500 },
      location: { hostname: 'host', search: '?original', reload: jasmine.createSpy('reload') },
      fetch: (path) => Promise.resolve(path === 'good.json' ? { ok: true, json: () => Promise.resolve({ v: 1 }) } : { ok: false, status: 404 })
    }
    w.Image = class {
      set src (path) {
        if (path === 'good.png') this.onload()
        else this.onerror()
      }
    }
    return w
  }

  it('should give the page its clock, address, random and reload', () => {
    const page = new Page({ window: window() })
    expect(page.document.title).toEqual('doc')
    expect(page.now()).toEqual(1500)
    expect(page.seconds()).toEqual(1.5)
    expect(page.hostname).toEqual('host')
    expect(page.search).toEqual('?original')
    for (let i = 0; i < 20; i++) {
      const r = page.random(3, 5)
      expect(r >= 3 && r <= 5 && Number.isInteger(r)).toBe(true)
    }
    page.reload()
    expect(page.window.location.reload).toHaveBeenCalled()
  })

  it('should load JSON and images by path, rejecting what cannot be read', async () => {
    const page = new Page({ window: window() })
    expect(await page.json('good.json')).toEqual({ v: 1 })
    await expectAsync(page.json('bad.json')).toBeRejectedWithError('bad.json: 404')
    expect(await page.image('good.png')).toBeDefined()
    await expectAsync(page.image('bad.png')).toBeRejectedWithError('could not load bad.png')
  })

  // A window whose document makes elements that record what is done to them
  function filesWindow () {
    const w = window()
    w.made = []
    w.document.createElement = (tag) => {
      const e = { tag, click: jasmine.createSpy('click') }
      w.made.push(e)
      return e
    }
    w.Blob = class { constructor (parts, options) { this.parts = parts; this.options = options } }
    w.URL = { createObjectURL: (blob) => 'blob:' + blob.parts[0].length, revokeObjectURL: jasmine.createSpy('revoke') }
    w.setTimeout = (fn) => fn()
    return w
  }

  it('should offer data as a JSON file to save', () => {
    const w = filesWindow()
    const page = new Page({ window: w })
    page.download('game.json', { v: 1 })
    const a = w.made[0]
    expect(a.tag).toEqual('a')
    expect(a.download).toEqual('game.json')
    expect(a.href).toEqual('blob:7')
    expect(a.click).toHaveBeenCalled()
    expect(w.URL.revokeObjectURL).toHaveBeenCalledWith('blob:7')
    page.download('notes.txt', 'plain', 'text/plain')
    expect(w.made[1].href).toEqual('blob:5')
  })

  it('should pick a JSON file, rejecting one that is not JSON', async () => {
    const w = filesWindow()
    const page = new Page({ window: w })
    const picked = page.pickJson()
    const input = w.made[0]
    expect([input.tag, input.type, input.accept]).toEqual(['input', 'file', '.json,application/json'])
    expect(input.click).toHaveBeenCalled()
    input.files = [{ name: 'save.json', text: () => Promise.resolve('{"v":2}') }]
    input.onchange()
    expect(await picked).toEqual({ v: 2 })
    const bad = page.pickJson()
    const again = w.made[1]
    again.files = [{ name: 'save.txt', text: () => Promise.resolve('nope') }]
    again.onchange()
    await expectAsync(bad).toBeRejectedWithError('save.txt: not JSON')
  })
})
