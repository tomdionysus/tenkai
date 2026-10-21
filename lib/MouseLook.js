/**
 * MouseLook is the mouse as a first-person game reads it: how far it moved since the last frame, to turn and
 * look by, and its buttons. The game "has" the mouse once the player clicks on it (or from the start, after a
 * start screen's click): it then asks the browser for the pointer (pointer lock), so the cursor stays put and
 * the mouse turns without limit. Where the browser will not give the pointer (an automated page, a browser
 * without it), the mouse still turns while it moves over the game and the page has the focus. Escape, leaving
 * the page or hiding the tab lets the mouse go; a click takes it again. The click that takes the mouse only
 * takes it; later clicks press the buttons.
 *
 * Read it once a drawn frame, not once a game step: a frame holds none, one or two steps, and turning by the
 * frame is what makes the view smooth.
 *
 * @example
const mouse = new MouseLook({ elements: [game.element], held: true })   // held: the start screen's click gave it
// each frame:
const { dx, dy } = mouse.read()
look.yaw += dx * 0.002
look.pitch -= dy * 0.002
if (mouse.buttons.left) fire()
 */
class MouseLook {
  /**
   * @param {object} options
   * @param {Element[]|Element} options.elements The canvas (or canvases) the game is drawn in: a click on one takes
   *   the mouse, and the pointer is taken on whichever of them is shown
   * @param {boolean} options.held Whether the game has the mouse from the start (default false)
   * @param {number} options.sensitivity A factor on the movement read (default 1)
   * @param {Document} options.document (default the page's)
   * @param {Window} options.window (default the page's)
   */
  constructor (options = {}) {
    var els = options.elements || []
    this.elements = Array.isArray(els) ? els.slice() : [els]
    this.sensitivity = options.sensitivity === undefined ? 1 : options.sensitivity
    this.document = options.document || (typeof document !== 'undefined' ? document : null)
    this.window = options.window || (typeof window !== 'undefined' ? window : null)
    /** Whether the game has the mouse (turning by it, its buttons taken). */
    this.held = !!options.held
    /** The buttons held: `left`, `right`, `middle`. */
    this.buttons = { left: false, right: false, middle: false }
    this._dx = 0
    this._dy = 0
    this._listeners = []
    if (this.document) this.attach()
  }

  /** Whether the browser has given the pointer to one of the elements. */
  get locked () {
    return !!(this.document && this.elements.includes(this.document.pointerLockElement))
  }

  /** The element shown now (not hidden by its style), the one the pointer is asked on. */
  shown () {
    return this.elements.find((e) => !e.style || (e.style.visibility !== 'hidden' && e.style.display !== 'none')) || this.elements[0]
  }

  /** Takes the mouse: the game turns by it from now, and the pointer is asked for. */
  take () {
    this.held = true
    this.lock()
  }

  /** Lets the mouse go: the game stops turning by it, its buttons are up. */
  release () {
    this.held = false
    this.buttons.left = this.buttons.right = this.buttons.middle = false
    this._dx = this._dy = 0
    if (this.locked && this.document.exitPointerLock) this.document.exitPointerLock()
  }

  /** Asks the browser for the pointer on the shown element (only from a click or a key: the browser's rule). */
  lock () {
    var el = this.shown()
    if (!el || this.locked || !el.requestPointerLock) return
    try {
      var r = el.requestPointerLock()
      if (r && r.catch) r.catch(() => {})
    } catch (e) {}
  }

  /**
   * How far the mouse moved since the last read, in pixels times the sensitivity; then nothing until it moves
   * again.
   * @returns {object} `{ dx, dy }`
   */
  read () {
    var out = { dx: this._dx * this.sensitivity, dy: this._dy * this.sensitivity }
    this._dx = this._dy = 0
    return out
  }

  /** Listens to the page: attached by the constructor when there is a document. */
  attach () {
    var doc = this.document
    var win = this.window
    var on = (target, type, fn) => { target.addEventListener(type, fn); this._listeners.push([target, type, fn]) }
    on(doc, 'mousedown', (e) => {
      if (!this.elements.includes(e.target)) return
      var had = this.held || this.locked
      this.held = true
      this.lock()
      if (had) this._button(e.button, true)
    })
    on(doc, 'mouseup', (e) => this._button(e.button, false))
    on(doc, 'mousemove', (e) => {
      if (!this.locked && !(this.held && (!doc.hasFocus || doc.hasFocus()) && this.elements.includes(e.target))) return
      this._dx += e.movementX || 0
      this._dy += e.movementY || 0
    })
    on(doc, 'contextmenu', (e) => { if (this.elements.includes(e.target)) e.preventDefault() })
    on(doc, 'pointerlockchange', () => { if (!this.locked) this.release() })
    on(doc, 'visibilitychange', () => { if (doc.hidden) this.release() })
    on(doc, 'keydown', (e) => {
      if (e.key === 'Escape') { this.release(); return }
      if (this.held) this.lock()
    })
    if (win) on(win, 'blur', () => this.release())
  }

  /** Stops listening. */
  detach () {
    for (var [target, type, fn] of this._listeners) target.removeEventListener(type, fn)
    this._listeners = []
  }

  _button (n, down) {
    if (n === 0) this.buttons.left = down
    else if (n === 2) this.buttons.right = down
    else if (n === 1) this.buttons.middle = down
  }
}

export default MouseLook
