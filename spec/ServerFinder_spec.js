import ServerFinder from '../lib/ServerFinder.js'
import ServerConfig from '../lib/ServerConfig.js'

describe('ServerFinder', () => {
  // A storage that keeps items in a map
  function storage () {
    const items = new Map()
    return { getItem: (k) => items.get(k) || null, setItem: (k, v) => items.set(k, v) }
  }

  // A socket factory where only the addresses in `answering` open (asynchronously); the rest fail
  function sockets (answering) {
    const made = []
    const socket = (address) => {
      const listeners = {}
      const s = { address, close () {}, addEventListener: (name, fn) => { listeners[name] = fn } }
      made.push(address)
      setTimeout(() => (answering.includes(address) ? listeners.open() : listeners.error()), 0)
      return s
    }
    return { socket, made }
  }

  // A config screen that answers with the addresses given, in turn, recording what it was told
  function config (answers) {
    const told = []
    return {
      told,
      ask: ({ message, address }) => { told.push('ask: ' + message + ' [' + address + ']'); return Promise.resolve(answers.shift()) },
      say: (message) => told.push('say: ' + message),
      hide: () => told.push('hide')
    }
  }

  const location = { protocol: 'http:', host: 'example.org:8053', hostname: 'example.org', search: '?server=ws://other:1/game' }

  it('should try the URL\'s address, the page\'s own path and the last chosen, without repeats', () => {
    const s = storage()
    const finder = new ServerFinder({ key: 'k', location, storage: s })
    expect(finder.candidates()).toEqual(['ws://other:1/game', 'ws://example.org:8053/game'])
    finder.save('ws://saved:2/game')
    expect(finder.saved()).toBe('ws://saved:2/game')
    expect(finder.candidates()).toEqual(['ws://other:1/game', 'ws://example.org:8053/game', 'ws://saved:2/game'])
    finder.save('ws://example.org:8053/game')
    const plain = new ServerFinder({ key: 'k', location: { protocol: 'https:', host: 'a.b', hostname: 'a.b', search: '?server=nonsense' }, storage: s, path: '/play' })
    expect(plain.candidates()).toEqual(['wss://a.b/play', 'ws://example.org:8053/game', 'wss://a.b:8053/play'])
    // A page from a development server on another port also tries the game's port beside it
    const dev = new ServerFinder({ key: 'd', location: { protocol: 'http:', host: 'h:8052', hostname: 'h', search: '' }, storage: storage() })
    expect(dev.candidates()).toEqual(['ws://h:8052/game', 'ws://h:8053/game'])
  })

  it('should keep going without a storage that works', () => {
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    const finder = new ServerFinder({ key: 'k', location, storage: broken })
    expect(() => finder.save('ws://x/game')).not.toThrow()
    expect(finder.saved()).toBeNull()
  })

  it('should find the first candidate that answers', async () => {
    const net = sockets(['ws://example.org:8053/game'])
    const finder = new ServerFinder({ key: 'k', location, storage: storage(), socket: net.socket })
    const found = await finder.find()
    expect(found.address).toBe('ws://example.org:8053/game')
    expect(found.socket.address).toBe('ws://example.org:8053/game')
    expect(net.made).toEqual(['ws://other:1/game', 'ws://example.org:8053/game'])
  })

  it('should ask the player until an address answers, and keep it', async () => {
    const net = sockets(['ws://good:3/game'])
    const screen = config(['ws://bad:3/game', 'ws://good:3/game'])
    // (the suggestion, tried first, does not answer)
    const s = storage()
    const finder = new ServerFinder({ key: 'k', location, storage: s, socket: net.socket, config: screen, suggestion: 'ws://try:1/game' })
    const found = await finder.find()
    expect(found.address).toBe('ws://good:3/game')
    expect(s.getItem('k')).toBe('ws://good:3/game')
    expect(screen.told).toEqual([
      'ask: No game server answered at this page\'s own address. Enter the server\'s address. [ws://try:1/game]',
      'say: Connecting to ws://bad:3/game ...',
      'ask: Could not connect to ws://bad:3/game. [ws://bad:3/game]',
      'say: Connecting to ws://good:3/game ...',
      'hide'
    ])
  })

  it('should give up on a socket that does not open in time', async () => {
    const finder = new ServerFinder({ key: 'k', location, storage: storage(), wait: 5, socket: () => ({ close () {}, addEventListener () {} }) })
    expect(await finder.open('ws://silent/game')).toBeNull()
    const throwing = new ServerFinder({ key: 'k', location, storage: storage(), socket: () => { throw new Error('bad address') } })
    expect(await throwing.open('nonsense')).toBeNull()
  })

  it('should ask again once the connection is lost, and keep the answer', async () => {
    const screen = config(['ws://new:4/game'])
    const s = storage()
    const finder = new ServerFinder({ key: 'k', location, storage: s, config: screen })
    expect(await finder.lost('ws://old:4/game')).toBe('ws://new:4/game')
    expect(s.getItem('k')).toBe('ws://new:4/game')
    expect(screen.told).toEqual(['ask: The connection to the game server was lost. [ws://old:4/game]'])
  })
})

describe('ServerConfig', () => {
  it('should read what the player typed as an address', () => {
    expect(ServerConfig.address('  192.168.1.10:8053/game ')).toBe('ws://192.168.1.10:8053/game')
    expect(ServerConfig.address('wss://host/game')).toBe('wss://host/game')
    expect(ServerConfig.address('   ')).toBeNull()
  })
})
