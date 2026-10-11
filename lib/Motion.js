/**
 * Scripted movement: a character moves by running scripts, lists of steps each made of a change in X, Y and Z
 * and the frame to show. Each logic tick either the next step of the running script is tried, or, when the
 * command changes or the script has ended, a new script is chosen for the current animation and command and
 * its first step tried at once. A step is taken only if the world lets the body move; a blocked step is tried
 * again next tick. This is how many older games move their characters (Wreckers, SCUMM's walk scripts), and it
 * keeps movement and the frames shown in step with each other.
 *
 * Motion is logic, run by the game's tick, not by the animation clock: it needs no sheet or canvas, so it runs
 * the same in a test or a headless check as in the browser.
 *
 * @example
const motion = new Motion({
  scripts: [{ steps: [[0, 0, 0, 0]], next: 0 }, { steps: [[1, 0, 0, 1], [1, 0, 0, 2]], next: 0 }],
  table: [[0, 1]],          // animation 0: command 0 stands (script 0), command 1 walks (script 1)
  world,                    // anything with move(body, dx, dy, dz) -> { moved, blocker }
  body
})
motion.setCommand(1)
motion.tick()               // the body moves one step, motion.frame is 1
 */
class Motion {
  /**
   * @param {object} options
   * @param {object[]} options.scripts The scripts: `{ steps: [[dx, dy, dz, frame], ...], next }`, where `next`
   *   is the animation the character is in once the script is chosen (optional: unchanged)
   * @param {Array} options.table Which script each animation and command runs: `table[animation][command]`, a
   *   script's index, or `{ script, reverse }` to run it backwards (optional, if `lookup` is given)
   * @param {function} options.lookup `(animation, command) => { script, reverse }` or null, instead of `table`
   * @param {object} options.world What the body moves in: `move(body, dx, dy, dz)` returning `{ moved, blocker }`
   * @param {object} options.body The body that moves: `{ x, y, z }`
   * @param {number} options.frame The frame shown before any step (default 0)
   * @param {function} options.free `(body, step) => boolean`: a step taken without asking the world (optional)
   */
  constructor (options = {}) {
    this.scripts = options.scripts || []
    this.table = options.table || null
    this.lookup = options.lookup || ((anim, command) => {
      var entry = this.table && this.table[anim] ? this.table[anim][command] : undefined
      if (entry === undefined || entry === null) return null
      return typeof entry === 'object' ? entry : { script: entry, reverse: false }
    })
    this.world = options.world || null
    this.body = options.body || null
    this.free = options.free || null
    /** The current animation. */
    this.anim = 0
    /** The current command. */
    this.command = 0
    /** Whether the command changed since the script was chosen: the next tick chooses again. */
    this.changed = false
    /** The running script, or null. */
    this.script = null
    /** The index of the next step in the script. */
    this.step = 0
    /** Whether the script runs backwards (its steps in reverse order, each negated). */
    this.reverse = false
    /** The frame to show. */
    this.frame = options.frame || 0
    /** Whether this tick's step was refused. */
    this.blocked = false
    /** What refused it, when the world says (another body). */
    this.blocker = null
    /** Where this tick's step was going, refused or not. */
    this.tried = null
    /** Carried by something else (a lift): steps set the frame, the carrier places the body. */
    this.carried = false
    /** Steps go through walls and characters (a door sequence, say). */
    this.ghost = false
    /** Steps still to take without asking the world (only steps that move count down). */
    this.freeSteps = 0
    /** Whether this tick took the script's last step. */
    this.ended = false
  }

  /** Set the command; a change interrupts the running script at the next tick. */
  setCommand (command) {
    if (command !== this.command) {
      this.command = command
      this.changed = true
    }
  }

  /** Start a script for this animation and command at the next tick, even if they are the current ones. */
  force (anim, command) {
    this.anim = anim
    this.command = command
    this.changed = true
  }

  /** Whether the running script has taken all its steps. */
  get finished () {
    return !this.script || this.step >= this.script.steps.length
  }

  /** One logic tick: choose a script if needed, then try its next step. */
  tick () {
    if (this.changed || !this.script || this.step >= this.script.steps.length) {
      this.changed = false
      this.choose()
    }
    if (!this.script) return
    var s = this.script.steps[this.reverse ? this.script.steps.length - 1 - this.step : this.step]
    var sign = this.reverse ? -1 : 1
    this.blocker = null
    if (this.carried) this.blocked = false
    else if (this.freeSteps > 0 || this.ghost) {
      if (!this.ghost && (s[0] || s[1] || s[2])) this.freeSteps--
      this.body.x += s[0] * sign
      this.body.y += s[1] * sign
      this.body.z += s[2] * sign
      this.blocked = false
    } else if (this.free && this.free(this.body, s)) {
      this.body.x += s[0] * sign
      this.body.y += s[1] * sign
      this.body.z += s[2] * sign
      this.blocked = false
    } else {
      var moved = this.world.move(this.body, s[0] * sign, s[1] * sign, s[2] * sign)
      this.blocked = !moved.moved
      this.blocker = moved.blocker || null
    }
    this.tried = { x: this.body.x + (this.blocked ? s[0] * sign : 0), y: this.body.y + (this.blocked ? s[1] * sign : 0), z: this.body.z + (this.blocked ? s[2] * sign : 0) }
    this.ended = false
    if (!this.blocked) {
      this.frame = s[3]
      this.step++
      this.ended = this.step >= this.script.steps.length
    }
  }

  /**
   * The motion's state as plain data, for saving or sending: the running script by its index in `scripts`.
   * `blocker` is left out (it is this tick's only, read straight after `tick`).
   */
  snapshot () {
    return {
      anim: this.anim,
      command: this.command,
      changed: this.changed,
      script: this.script ? this.scripts.indexOf(this.script) : -1,
      step: this.step,
      reverse: this.reverse,
      frame: this.frame,
      blocked: this.blocked,
      tried: this.tried && Object.assign({}, this.tried),
      carried: this.carried,
      ghost: this.ghost,
      freeSteps: this.freeSteps,
      ended: this.ended
    }
  }

  /** Puts the motion back as a snapshot says (the same scripts). */
  restore (s) {
    Object.assign(this, s, { script: s.script >= 0 ? this.scripts[s.script] : null, tried: s.tried && Object.assign({}, s.tried), blocker: null })
  }

  /** Choose the script for the current animation and command, from its first step. */
  choose () {
    var found = this.lookup(this.anim, this.command)
    this.script = found ? (this.scripts[found.script] || null) : null
    this.reverse = !!(found && found.reverse)
    this.step = 0
    if (this.script && this.script.next !== undefined) this.anim = this.script.next
  }
}

export default Motion
