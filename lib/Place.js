/**
 * A place in a game: one level, room, map or station, with its own agents, ticked together in a fixed order.
 * A game's state ({@link GameState}) holds one or more places and ticks them all.
 *
 * An agent is any object with `tick(place, commands)`, and, to be saved and sent, `snapshot()` and
 * `restore(snapshot)`. Agents report what happened with `place.emit(event)`; a tick returns those events.
 * A place knows nothing of players or of other places; it is logic only (no canvas, no document), so it runs
 * the same in a spec, a Worker or a server as in the page.
 *
 * @example
const place = new Place({ name: 'deck', agents: [doors, aliens, lifts] })
const events = place.tick([{ player: 1, stick: 'up' }])
 */
class Place {
  /**
   * @param {object} options
   * @param {string} options.name The place's name (optional)
   * @param {object[]} options.agents The agents, in the order they are ticked
   */
  constructor (options = {}) {
    this.name = options.name || ''
    this.agents = (options.agents || []).slice()
    this.events = []
    /** Ticks run. */
    this.ticks = 0
  }

  /** Adds an agent, ticked after those already here. */
  add (agent) {
    this.agents.push(agent)
    return agent
  }

  /** Removes an agent. */
  remove (agent) {
    const i = this.agents.indexOf(agent)
    if (i >= 0) this.agents.splice(i, 1)
  }

  /** Reports an event from an agent: `{ name, data, to }` (to: omitted for everyone here, or `{ player }`). */
  emit (event) {
    this.events.push(event)
  }

  /**
   * One tick: every agent's `tick(place, commands)` in order. Returns the events reported during it.
   * @param {object[]} commands This tick's commands for this place
   */
  tick (commands = []) {
    this.events = []
    for (const agent of this.agents.slice()) agent.tick(this, commands)
    this.ticks++
    const events = this.events
    this.events = []
    return events
  }

  /** The place's state: its tick count and each agent's snapshot, in order. */
  snapshot () {
    return { name: this.name, ticks: this.ticks, agents: this.agents.map((a) => (a.snapshot ? a.snapshot() : null)) }
  }

  /** Puts the agents back as a snapshot of this place says (the same agents, in the same order). */
  restore (snapshot) {
    this.ticks = snapshot.ticks
    snapshot.agents.forEach((s, i) => {
      if (s !== null && this.agents[i] && this.agents[i].restore) this.agents[i].restore(s)
    })
  }
}

export default Place
