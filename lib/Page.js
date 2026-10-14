/**
 * The page's globals as one object a game is given: the window and document (listeners, storage, full screen),
 * the clock, a random number, the page reloaded, its address, and a JSON file or an image loaded by path. A
 * game's parts take this, never the globals, so a spec can give a stand-in with a fixed clock and random.
 *
 * @example
const page = new Page({ window })
const table = await page.json('data/units.json')
const picture = await page.image('data/tiles.png')
if (page.search.includes('original')) ...
 */
class Page {
  /**
   * @param {object} options
   * @param {Window} options.window
   */
  constructor ({ window }) {
    this.window = window
    this.document = window.document
  }

  /** The time in milliseconds (the page's performance clock). */
  now () {
    return this.window.performance.now()
  }

  /** The time in seconds. */
  seconds () {
    return this.now() / 1000
  }

  /** A whole number from a to b, both in. */
  random (a, b) {
    return a + Math.floor(Math.random() * (b - a + 1))
  }

  reload () {
    this.window.location.reload()
  }

  /** The page's host name (for a server's address). */
  get hostname () {
    return this.window.location.hostname
  }

  /** The page's query string. */
  get search () {
    return this.window.location.search
  }

  /** A JSON file by path, parsed; rejects with the path and status when it cannot be read. */
  json (path) {
    return this.window.fetch(path).then((r) => {
      if (!r.ok) throw new Error(path + ': ' + r.status)
      return r.json()
    })
  }

  /** An image by path, loaded. */
  image (path) {
    return new Promise((resolve, reject) => {
      const img = new this.window.Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('could not load ' + path))
      img.src = path
    })
  }
}

export default Page
