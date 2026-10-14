import GameClient from '../lib/GameClient.js'

describe('GameClient', () => {
  // A socket with the WebSocket's surface, open from the start, that records what is sent
  function socket () {
    const listeners = {}
    return {
      readyState: 1,
      sent: [],
      addEventListener: (name, fn) => { listeners[name] = fn },
      send (text) { this.sent.push(JSON.parse(text)) },
      deliver: (message) => listeners.message({ data: JSON.stringify(message) })
    }
  }

  it('should join when given its socket, and keep the state it is sent', () => {
    const s = socket()
    const welcomed = jasmine.createSpy('welcomed')
    const client = new GameClient({ socket: s, name: 'Ann', wish: 'red', onWelcome: welcomed })
    expect(s.sent).toEqual([{ type: 'join', name: 'Ann', wish: 'red' }])
    s.deliver({ type: 'welcome', player: { number: 1 }, tick: 5, state: { a: 1 } })
    expect(client.player).toEqual({ number: 1 })
    expect(client.state).toEqual({ a: 1 })
    expect(welcomed).toHaveBeenCalledWith(client)
    client.command({ order: 'go' })
    expect(s.sent[1]).toEqual({ order: 'go', type: 'command', tick: 5 })
  })

  it('should be made before its socket, holding no state and sending nothing until connected', () => {
    const client = new GameClient({ name: 'Ann' })
    expect(client.connected).toBe(false)
    expect(client.state).toBeNull()
    expect(client.player).toBeNull()
    expect(client.fraction()).toEqual(1)
    expect(() => { client.command({ order: 'go' }); client.input({ up: true }); client.act({}); client.leave() }).not.toThrow()
    const s = socket()
    client.connect(s)
    expect(client.connected).toBe(true)
    expect(s.sent).toEqual([{ type: 'join', name: 'Ann' }])
    s.deliver({ type: 'welcome', player: { number: 2 }, tick: 0, state: { b: 2 } })
    expect(client.state).toEqual({ b: 2 })
  })
})
