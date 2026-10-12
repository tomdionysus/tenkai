/**
 * Finding a game's server for the page: the addresses to try, in order, and the first that answers; with none
 * answering, asking the player (a {@link ServerConfig}) until one does. The page tries the address given in its URL
 * (`?server=ws://...`), then its own host's path (`/game`: a server that serves the page too is found there), then
 * the address the player last chose (kept in the browser's storage), then the suggestion (by default the page's
 * host on port 8053: a page served by a development server finds the game beside it). Once the connection is lost, `lost` asks again.
 *
 * @example
const finder = new ServerFinder({ key: 'mygame-server', config: new ServerConfig({ document }) })
const { socket, address } = await finder.find()
const client = new GameClient({ socket, name: 'Ann' })
client.onClose = async () => { await finder.lost(address); window.location.reload() }
 */
class ServerFinder {
  /**
   * @param {object} options
   * @param {string} options.key The storage key the chosen address is kept under (one per game)
   * @param {ServerConfig} options.config The screen that asks the player for an address (for `find` and `lost`)
   * @param {Location} options.location The page's location (default `window.location`)
   * @param {Storage} options.storage Where the chosen address is kept (default `window.localStorage`)
   * @param {string} options.path The server's path on the page's own host (default `/game`)
   * @param {string} options.param The URL parameter that gives an address (default `server`)
   * @param {string} options.suggestion The address offered when none was chosen yet (default the page's host, port
   * 8053, the path)
   * @param {function} options.socket `socket(address)`: a new WebSocket (default `new WebSocket(address)`)
   * @param {number} options.wait Milliseconds to wait for a socket to open (default 3000)
   */
  constructor (options = {}) {
    const g = typeof window !== 'undefined' ? window : {}
    this.key = options.key || 'tenkai-server'
    this.config = options.config || null
    this.location = options.location || g.location || { protocol: 'http:', host: '', hostname: '', search: '' }
    this.storage = options.storage || g.localStorage || null
    this.path = options.path || '/game'
    this.param = options.param || 'server'
    this.suggestion = options.suggestion || null
    this.socket = options.socket || ((address) => new g.WebSocket(address))
    this.wait = options.wait || 3000
  }

  /** The page's own host's path: ws://host:port/game, or wss:// on an https page. */
  own () {
    const l = this.location
    return (l.protocol === 'https:' ? 'wss://' : 'ws://') + (l.host || '127.0.0.1') + this.path
  }

  /** The address the player last chose, or null. */
  saved () {
    try {
      return this.storage.getItem(this.key) || null
    } catch (e) {
      return null
    }
  }

  /** Keep the address the player chose. */
  save (address) {
    try {
      this.storage.setItem(this.key, address)
    } catch (e) {}
  }

  /** The address offered when none was chosen: the `suggestion`, or the page's host on port 8053 and the path. */
  suggested () {
    const l = this.location
    return this.suggestion || (l.protocol === 'https:' ? 'wss://' : 'ws://') + (l.hostname || '127.0.0.1') + ':8053' + this.path
  }

  /** The addresses to try, in order, without repeats: the URL's, the page's own, the last chosen, the suggestion. */
  candidates () {
    const asked = new URLSearchParams(this.location.search || '').get(this.param)
    const list = [asked && /^wss?:\/\//.test(asked) ? asked : null, this.own(), this.saved(), this.suggested()]
    return list.filter((a, i) => a && list.indexOf(a) === i)
  }

  /**
   * A socket to `address`, once it is open, or null if it cannot be opened within the wait (a bad address, nothing
   * listening, a server that refuses).
   */
  open (address) {
    return new Promise((resolve) => {
      let socket
      try {
        socket = this.socket(address)
      } catch (e) {
        return resolve(null)
      }
      let done = false
      const finish = (s) => {
        if (done) return
        done = true
        clearTimeout(timer)
        resolve(s)
      }
      const timer = setTimeout(() => {
        try { socket.close() } catch (e) {}
        finish(null)
      }, this.wait)
      socket.addEventListener('open', () => finish(socket))
      socket.addEventListener('error', () => finish(null))
      socket.addEventListener('close', () => finish(null))
    })
  }

  /** The first of `addresses` that opens: `{ socket, address }`, or null. */
  async first (addresses) {
    for (const address of addresses) {
      const socket = await this.open(address)
      if (socket) return { socket, address }
    }
    return null
  }

  /**
   * A server: the first candidate that answers, or else the address the player enters on the config screen (asked
   * again until one answers, and kept for next time). Resolves with `{ socket, address }`.
   */
  async find () {
    const found = await this.first(this.candidates())
    if (found) return found
    return this.ask('No game server answered at this page\'s own address. Enter the server\'s address.',
      this.saved() || this.suggested())
  }

  /**
   * The connection to `address` was lost: the config screen says so and offers it again. Resolves with the address
   * the player enters, kept for next time (the page then starts afresh and finds it).
   */
  async lost (address) {
    const asked = await this.config.ask({ message: 'The connection to the game server was lost.', address })
    this.save(asked)
    return asked
  }

  // The config screen until an address the player enters answers
  async ask (message, address) {
    for (;;) {
      const asked = await this.config.ask({ message, address })
      this.config.say('Connecting to ' + asked + ' ...')
      const socket = await this.open(asked)
      if (socket) {
        this.save(asked)
        this.config.hide()
        return { socket, address: asked }
      }
      address = asked
      message = 'Could not connect to ' + asked + '.'
    }
  }
}

export default ServerFinder
