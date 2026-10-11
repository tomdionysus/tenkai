import StateDiff from './StateDiff.js'

/**
 * Runs a {@link GameState} for its players: ticks it on a clock, takes each player's input, commands and actions,
 * and sends every player, after each tick (and each action), what changed in their view and the events meant for
 * them. It uses no DOM, so the same server runs in the page (reached through a {@link LocalSocket}), in a Worker,
 * or under Node behind real WebSockets.
 *
 * Every message is a JSON string, both ways:
 *
 * - client to server: `{ type: 'join', name, wish }`; `{ type: 'input', input }` (what the player holds: kept,
 *   and given to every tick until it changes); `{ type: 'command', tick, ...command }` (once, at the tick it names);
 *   `{ type: 'act', action }` (done at once, between ticks); `{ type: 'leave' }`
 * - server to client: `{ type: 'welcome', player, tick, state }`, `{ type: 'tick', tick, delta, events }` (after a
 *   tick, or an action: then `tick` has not moved on), `{ type: 'refused', reason }`
 *
 * Each tick the state is given one command per player: `{ player, ...input, actions: [the commands due] }`. A
 * command is due at the tick it names, or at the next tick run if that has passed. The server's clock is either
 * its own (`start()`) or the caller's (`advance(seconds)`), so a page can tick it in step with its frames.
 *
 * @example
const server = new GameServer({ state, tickTime: 0.07 })
const socket = new LocalSocket(server)       // has the browser WebSocket's surface
const client = new GameClient({ socket, name: 'Ann' })
server.start()
 */
class GameServer {
  /**
   * @param {object} options
   * @param {GameState} options.state The game
   * @param {number} options.tickTime Seconds a tick (default 1 / 20)
   */
  constructor (options = {}) {
    this.state = options.state
    this.tickTime = options.tickTime || 1 / 20
    this.connections = []
    this.time = 0
    this.timer = null
  }

  /**
   * A new connection: `send(text)` delivers a message to its client. Returns the connection, to pass to
   * `receive` and `disconnect`.
   * @param {function} send
   */
  connect (send) {
    const connection = { send, player: null, last: null, input: {}, pending: [] }
    this.connections.push(connection)
    return connection
  }

  /**
   * Serves a client at the other end of a message port (a Worker's `self`, a MessagePort): the client's
   * {@link WorkerSocket} asks to open (`{ worker: 'open' }`, answered `'worker:opened'`) and to close
   * (`{ worker: 'close' }`); strings are the game's messages. Returns nothing; the connection lives as long as the
   * port does.
   */
  attach (port) {
    let connection = null
    const receive = (e) => {
      const m = e.data
      if (m && m.worker === 'open') {
        if (connection) this.disconnect(connection)
        connection = this.connect((text) => port.postMessage(text))
        port.postMessage('worker:opened')
      } else if (m && m.worker === 'close') {
        if (connection) this.disconnect(connection)
        connection = null
      } else if (typeof m === 'string' && connection) this.receive(connection, m)
    }
    if (port.addEventListener) {
      port.addEventListener('message', receive)
      if (port.start) port.start()
    } else port.onmessage = receive
  }

  /** A message from a connection's client. */
  receive (connection, text) {
    let message
    try {
      message = JSON.parse(text)
    } catch (e) {
      return
    }
    if (message.type === 'join') return this.join(connection, message)
    if (!connection.player) return
    if (message.type === 'command') {
      const command = Object.assign({}, message)
      delete command.type
      delete command.tick
      connection.pending.push({ tick: Math.max(message.tick || 0, this.state.ticks), command })
    } else if (message.type === 'input') connection.input = Object.assign({}, message.input)
    else if (message.type === 'act') {
      const events = this.state.act(connection.player, message.action) || []
      this.update(events)
    } else if (message.type === 'leave') this.leave(connection)
  }

  /** A connection gone: its player leaves. */
  disconnect (connection) {
    this.leave(connection)
    const i = this.connections.indexOf(connection)
    if (i >= 0) this.connections.splice(i, 1)
  }

  join (connection, message) {
    if (connection.player) return
    const player = this.state.join(message.name, message.wish)
    if (!player) return this.send(connection, { type: 'refused', reason: 'full' })
    connection.player = player
    connection.last = this.state.view(player)
    this.send(connection, { type: 'welcome', player: Object.assign({}, player), tick: this.state.ticks, state: connection.last })
  }

  leave (connection) {
    if (!connection.player) return
    this.state.leave(connection.player.number)
    connection.player = null
    connection.last = null
  }

  send (connection, message) {
    connection.send(JSON.stringify(message))
  }

  /** One tick now: each player's input and the commands due, the state ticked, each player sent their delta and events. */
  step () {
    const tick = this.state.ticks
    const commands = []
    for (const c of this.connections) {
      if (!c.player) continue
      const due = c.pending.filter((p) => p.tick <= tick)
      c.pending = c.pending.filter((p) => p.tick > tick)
      commands.push(Object.assign({}, c.input, { player: c.player.number, actions: due.map((p) => p.command) }))
    }
    const events = this.state.tick(commands)
    this.update(events)
    return events
  }

  /** Each player sent what changed in their view, and the events meant for them. */
  update (events) {
    for (const c of this.connections) {
      if (!c.player) continue
      const player = this.state.player(c.player.number) || c.player
      const view = this.state.view(player)
      const delta = StateDiff.diff(c.last, view)
      c.last = view
      this.send(c, { type: 'tick', tick: this.state.ticks, delta, events: events.filter((e) => this.state.isFor(e, player)) })
    }
  }

  /** Moves the server's clock on by `seconds`, running the ticks that fall due. Returns how many ran. */
  advance (seconds) {
    this.time += seconds
    let n = 0
    while (this.time >= this.tickTime) {
      this.time -= this.tickTime
      this.step()
      n++
    }
    return n
  }

  /** Ticks on the server's own clock until `stop()`. */
  start () {
    if (this.timer) return
    let last = Date.now()
    this.timer = setInterval(() => {
      const now = Date.now()
      this.advance((now - last) / 1000)
      last = now
    }, Math.max(1, Math.floor(this.tickTime * 500)))
  }

  stop () {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}

export default GameServer
