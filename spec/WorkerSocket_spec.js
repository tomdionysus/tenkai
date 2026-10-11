import GameServer from '../lib/GameServer.js'
import GameClient from '../lib/GameClient.js'
import GameState from '../lib/GameState.js'
import WorkerSocket from '../lib/WorkerSocket.js'
import Place from '../lib/Place.js'

describe('WorkerSocket and GameServer.attach', () => {
  // Each player's counter goes up every tick by what they hold
  const counters = () => ({
    n: {},
    tick (place, commands) {
      for (const c of commands) if (c.hold) this.n[c.player] = (this.n[c.player] || 0) + c.hold
    },
    snapshot () { return { n: Object.assign({}, this.n) } },
    restore (s) { this.n = s.n }
  })
  const until = (test) => new Promise((resolve) => {
    const check = () => test() ? resolve() : setTimeout(check, 1)
    check()
  })

  it('should connect a client to a server across a message port, with the WebSocket surface', async () => {
    const agent = counters()
    const server = new GameServer({ state: new GameState({ places: [new Place({ agents: [agent] })], maxPlayers: 2 }), tickTime: 0.1 })
    const channel = new MessageChannel()
    server.attach(channel.port2)
    const socket = new WorkerSocket(channel.port1)
    expect(socket.readyState).toEqual(WorkerSocket.CONNECTING)
    const client = new GameClient({ socket, name: 'Ann' })
    await until(() => client.player)
    expect(socket.readyState).toEqual(WorkerSocket.OPEN)
    expect(client.player.number).toEqual(1)
    client.input({ hold: 5 })
    await until(() => server.connections[0].input.hold === 5)
    server.step()
    await until(() => client.tick === 1)
    expect(client.state.places[0].agents[0]).toEqual({ n: { 1: 5 } })
    socket.close()
    await until(() => server.state.players.length === 0)
    channel.port1.close()
    channel.port2.close()
  })
})
