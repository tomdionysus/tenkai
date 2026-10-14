/**
 * The page's globals as one object a game is given: the window and document (listeners, storage, full screen),
 * the clock, a random number, the page reloaded, its address, a JSON file or an image loaded by path, and a file
 * saved or picked by the player. A game's parts take this, never the globals, so a spec can give a stand-in with
 * a fixed clock and random.
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

  /** A fraction from 0 up to but not including 1 (the page's own random), for a game's parts to be given. */
  fraction () {
    return Math.random()
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

  /**
   * `data` offered to the player as a file to save (a browser download), named `name`: a saved game.
   * @param {string} name The file's name
   * @param {object|string} data Written as JSON, or a string as it is
   * @param {string} type The file's media type (optional, default application/json)
   */
  download (name, data, type = 'application/json') {
    const text = typeof data === 'string' ? data : JSON.stringify(data)
    const a = this.document.createElement('a')
    a.href = this.window.URL.createObjectURL(new this.window.Blob([text], { type }))
    a.download = name
    a.click()
    this.window.setTimeout(() => this.window.URL.revokeObjectURL(a.href), 1000)
  }

  /**
   * The browser's file picker for a JSON file (a saved game to load): resolves with what the chosen file holds,
   * rejects when it is not JSON. A picker closed without a choice never settles.
   * @returns {Promise<object>}
   */
  pickJson () {
    return new Promise((resolve, reject) => {
      const input = this.document.createElement('input')
      input.type = 'file'
      input.accept = '.json,application/json'
      input.onchange = () => {
        const file = input.files[0]
        if (!file) return
        file.text().then((text) => {
          let data
          try {
            data = JSON.parse(text)
          } catch (e) {
            return reject(new Error(file.name + ': not JSON'))
          }
          resolve(data)
        })
      }
      input.click()
    })
  }
}

export default Page
