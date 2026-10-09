/**
 * Input is the keyboard, sampled once per game step. Keys are bound to named actions, so game code asks
 * about `'jump'` rather than `'KeyX'`, and one action can have several keys.
 *
 * Within a step, `down` says whether an action is held, `pressed` and `released` whether it went down or
 * up since the previous step, and `latest` which of several held actions was pressed most recently, which
 * is how a direction pad should feel. A key that is not bound can be asked about by its code.
 *
 * Every {@link GameEngine} has one, as `game.input`.
 *
 * @example
game.input.bind({ left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], fire: ['Space'] })
// in update():
if (game.input.pressed('fire')) shoot()
player.x += game.input.axis('left', 'right') * speed * dt
 */
class Input {
  /**
   * @param {object} options
   * @param {EventTarget} options.target Where to listen for keys (optional, default window)
   * @param {object} options.bindings Initial bindings (optional, see [bind()]{@link Input#bind})
   */
  constructor (options = {}) {
    this.bindings = {}
    this._codes = {}
    this._held = new Map()
    this._pressed = new Set()
    this._released = new Set()
    this._queuedDown = new Set()
    this._queuedUp = new Set()
    this._lastPress = {}
    this._pressStep = {}
    this._doubleTapped = new Set()
    this.step = 0
    this._order = 0
    this.doubleTapSteps = 14
    if (options.bindings) this.bind(options.bindings)

    var target = options.target || (typeof window !== 'undefined' ? window : null)
    if (target) {
      target.addEventListener('keydown', (e) => this.keyDown(e))
      target.addEventListener('keyup', (e) => this.keyUp(e))
      target.addEventListener('blur', () => this.releaseAll())
    }
  }

  /**
   * Bind keys to actions. Adds to any existing bindings.
   * @param {object} bindings `{ action: ['KeyCode', ...] }`, using `KeyboardEvent.code` values
   */
  bind (bindings) {
    for (var action in bindings) {
      this.bindings[action] = bindings[action].slice()
      for (var code of bindings[action]) this._codes[code] = action
    }
    return this
  }

  // The action a key code belongs to, or the code itself if it is not bound
  _action (code) {
    return this._codes[code] || code
  }

  /**
   * Handle a key going down. Called by the listener; call it yourself to feed input from elsewhere, such as
   * on-screen buttons, with any object that has a `code`.
   */
  keyDown (e) {
    var action = this._action(e.code)
    if (this._codes[e.code] && e.preventDefault) e.preventDefault()
    if (e.repeat || this._held.has(action)) return
    this._held.set(action, ++this._order)
    this._queuedDown.add(action)
  }

  /** Handle a key coming up. */
  keyUp (e) {
    var action = this._action(e.code)
    if (!this._held.has(action)) return
    this._held.delete(action)
    this._queuedUp.add(action)
  }

  /** Release everything, as when the window loses focus. */
  releaseAll () {
    for (var action of this._held.keys()) this._queuedUp.add(action)
    this._held.clear()
  }

  /** Take the key changes since the last step. The {@link GameEngine} calls this at the start of each step. */
  beginStep () {
    this.step++
    this._pressed = this._queuedDown
    this._released = this._queuedUp
    this._queuedDown = new Set()
    this._queuedUp = new Set()
    this._doubleTapped = new Set()
    for (var action of this._pressed) {
      if (this.step - (this._pressStep[action] || -Infinity) <= this.doubleTapSteps) this._doubleTapped.add(action)
      this._pressStep[action] = this.step
    }
  }

  /** Whether an action is held. */
  down (action) { return this._held.has(action) }

  /** Whether an action went down since the previous step. */
  pressed (action) { return this._pressed.has(action) }

  /** Whether an action came up since the previous step. */
  released (action) { return this._released.has(action) }

  /** Whether an action was pressed this step within `doubleTapSteps` steps of the previous press. */
  doubleTapped (action) { return this._doubleTapped.has(action) }

  /**
   * Of the given actions, the one held that was pressed most recently, or null. With the four directions,
   * this makes a newly pressed direction win while an earlier one is still held.
   */
  latest (...actions) {
    var best = null
    var order = -1
    for (var action of actions) {
      var o = this._held.get(action)
      if (o !== undefined && o > order) { best = action; order = o }
    }
    return best
  }

  /** -1, 0 or 1 from a pair of opposing actions, such as `axis('left', 'right')`. */
  axis (negative, positive) {
    return (this.down(positive) ? 1 : 0) - (this.down(negative) ? 1 : 0)
  }
}

module.exports = Input
