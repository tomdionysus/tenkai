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
})
