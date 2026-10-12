import Scene from './Scene.js'

/**
 * A screen shown over the game: a menu, a map, a dialogue. It is a {@link Scene} (drawn the same way, over
 * everything else while it is shown) that also takes the player's clicks first and has a step of its own. The
 * engine keeps a stack of them ({@link GameEngine#showScreen}); the top visible one is given each click before the
 * game, and every visible one is stepped after the game's own update. A hidden screen (`visible` false) stays on
 * the stack but is neither drawn, given clicks nor stepped.
 *
 * Subclass it and override `click`, `update` and `background` (or `drawContent`), or pass them as options. A
 * screen given `hotspots` (a {@link Hotspots}) takes the clicks on them by default.
 *
 * @example
const menu = new Screen({
  background: (context) => context.drawImage(menuPicture, 0, 0),
  click: (x, y) => { if (inside(x, y, quitButton)) game.hideScreen(menu); return true },
  update: (dt, input) => { if (input.pressed('quit')) game.hideScreen(menu) }
})
game.showScreen(menu)
 */
class Screen extends Scene {
  /**
   * @param {object} options As a {@link Scene}'s, and:
   * @property {function} click `click(x, y)`: a click in the game's coordinates; true when the screen took it, so the
   * game does not see it (optional)
   * @property {function} update `update(dt, input)`: one step while the screen shows (optional)
   * @property {Hotspots} hotspots The screen's buttons: the default `click` gives each click to them (optional)
   */
  constructor (options = {}) {
    super(options)
    this.hotspots = options.hotspots || null
    if (options.click) this.click = options.click
    if (options.update) this.update = options.update
  }

  /**
   * A click at (x, y), in the game's coordinates (the engine's `mouseX`, `mouseY`): by default the screen's
   * hotspots' (see {@link Hotspots#click}). Override it.
   * @returns {boolean} Whether the screen took the click (the game then does not see it)
   */
  click (x, y) { return this.hotspots ? this.hotspots.click(x, y) : false }

  /**
   * One step while the screen shows, after the game's own update. Override it.
   * @param {number} dt The step's length in seconds
   * @param {Input} input The engine's input, sampled for this step
   */
  update (dt, input) {}
}

export default Screen
