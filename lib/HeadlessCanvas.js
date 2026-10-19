/**
 * A canvas that draws nothing, for running a game where there is no page (a check in Node): its 2D context takes
 * every call and does nothing, answers `createImageData` and `getImageData` with blank images of the size asked,
 * and `measureText` with a width of 0. Its `addEventListener` keeps the listeners in `listeners`, so a check given
 * it as the engine's element ({@link GameEngine#attach}) can send the mouse by calling them.
 *
 * `HeadlessCanvas.install()` makes `document.createElement` answer these, for the classes that make their own
 * canvas when not given a `createCanvas` (an {@link IndexedScene}, {@link IndexedSurface#toCanvas}); it does
 * nothing where a real `document` exists.
 *
 * @example
HeadlessCanvas.install()
const canvas = new HeadlessCanvas(320, 200)
game.attach(canvas)
game.step(1 / 50)
game.draw(canvas.getContext('2d'))
canvas.listeners.mousedown({ x: 40, y: 60, button: 0 })
 */
class HeadlessCanvas {
  /**
   * @param {integer} width
   * @param {integer} height
   */
  constructor (width = 300, height = 150) {
    this.width = width
    this.height = height
    this.style = {}
    this.listeners = {}
    var blank = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) })
    this.context = new Proxy({ canvas: this }, {
      get (target, name) {
        if (name in target) return target[name]
        switch (name) {
          case 'createImageData': return (w, h) => blank(w, h)
          case 'getImageData': return (x, y, w, h) => blank(w, h)
          case 'measureText': return () => ({ width: 0 })
          default: return () => {}
        }
      },
      set (target, name, value) {
        target[name] = value
        return true
      }
    })
  }

  getContext () {
    return this.context
  }

  addEventListener (name, fn) {
    this.listeners[name] = fn
  }

  removeEventListener (name) {
    delete this.listeners[name]
  }

  /** Where there is no page, `document.createElement` made to answer headless canvases. */
  static install () {
    if (typeof globalThis.document !== 'undefined') return
    globalThis.document = { createElement: () => new HeadlessCanvas() }
  }
}

export default HeadlessCanvas
