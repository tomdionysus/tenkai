import StateDiff from './StateDiff.js'

/**
 * Runs a {@link GameState} for its players: ticks it on a clock, takes each player's commands, and sends every
 * player, after each tick, what changed in their view and the events meant for them. It uses no DOM, so the same
 * server runs in the page (reached through a {@link LocalSocket}), in a Worker, or under Node behind real
 * WebSockets.
 *
 * Every message is a JSON string, both ways:
 *
 * - client to server: `{ type: 'join', name, wish }`, `{ type: 'command', tick, ...command }`, `{ type: 'leave' }`
 * - server to client: `{ type: 'welcome', player, tick, state }`, `{ type: 'tick', tick, delta, events }`,
 *   `{ type: 'refused', reason }`
 *
 * A command is applied at the tick it names, or at the next tick run if that has passed. The server's clock is
 * either its own (`start()`) or the caller's (`advance(seconds)`), so a page can tick it in step with its frames.
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
    this.pending = []
    this.time = 0
    this.timer = null
  }

  /**
   * A new connection: `send(text)` delivers a message to its client. Returns the connection, to pass to
   * `receive` and `disconnect`.
   * @param {function} send
   */
  connect (send) {
    const connection = { send, player: null, last: null }
    this.connections.push(connection)
    return connection
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
      command.player = connection.player.number
      this.pending.push({ tick: Math.max(message.tick || 0, this.state.ticks), command })
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

  /** One tick now: the commands due, the state ticked, each player sent their delta and events. */
  step () {
    const tick = this.state.ticks
    const due = this.pending.filter((p) => p.tick <= tick)
    this.pending = this.pending.filter((p) => p.tick > tick)
    const events = this.state.tick(due.map((p) => p.command))
    for (const c of this.connections) {
      if (!c.player) continue
      const player = this.state.player(c.player.number) || c.player
      const view = this.state.view(player)
      const delta = StateDiff.diff(c.last, view)
      c.last = view
      this.send(c, { type: 'tick', tick: this.state.ticks, delta, events: events.filter((e) => this.state.isFor(e, player)) })
    }
    return events
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
