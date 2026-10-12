import http from 'http'
import GameServer from '../lib/GameServer.js'
import GameClient from '../lib/GameClient.js'
import GameState from '../lib/GameState.js'
import Place from '../lib/Place.js'
import WebSocketServer from '../lib/node/WebSocketServer.js'

describe('WebSocketServer (Node)', () => {
  const until = (test) => new Promise((resolve) => {
    const check = () => test() ? resolve() : setTimeout(check, 2)
    check()
  })

  it('should read frames split across chunks, masked, of every length form', () => {
    const make = (payload) => {
      const mask = Buffer.from([1, 2, 3, 4])
      const n = payload.length
      const head = n < 126 ? Buffer.from([0x81, 0x80 | n]) : Buffer.from([0x81, 0x80 | 126, n >> 8, n & 255])
      const body = Buffer.from(payload)
      for (let i = 0; i < body.length; i++) body[i] ^= mask[i & 3]
      return Buffer.concat([head, mask, body])
    }
    const small = make(Buffer.from('hello'))
    expect(WebSocketServer.frame(small.subarray(0, 4))).toBeNull()
    expect(WebSocketServer.frame(small).payload.toString()).toEqual('hello')
    const big = make(Buffer.alloc(300, 'x'))
    const f = WebSocketServer.frame(big)
    expect(f.payload.length).toEqual(300)
    expect(f.size).toEqual(big.length)
  })

  it('should carry a game between a GameServer and a GameClient on a real WebSocket', async () => {
    const agent = {
      n: 0,
      tick (place, commands) { for (const c of commands) this.n += c.hold || 0 },
      snapshot () { return { n: this.n, text: 'x'.repeat(70000) } },
      restore (s) { this.n = s.n }
    }
    const game = new GameServer({ state: new GameState({ places: [new Place({ agents: [agent] })] }), tickTime: 0.1 })
    const server = http.createServer()
    const sockets = new WebSocketServer({ http: server, server: game, path: '/game' })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const client = new GameClient({ socket: new WebSocket('ws://127.0.0.1:' + server.address().port + '/game'), name: 'Ann' })
    await until(() => client.player)
    expect(client.state.places[0].agents[0].text.length).toEqual(70000)
    client.input({ hold: 2 })
    await until(() => game.connections[0].input.hold === 2)
    game.step()
    await until(() => client.tick === 1)
    expect(client.state.places[0].agents[0].n).toEqual(2)
    client.socket.close()
    await until(() => game.state.players.length === 0)
    sockets.close()
    await new Promise((resolve) => server.close(resolve))
  })

  it('should close every client when it closes, before its promise settles', async () => {
    const game = new GameServer({ state: new GameState({ places: [new Place({ agents: [] })] }), tickTime: 0.1 })
    const server = http.createServer()
    const sockets = new WebSocketServer({ http: server, server: game, path: '/game' })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const closed = []
    const client = new GameClient({ socket: new WebSocket('ws://127.0.0.1:' + server.address().port + '/game'), name: 'Ann', onClose: (e) => closed.push(e.code) })
    await until(() => client.player)
    await sockets.close()
    await until(() => closed.length === 1)
    expect(closed[0]).toEqual(1001)
    await new Promise((resolve) => server.close(resolve))
  })
})
