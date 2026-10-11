/**
 * A connection to a {@link GameServer} in the same page, with the browser `WebSocket`'s surface: `send(text)`,
 * `close()`, `readyState`, and the `open`, `message`, `close` and `error` events (as `onopen` and so on, or
 * `addEventListener`). A client written against it works unchanged with a real `WebSocket` to a server.
 *
 * Messages are strings both ways, so the client can never reach the server's objects, and they are delivered
 * later, never inside `send`, as on a network. `schedule` decides when: by default on a new task; a page that
 * must see each tick's message before it draws (a frame-exact test) can deliver at once with
 * `schedule: (fn) => fn()`.
 *
 * @example
const socket = new LocalSocket(server)
socket.onopen = () => socket.send(JSON.stringify({ type: 'join', name: 'Ann' }))
socket.onmessage = (e) => console.log(JSON.parse(e.data))
 */
class LocalSocket {
  /**
   * @param {GameServer} server
   * @param {object} options
   * @param {function} options.schedule `(fn) => void`: runs `fn` when a message is to be delivered (default: a
   *   new task)
   */
  constructor (server, options = {}) {
    this.server = server
    this.schedule = options.schedule || LocalSocket.nextTask
    this.readyState = LocalSocket.CONNECTING
    this.url = 'local:'
    this.protocol = ''
    this.onopen = null
    this.onmessage = null
    this.onclose = null
    this.onerror = null
    this.listeners = { open: [], message: [], close: [], error: [] }
    this.connection = server.connect((text) => this.schedule(() => {
      if (this.readyState === LocalSocket.OPEN) this.dispatch('message', { type: 'message', data: text })
    }))
    this.schedule(() => {
      if (this.readyState !== LocalSocket.CONNECTING) return
      this.readyState = LocalSocket.OPEN
      this.dispatch('open', { type: 'open' })
    })
  }

  /** Sends a string to the server; as `WebSocket.send`, an error before the connection is open. */
  send (text) {
    if (this.readyState === LocalSocket.CONNECTING) throw new Error('InvalidStateError: still connecting')
    if (this.readyState !== LocalSocket.OPEN) return
    const data = String(text)
    this.schedule(() => this.server.receive(this.connection, data))
  }

  /** Closes the connection: the server drops the player, and `close` follows. */
  close (code = 1000, reason = '') {
    if (this.readyState === LocalSocket.CLOSING || this.readyState === LocalSocket.CLOSED) return
    this.readyState = LocalSocket.CLOSING
    this.schedule(() => {
      this.server.disconnect(this.connection)
      this.readyState = LocalSocket.CLOSED
      this.dispatch('close', { type: 'close', code, reason, wasClean: true })
    })
  }

  addEventListener (type, fn) {
    if (this.listeners[type]) this.listeners[type].push(fn)
  }

  removeEventListener (type, fn) {
    const list = this.listeners[type]
    if (list && list.indexOf(fn) >= 0) list.splice(list.indexOf(fn), 1)
  }

  dispatch (type, event) {
    const handler = this['on' + type]
    if (handler) handler.call(this, event)
    for (const fn of this.listeners[type].slice()) fn.call(this, event)
  }

  /** Runs `fn` on a new task (a MessageChannel where there is one, else a timer). */
  static nextTask (fn) {
    if (typeof MessageChannel === 'undefined') return setTimeout(fn, 0)
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      fn()
    }
    channel.port2.postMessage(0)
  }
}

LocalSocket.CONNECTING = 0
LocalSocket.OPEN = 1
LocalSocket.CLOSING = 2
LocalSocket.CLOSED = 3

export default LocalSocket
