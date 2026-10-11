import GameServer from '../lib/GameServer.js'
import GameClient from '../lib/GameClient.js'
import GameState from '../lib/GameState.js'
import LocalSocket from '../lib/LocalSocket.js'
import Place from '../lib/Place.js'

describe('GameServer, GameClient and LocalSocket', () => {
  // Messages wait in a queue until flushed, so the specs see exactly when each arrives
  const queue = []
  const schedule = (fn) => queue.push(fn)
  const flush = () => { while (queue.length) queue.shift()() }

  // Each player's counter goes up by their commands' `add`; a 'big' event goes to a player passing 10
  const counters = () => ({
    n: {},
    tick (place, commands) {
      for (const c of commands) {
        this.n[c.player] = (this.n[c.player] || 0) + c.add
        if (this.n[c.player] > 10) place.emit({ name: 'big', to: { player: c.player } })
      }
    },
    snapshot () { return { n: Object.assign({}, this.n) } },
    restore (s) { this.n = s.n }
  })
  const game = (maxPlayers = 3) => {
    const agent = counters()
    const state = new GameState({ places: [new Place({ agents: [agent] })], maxPlayers })
    return { agent, state, server: new GameServer({ state, tickTime: 0.1 }) }
  }

  beforeEach(() => { queue.length = 0 })

  it('should open later, not at once, with the WebSocket surface', () => {
    const { server } = game()
    const socket = new LocalSocket(server, { schedule })
    expect(socket.readyState).toEqual(LocalSocket.CONNECTING)
    expect(() => socket.send('x')).toThrow()
    let opened = false
    socket.onopen = () => { opened = true }
    flush()
    expect(opened).toBe(true)
    expect(socket.readyState).toEqual(1)
  })

  it('should welcome a client with its player and the state, then send a delta each tick', () => {
    const { server, agent } = game()
    const client = new GameClient({ socket: new LocalSocket(server, { schedule }), name: 'Ann' })
    flush()
    expect(client.player).toEqual({ number: 1, name: 'Ann', place: 0 })
    expect(client.state.places[0].agents[0]).toEqual({ n: {} })
    client.command({ add: 4 })
    flush()
    expect(server.advance(0.25)).toEqual(2)
    expect(agent.n).toEqual({ 1: 4 })
    flush()
    expect(client.tick).toEqual(2)
    expect(client.state.places[0].agents[0]).toEqual({ n: { 1: 4 } })
    expect(client.previous.places[0].agents[0]).toEqual({ n: { 1: 4 } })
    expect(client.state).toEqual(JSON.parse(JSON.stringify(server.state.snapshot())))
  })

  it('should give each player only their own events, and refuse a player past the limit', () => {
    const { server } = game(2)
    const a = new GameClient({ socket: new LocalSocket(server, { schedule }), name: 'a' })
    const b = new GameClient({ socket: new LocalSocket(server, { schedule }), name: 'b' })
    const c = new GameClient({ socket: new LocalSocket(server, { schedule }), name: 'c' })
    const got = { a: [], b: [] }
    a.onEvent = (e) => got.a.push(e.name)
    b.onEvent = (e) => got.b.push(e.name)
    flush()
    expect(c.refused).toEqual('full')
    b.command({ add: 11 })
    a.command({ add: 1 })
    flush()
    server.step()
    flush()
    expect(got).toEqual({ a: [], b: ['big'] })
  })

  it('should drop the player when the socket closes', () => {
    const { server, state } = game()
    const socket = new LocalSocket(server, { schedule })
    const client = new GameClient({ socket, name: 'a' })
    let closed = null
    client.onClose = (e) => { closed = e.code }
    flush()
    expect(state.players.length).toEqual(1)
    socket.close()
    flush()
    expect(state.players.length).toEqual(0)
    expect(closed).toEqual(1000)
    expect(socket.readyState).toEqual(LocalSocket.CLOSED)
  })

  it('should deliver on a new task by default', (done) => {
    const { server } = game()
    const socket = new LocalSocket(server)
    const client = new GameClient({ socket, name: 'a' })
    expect(client.player).toBeNull()
    client.onWelcome = () => {
      expect(client.player.number).toEqual(1)
      done()
    }
  })
})
