import Place from '../lib/Place.js'

describe('Place', () => {
  // An agent that counts its ticks, remembers its commands and reports every second tick
  const counter = (name) => ({
    name,
    n: 0,
    seen: [],
    tick (place, commands) {
      this.n++
      this.seen.push(commands.length)
      if (this.n % 2 === 0) place.emit({ name: 'even', data: name })
    },
    snapshot () { return { n: this.n } },
    restore (s) { this.n = s.n }
  })

  it('should tick its agents in order, giving them the commands, and return their events', () => {
    const order = []
    const a = { tick: () => order.push('a') }
    const b = { tick: () => order.push('b') }
    const place = new Place({ agents: [a, b] })
    place.tick()
    expect(order).toEqual(['a', 'b'])
    const c = counter('c')
    place.add(c)
    expect(place.tick([{ player: 1 }])).toEqual([])
    expect(place.tick([])).toEqual([{ name: 'even', data: 'c' }])
    expect(c.seen).toEqual([1, 0])
    expect(place.ticks).toEqual(3)
  })

  it('should remove an agent', () => {
    const c = counter('c')
    const place = new Place({ agents: [c] })
    place.remove(c)
    place.tick()
    expect(c.n).toEqual(0)
  })

  it('should snapshot and restore its agents', () => {
    const c = counter('c')
    const place = new Place({ name: 'deck', agents: [c, { tick () {} }] })
    place.tick()
    place.tick()
    const s = place.snapshot()
    expect(s).toEqual({ name: 'deck', ticks: 2, agents: [{ n: 2 }, null] })
    place.tick()
    place.restore(JSON.parse(JSON.stringify(s)))
    expect(c.n).toEqual(2)
    expect(place.ticks).toEqual(2)
  })
})
