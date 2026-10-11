/**
 * The whole state of a game: its places ({@link Place}), its players, and its tick count, advanced by commands.
 * This is what a {@link GameServer} runs and sends to its clients. It has no canvas, document or sound: anything
 * the clients must show or play comes out of `tick` as events.
 *
 * Players join and leave; each is in one place. Each tick, every player's commands go to their place, the
 * places are ticked in order, and the events are returned, each marked with its place. Subclasses add a game's
 * own rules (`rules(events)`), what a joining player gets (`joined(player, wish)`), and what each player is sent
 * (`view(player)`).
 *
 * @example
const state = new GameState({ places: [new Place({ agents: [world] })], maxPlayers: 3 })
const player = state.join('Ann')
const events = state.tick([{ player: player.number, stick: 'up' }])
 */
class GameState {
  /**
   * @param {object} options
   * @param {Place[]} options.places The places, ticked in this order
   * @param {number} options.maxPlayers How many players may join (default 1)
   */
  constructor (options = {}) {
    this.places = (options.places || []).slice()
    this.maxPlayers = options.maxPlayers || 1
    /** The players: `{ number, name, place }`, place an index into `places`. */
    this.players = []
    /** Ticks run. */
    this.ticks = 0
  }

  /**
   * A player joins, or null when the game is full or `joined` refuses. Players are numbered from 1, the lowest
   * free number first.
   * @param {string} name
   * @param {*} wish What the player asks for (a character, a team), given to `joined`
   */
  join (name, wish) {
    if (this.players.length >= this.maxPlayers) return null
    let number = 1
    while (this.players.some((p) => p.number === number)) number++
    const player = { number, name: name || 'Player ' + number, place: 0 }
    if (this.joined(player, wish) === false) return null
    this.players.push(player)
    this.players.sort((a, b) => a.number - b.number)
    return player
  }

  /** A player leaves. */
  leave (number) {
    const player = this.player(number)
    if (!player) return
    this.players.splice(this.players.indexOf(player), 1)
    this.left(player)
  }

  /** The player with this number, or undefined. */
  player (number) {
    return this.players.find((p) => p.number === number)
  }

  /**
   * One tick. Commands are `{ player, ... }`; they are applied in player order, so the same commands give the
   * same state wherever the game runs. Returns the tick's events, each `{ name, data, to, place }`.
   * @param {object[]} commands
   */
  tick (commands = []) {
    const ordered = commands.slice().sort((a, b) => a.player - b.player)
    const events = []
    this.places.forEach((place, i) => {
      const mine = ordered.filter((c) => {
        const p = this.player(c.player)
        return p && p.place === i
      })
      for (const e of place.tick(mine)) events.push(Object.assign({ place: i }, e))
    })
    this.ticks++
    this.rules(events)
    return events
  }

  /** Whether an event is for a player: for everyone, for everyone in the player's place, or for them alone. */
  isFor (event, player) {
    const to = event.to
    if (!to) return event.place === undefined || event.place === player.place || event.everywhere === true
    if (to.player !== undefined) return to.player === player.number
    if (to.place !== undefined) return to.place === player.place
    return true
  }

  /** The whole state, as plain data. */
  snapshot () {
    return { ticks: this.ticks, players: this.players.map((p) => Object.assign({}, p)), places: this.places.map((p) => p.snapshot()) }
  }

  /** Puts the state back as a snapshot says (the same places, in the same order). */
  restore (snapshot) {
    this.ticks = snapshot.ticks
    this.players = snapshot.players.map((p) => Object.assign({}, p))
    snapshot.places.forEach((s, i) => this.places[i].restore(s))
  }

  /**
   * A player's action, done at once (between ticks): given to the player's place (`place.act(action, player)`).
   * Returns the events it raised, each marked with the place.
   */
  act (player, action) {
    const place = this.places[player.place]
    if (!place || !place.act) return []
    return (place.act(action, player) || []).map((e) => Object.assign({ place: player.place }, e))
  }

  /** What a player is sent each tick (default: everything). A subclass sends less: the player's own place. */
  view (player) {
    return this.snapshot()
  }

  /** A game's rules over a tick's events (default none). */
  rules (events) {}

  /** A player joining: set up their character and place; return false to refuse (default: accept). */
  joined (player, wish) {}

  /** A player gone (default: nothing). */
  left (player) {}
}

export default GameState
