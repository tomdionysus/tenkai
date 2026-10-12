import Trails from '../lib/Trails.js'
import GameClient from '../lib/GameClient.js'

describe('Trails', () => {
  it('should draw a thing seen for the first time where it is', () => {
    const trails = new Trails()
    trails.tick([['a', { x: 4, y: 6 }]])
    expect(trails.between('a', { x: 4, y: 6 }, 0.5)).toEqual({ x: 4, y: 6, z: 0 })
    expect(trails.between('unknown', { x: 1, y: 2, z: 3 }, 0.5)).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('should slide a thing from where it was at the tick before to where it is', () => {
    const trails = new Trails()
    trails.tick([['a', { x: 0, y: 0, z: 0 }]])
    trails.tick([['a', { x: 10, y: -4, z: 2 }]])
    const now = { x: 10, y: -4, z: 2 }
    expect(trails.between('a', now, 0)).toEqual({ x: 0, y: 0, z: 0 })
    expect(trails.between('a', now, 0.5)).toEqual({ x: 5, y: -2, z: 1 })
    expect(trails.between('a', now, 1)).toEqual(now)
  })

  it('should copy positions, so a body moved later does not move its trail', () => {
    const trails = new Trails()
    const body = { x: 0, y: 0, z: 0 }
    trails.tick([['a', body]])
    body.x = 8
    trails.tick([['a', body]])
    expect(trails.from('a', body)).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('should forget things not given at a tick, and everything when cleared', () => {
    const trails = new Trails()
    trails.tick([['a', { x: 0, y: 0 }], ['b', { x: 0, y: 0 }]])
    trails.tick([['a', { x: 2, y: 0 }]])
    trails.tick([['a', { x: 4, y: 0 }], ['b', { x: 6, y: 0 }]])
    expect(trails.from('a', null)).toEqual({ x: 2, y: 0, z: 0 })
    expect(trails.from('b', { x: 6, y: 0 })).toEqual({ x: 6, y: 0, z: 0 })
    trails.clear()
    expect(trails.between('a', { x: 4, y: 0 }, 0.5)).toEqual({ x: 4, y: 0, z: 0 })
  })
})

describe('GameClient fraction', () => {
  // A socket that is already open and records what is sent
  function socket () {
    const listeners = {}
    return {
      readyState: 1,
      sent: [],
      send (text) { this.sent.push(JSON.parse(text)) },
      addEventListener (name, fn) { listeners[name] = fn },
      deliver (message) { listeners.message({ data: JSON.stringify(message) }) }
    }
  }

  it('should say how far the game is into the next tick, by the time since a new tick arrived', () => {
    let time = 1000
    const s = socket()
    const client = new GameClient({ socket: s, name: 'Ann', tickTime: 0.1, now: () => time })
    s.deliver({ type: 'welcome', player: { number: 0 }, state: { n: 0 }, tick: 3 })
    expect(client.fraction()).toBe(0)
    time += 50
    expect(client.fraction()).toBeCloseTo(0.5)
    time += 500
    expect(client.fraction()).toBe(1)
    s.deliver({ type: 'tick', tick: 4, events: [] })
    expect(client.fraction()).toBe(0)
    time += 25
    // A message at the same tick (after an action) does not start a new one
    s.deliver({ type: 'tick', tick: 4, events: [] })
    expect(client.fraction()).toBeCloseTo(0.25)
  })

  it('should be 1 without a tick time', () => {
    const client = new GameClient({ socket: socket(), name: 'Ann' })
    expect(client.fraction()).toBe(1)
  })
})
