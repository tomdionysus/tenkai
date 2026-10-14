import Scene from './Scene.js'

/**
 * A screen shown over the game: a menu, a map, a dialogue. It is a {@link Scene} (drawn the same way, over
 * everything else while it is shown) that also takes the player's clicks first and has a step of its own. The
 * engine keeps a stack of them ({@link GameEngine#showScreen}); the top visible one is given each click before the
 * game, and every visible one is stepped after the game's own update. A hidden screen (`visible` false) stays on
 * the stack but is neither drawn, given clicks nor stepped.
 *
 * Subclass it and override `click`, `update` and `background` (or `drawContent`), or pass them as options. A
 * screen given `hotspots` (a {@link Hotspots}) takes the clicks on them by default, in its own coordinates (from
 * its `x` and `y`, so a window can be put anywhere, `centre` putting it in the middle). With `release`, its buttons
 * act as most games' do: pressed, dragged and released (the engine passes the top screen its moves and releases).
 * A `modal` screen takes every click while it shows, so nothing under it sees one.
 *
 * @example
const menu = new Screen({
  background: (context) => context.drawImage(menuPicture, 0, 0),
  click: (x, y) => { if (inside(x, y, quitButton)) game.hideScreen(menu); return true },
  update: (dt, input) => { if (input.pressed('quit')) game.hideScreen(menu) }
})
game.showScreen(menu)
const dialogue = new Screen({ hotspots: buttons, release: true, modal: true, width: 200, height: 80 })
dialogue.centre(320, 200)
game.showScreen(dialogue)
 */
class Screen extends Scene {
  /**
   * @param {object} options As a {@link Scene}'s, and:
   * @property {function} click `click(x, y)`: a click in the game's coordinates; true when the screen took it, so the
   * game does not see it (optional)
   * @property {function} update `update(dt, input)`: one step while the screen shows (optional)
   * @property {boolean} under Drawn under the game's `drawOver` (its HUD stays on top), before the other screens;
   * it still takes clicks in its place on the stack (optional, default false)
   * @property {Hotspots} hotspots The screen's buttons, in its own coordinates: the default `click` gives each
   * click to them (optional)
   * @property {boolean} release Its buttons are pressed, dragged and released (Hotspots' mouseDown, mouseMove and
   * mouseUp), not answered at the press (optional, default false)
   * @property {boolean} modal It takes every click while it shows (optional, default false)
   * @property {number} width, height Its size, for `centre` (optional)
   */
  constructor (options = {}) {
    super(options)
    this.hotspots = options.hotspots || null
    /** Drawn under the game's own `drawOver` (a HUD that stays over it), before the other screens. */
    this.under = !!options.under
    this.release = !!options.release
    this.modal = !!options.modal
    this.width = options.width || 0
    this.height = options.height || 0
    /** Where the pointer is, in the screen's own coordinates: set as it is shown, then by each move while it is on top */
    this.pointer = { x: 0, y: 0 }
    if (options.click) this.click = options.click
    if (options.update) this.update = options.update
  }

  /** A point in the game's coordinates in the screen's own (from its top left). */
  local (x, y) {
    return { x: Math.floor(x) - this.x, y: Math.floor(y) - this.y }
  }

  /** Puts the screen in the middle of an area of that size (the game's block, the window). */
  centre (width, height) {
    this.x = Math.floor((width - this.width) / 2)
    this.y = Math.floor((height - this.height) / 2)
  }

  /**
   * A click at (x, y), in the game's coordinates (the engine's `mouseX`, `mouseY`): by default the screen's
   * hotspots', in its own coordinates (see {@link Hotspots#click}, or with `release` {@link Hotspots#mouseDown}).
   * Override it.
   * @returns {boolean} Whether the screen took the click (the game then does not see it)
   */
  click (x, y) {
    var taken = false
    if (this.hotspots) {
      var p = this.local(x, y)
      if (this.release) {
        this.hotspots.mouseDown(p.x, p.y)
        taken = !!this.hotspots.pressed
      } else taken = this.hotspots.click(p.x, p.y)
    }
    return taken || this.modal
  }

  /** The pointer moved, while the screen is on top: where it is now, and a pressed button dragged. */
  mouseMove (x, y) {
    this.pointer = this.local(x, y)
    if (!this.hotspots) return
    this.hotspots.mouseMove(this.pointer.x, this.pointer.y)
  }

  /** The button came up, while the screen is on top: a pressed button is released. */
  mouseUp (x, y) {
    if (!this.hotspots) return
    var p = this.local(x, y)
    this.hotspots.mouseUp(p.x, p.y)
  }

  /** Lets go of any pressed button without acting on it (as the screen goes). */
  letGo () {
    if (this.hotspots) this.hotspots.pressed = null
  }

  /**
   * One step while the screen shows, after the game's own update. Override it.
   * @param {number} dt The step's length in seconds
   * @param {Input} input The engine's input, sampled for this step
   */
  update (dt, input) {}
}

export default Screen
