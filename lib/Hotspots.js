/**
 * Hotspots are clickable regions of the screen, each with a cursor and handlers for click, press, drag
 * and release, for point-and-click games. Bind them to a {@link GameEngine} to receive its mouse events,
 * and draw the matching cursor with a {@link Cursor}.
 *
 * A hotspot's `enabled` and `cursor` may be functions, so they can follow game state.
 *
 * @example
const hotspots = new Hotspots()
hotspots.add({ rect: [214, 0, 525, 332], cursor: 'forward', onClick: () => goTo('path') })
hotspots.add({ circle: [320, 222, 74], cursor: 'hand', enabled: () => !doorOpen, onClick: openDoor })
hotspots.bind(game)
 */
class Hotspots {
  constructor () {
    this.list = []
    this.pressed = null
  }

  /**
   * Add a hotspot. Earlier hotspots win where they overlap.
   * @param {object} spot
   * @param {number[]} spot.rect [left, top, right, bottom], right and bottom exclusive
   * @param {number[]} spot.circle [x, y, radius], instead of rect
   * @param {function} spot.contains (x, y) => boolean, instead of rect or circle
   * @param {*} spot.cursor A cursor id, or a function returning one (optional)
   * @param {boolean|function} spot.enabled (optional, default true)
   * @param {function} spot.onClick Called with the spot on release over a pressed spot (optional)
   * @param {function} spot.onDown Called on press (optional)
   * @param {function} spot.onDrag Called on mouse movement while pressed (optional)
   * @param {function} spot.onUp Called on release, wherever the mouse is (optional)
   * @returns {object} The hotspot
   */
  add (spot) {
    this.list.push(spot)
    return spot
  }

  /** Remove every hotspot. */
  clear () {
    this.list = []
    this.pressed = null
  }

  isEnabled (spot) {
    return typeof spot.enabled === 'function' ? !!spot.enabled() : spot.enabled !== false
  }

  contains (spot, x, y) {
    if (spot.contains) return spot.contains(x, y)
    if (spot.circle) return Math.hypot(x - spot.circle[0], y - spot.circle[1]) <= spot.circle[2]
    var [l, t, r, b] = spot.rect
    return x >= l && x < r && y >= t && y < b
  }

  /**
   * The first enabled hotspot at a point.
   * @returns {object|null}
   */
  at (x, y) {
    for (var spot of this.list) {
      if (this.isEnabled(spot) && this.contains(spot, x, y)) return spot
    }
    return null
  }

  /**
   * The cursor for a point: the hotspot's while one is pressed or under the mouse, otherwise the default.
   */
  cursorAt (x, y, defaultCursor) {
    var spot = this.pressed || this.at(x, y)
    if (!spot || spot.cursor == null) return defaultCursor
    var cursor = typeof spot.cursor === 'function' ? spot.cursor() : spot.cursor
    return cursor == null ? defaultCursor : cursor
  }

  mouseDown (x, y) {
    this.pressed = this.at(x, y)
    if (this.pressed && this.pressed.onDown) return this.pressed.onDown(this.pressed, x, y)
  }

  mouseMove (x, y) {
    if (this.pressed && this.pressed.onDrag) return this.pressed.onDrag(this.pressed, x, y)
  }

  mouseUp (x, y) {
    var spot = this.pressed
    this.pressed = null
    if (!spot) return
    if (spot.onUp) return spot.onUp(spot, x, y)
    if (spot.onClick && this.contains(spot, x, y) && this.isEnabled(spot)) return spot.onClick(spot, x, y)
  }

  /**
   * Receive mouse events from a {@link GameEngine}.
   * @param {GameEngine} engine
   */
  bind (engine) {
    engine.on('mousedown', () => this.mouseDown(engine.mouseX, engine.mouseY))
    engine.on('mousemove', () => this.mouseMove(engine.mouseX, engine.mouseY))
    engine.on('mouseup', () => this.mouseUp(engine.mouseX, engine.mouseY))
  }
}

export default Hotspots
