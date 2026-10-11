/**
 * A connection to a {@link GameServer} in a Worker (or at the other end of any message port), with the browser
 * `WebSocket`'s surface: `send(text)`, `close()`, `readyState`, and the `open`, `message`, `close` and `error`
 * events. The server's side attaches the port with `GameServer.attach(port)`. A client written against the
 * `WebSocket` surface works with it unchanged.
 *
 * @example
// in the page
const socket = new WorkerSocket(new Worker('server.js', { type: 'module' }))
const client = new GameClient({ socket, name: 'Ann' })
// in server.js
const server = new GameServer({ state, tickTime: 0.07 })
server.attach(self)
server.start()
 */
class WorkerSocket {
  /**
   * @param {object} port A Worker or a MessagePort: `postMessage`, and `onmessage` or `addEventListener`
   */
  constructor (port) {
    this.port = port
    this.readyState = WorkerSocket.CONNECTING
    this.url = 'worker:'
    this.protocol = ''
    this.onopen = null
    this.onmessage = null
    this.onclose = null
    this.onerror = null
    this.listeners = { open: [], message: [], close: [], error: [] }
    const receive = (e) => {
      const m = e.data
      if (m === WorkerSocket.OPENED) {
        if (this.readyState !== WorkerSocket.CONNECTING) return
        this.readyState = WorkerSocket.OPEN
        return this.dispatch('open', { type: 'open' })
      }
      if (typeof m === 'string' && this.readyState === WorkerSocket.OPEN) this.dispatch('message', { type: 'message', data: m })
    }
    if (port.addEventListener) {
      port.addEventListener('message', receive)
      if (port.start) port.start()
    } else port.onmessage = receive
    if (port.addEventListener) port.addEventListener('error', (e) => this.dispatch('error', { type: 'error', error: e }))
    port.postMessage(WorkerSocket.OPEN_REQUEST)
  }

  /** Sends a string to the server; as `WebSocket.send`, an error before the connection is open. */
  send (text) {
    if (this.readyState === WorkerSocket.CONNECTING) throw new Error('InvalidStateError: still connecting')
    if (this.readyState !== WorkerSocket.OPEN) return
    this.port.postMessage(String(text))
  }

  /** Closes the connection: the server drops the player, and `close` follows. */
  close (code = 1000, reason = '') {
    if (this.readyState === WorkerSocket.CLOSING || this.readyState === WorkerSocket.CLOSED) return
    this.readyState = WorkerSocket.CLOSED
    this.port.postMessage(WorkerSocket.CLOSE_REQUEST)
    this.dispatch('close', { type: 'close', code, reason, wasClean: true })
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
}

WorkerSocket.CONNECTING = 0
WorkerSocket.OPEN = 1
WorkerSocket.CLOSING = 2
WorkerSocket.CLOSED = 3
// The port's own signals, besides the game's strings
WorkerSocket.OPEN_REQUEST = { worker: 'open' }
WorkerSocket.OPENED = 'worker:opened'
WorkerSocket.CLOSE_REQUEST = { worker: 'close' }

export default WorkerSocket
