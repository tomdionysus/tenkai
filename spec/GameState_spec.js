import GameState from '../lib/GameState.js'
import Place from '../lib/Place.js'

describe('GameState', () => {
  // An agent that moves each player's dot by their commands and reports a bump at x 3
  const dots = () => ({
    at: {},
    tick (place, commands) {
      for (const c of commands) {
        this.at[c.player] = (this.at[c.player] || 0) + c.dx
        if (this.at[c.player] === 3) place.emit({ name: 'bump', to: { player: c.player } })
      }
      place.emit({ name: 'tock' })
    },
    snapshot () { return { at: Object.assign({}, this.at) } },
    restore (s) { this.at = Object.assign({}, s.at) }
  })

  it('should number joining players from 1 and refuse past the limit', () => {
    const state = new GameState({ places: [new Place()], maxPlayers: 2 })
    expect(state.join('a').number).toEqual(1)
    expect(state.join('b').number).toEqual(2)
    expect(state.join('c')).toBeNull()
    state.leave(1)
    expect(state.join('d').number).toEqual(1)
    expect(state.players.map((p) => p.name)).toEqual(['d', 'b'])
  })

  it('should let a subclass refuse a player and place them', () => {
    class Game extends GameState {
      joined (player, wish) {
        if (wish === 'nobody') return false
        player.place = 1
      }
    }
    const state = new Game({ places: [new Place(), new Place()], maxPlayers: 3 })
    expect(state.join('a', 'nobody')).toBeNull()
    expect(state.join('b').place).toEqual(1)
  })

  it('should send each player\'s commands to their place, in player order, and mark events with the place', () => {
    const d0 = dots()
    const d1 = dots()
    class Game extends GameState {
      joined (player) { player.place = player.number === 2 ? 1 : 0 }
    }
    const state = new Game({ places: [new Place({ agents: [d0] }), new Place({ agents: [d1] })], maxPlayers: 3 })
    state.join('a')
    state.join('b')
    state.join('c')
    const events = state.tick([{ player: 3, dx: 3 }, { player: 2, dx: 1 }, { player: 1, dx: 2 }])
    expect(d0.at).toEqual({ 1: 2, 3: 3 })
    expect(d1.at).toEqual({ 2: 1 })
    expect(events).toEqual([{ place: 0, name: 'bump', to: { player: 3 } }, { place: 0, name: 'tock' }, { place: 1, name: 'tock' }])
    const [a, b, c] = state.players
    expect(events.filter((e) => state.isFor(e, a)).map((e) => e.name)).toEqual(['tock'])
    expect(events.filter((e) => state.isFor(e, b)).map((e) => e.place)).toEqual([1])
    expect(events.filter((e) => state.isFor(e, c)).map((e) => e.name)).toEqual(['bump', 'tock'])
  })

  it('should snapshot and restore places and players', () => {
    const d = dots()
    const state = new GameState({ places: [new Place({ agents: [d] })], maxPlayers: 2 })
    state.join('a')
    state.tick([{ player: 1, dx: 1 }])
    const s = JSON.parse(JSON.stringify(state.snapshot()))
    state.tick([{ player: 1, dx: 1 }])
    state.leave(1)
    state.restore(s)
    expect(state.ticks).toEqual(1)
    expect(d.at).toEqual({ 1: 1 })
    expect(state.players.length).toEqual(1)
  })
})
