/**
 * CommandList runs an animation written as a list of commands, as old games script their explosions, smoke and
 * buildings' lights: show a picture, wait, wait a random time, go back, stop. Each command is `[name, parameter]`;
 * the game says what each name does (`handlers`), using the list's own `wait`, `goto` and `stop`. Commands run one
 * after another until one waits; `tick(now)` runs whatever is due by the time `now` (ticks, or any clock that only
 * goes forward), or at most `perTick` commands, as games that step each list one command a pass of their loop do.
 * A command with no handler, or running off the end, stops the list.
 *
 * @example
const smoke = { sprite: 0 }
const list = new CommandList({
  commands: [['SHOW', 180], ['WAIT', 3], ['SHOW', 181], ['WAIT_RANDOM', 6], ['LOOP', 0]],
  handlers: {
    SHOW: (c, n) => { smoke.sprite = n },
    WAIT: (c, n, now) => c.wait(n, now),
    WAIT_RANDOM: (c, n, now) => c.wait(c.random(n + 1), now),
    LOOP: (c, i) => c.goto(i)
  }
})
// each tick:
list.tick(time)
 */
class CommandList {
  /**
   * @param {object} options
   * @property {Array[]} commands `[name, parameter]` each
   * @property {object} handlers By name: `(list, parameter, now) => {}`
   * @property {number} now The time it starts at (default 0): the first commands run at the first tick from then
   * @property {function} random A generator of numbers from 0 up to 1 (default Math.random)
   * @property {number} perTick The most commands a tick runs (default all that are due)
   */
  constructor (options) {
    this.commands = options.commands
    this.handlers = options.handlers || {}
    this.rng = options.random || Math.random
    this.current = 0
    this.due = options.now || 0
    this.done = false
    this.perTick = options.perTick || Infinity
  }

  /**
   * Runs the commands due by `now`, until one waits, the list stops or `perTick` have run. Returns whether it is
   * still running.
   */
  tick (now) {
    for (var n = 0; n < this.perTick && !this.done && this.due <= now; n++) this.step(now)
    return !this.done
  }

  /** Runs the next command. */
  step (now) {
    var command = this.commands[this.current++]
    var handler = command && this.handlers[command[0]]
    if (!handler) return this.stop()
    handler(this, command[1], now)
  }

  /** The next command waits `ticks` from `now`. */
  wait (ticks, now) {
    this.due = now + ticks
  }

  /** The next command is number `i`. */
  goto (i) {
    this.current = i
  }

  /** Nothing more runs. */
  stop () {
    this.done = true
  }

  /** A whole number from 0 up to `n` (not including it). */
  random (n) {
    return Math.floor(this.rng() * n)
  }
}

export default CommandList
