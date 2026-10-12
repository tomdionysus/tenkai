import StateDiff from './StateDiff.js'

/**
 * The client side of a game run by a server (the game's own, outside Tenkai: Tenkai is a client-side framework):
 * it joins through a socket, sends its player's commands, and keeps the last two states it was sent, so the game
 * can draw between them. It is written against the browser `WebSocket`'s surface only, so it takes a real
 * `WebSocket` or anything with its surface. The protocol is JSON: `join`, `input`, `command`, `act` and `leave`
 * out; `welcome`, `tick` (a {@link StateDiff} patch and events) and `refused` in.
 *
 * @example
const client = new GameClient({ socket: new WebSocket('ws://host:8053/game'), name: 'Ann', wish: 'red' })
client.onEvent = (event) => sound.play(event.data)
// each frame:
client.command({ stick: 'up' })
draw(client.previous, client.state)
 */
class GameClient {
  /**
   * @param {object} options
   * @param {object} options.socket A `WebSocket`, or anything with its surface
   * @param {string} options.name The player's name
   * @param {*} options.wish What the player asks for on joining (a character, a team)
   * @param {number} options.tickTime Seconds a server tick lasts, for {@link GameClient#fraction} (optional)
   * @param {function} options.now The time in milliseconds (default `performance.now`, else `Date.now`)
   */
  constructor (options = {}) {
    this.socket = options.socket
    this.name = options.name || ''
    this.wish = options.wish
    /** The player, once welcomed: `{ number, name, place }`. */
    this.player = null
    /** The last state sent, and the one before it. */
    this.state = null
    this.previous = null
    /** The tick the state is at. */
    this.tick = 0
    this.tickTime = options.tickTime || 0
    this.now = options.now || (typeof performance !== 'undefined' ? () => performance.now() : () => Date.now())
    /** When the last new tick arrived (by `now`). */
    this.tickedAt = this.now()
    /** Why the server refused, if it did. */
    this.refused = null
    this.onWelcome = options.onWelcome || null
    this.onTick = options.onTick || null
    this.onEvent = options.onEvent || null
    this.onClose = options.onClose || null
    this.socket.addEventListener('message', (e) => this.receive(e.data))
    this.socket.addEventListener('close', (e) => {
      if (this.onClose) this.onClose(e)
    })
    // Joining last: a socket that delivers at once may answer before the constructor returns
    const join = () => this.send({ type: 'join', name: this.name, wish: this.wish })
    if (this.socket.readyState === 1) join()
    else this.socket.addEventListener('open', join)
  }

  receive (text) {
    const message = JSON.parse(text)
    if (message.type === 'welcome') {
      this.player = message.player
      this.state = message.state
      this.previous = message.state
      this.tick = message.tick
      this.tickedAt = this.now()
      if (this.onWelcome) this.onWelcome(this)
    } else if (message.type === 'tick') {
      // A message at the same tick (after an action) changes the state but starts no new tick
      if (message.tick !== this.tick) this.tickedAt = this.now()
      this.previous = this.state
      this.state = StateDiff.apply(this.state, message.delta)
      this.tick = message.tick
      if (this.onEvent) for (const e of message.events) this.onEvent(e)
      if (this.onTick) this.onTick(this, message.events)
    } else if (message.type === 'refused') {
      this.refused = message.reason
    }
  }

  /**
   * How far the game is into the next tick, 0 to 1, by the time since the last tick arrived: the fraction of the
   * way to draw things from their places at the tick before to their places now (see {@link Trails}). 1 without a
   * `tickTime`.
   */
  fraction () {
    if (!this.tickTime) return 1
    return Math.max(0, Math.min(1, (this.now() - this.tickedAt) / 1000 / this.tickTime))
  }

  /** Sends a command for the next tick, once: any plain fields (an order, a choice). */
  command (fields) {
    if (!this.player) return
    this.send(Object.assign({}, fields, { type: 'command', tick: this.tick }))
  }

  /** What the player holds now (a stick, a fire button): sent when it changes; the server gives it to every tick. */
  input (fields) {
    if (!this.player) return
    const text = JSON.stringify(fields)
    if (text === this.lastInput) return
    this.lastInput = text
    this.send({ type: 'input', input: fields })
  }

  /** An action, done by the server at once (between ticks); the new state follows as a tick message. */
  act (action) {
    if (!this.player) return
    this.send({ type: 'act', action })
  }

  /** Leaves the game (the socket stays open). */
  leave () {
    this.send({ type: 'leave' })
    this.player = null
  }

  send (message) {
    if (this.socket.readyState === 1) this.socket.send(JSON.stringify(message))
  }
}

export default GameClient
