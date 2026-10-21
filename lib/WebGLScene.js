import Scene from './Scene.js'

/**
 * A scene drawn through WebGL: it keeps a canvas of its own with a WebGL 2 context, has `render(gl)` draw into
 * it each frame, and puts the result into the engine's canvas at its place like any other scene, under its
 * child scenes and entities. So a 3D view sits in the scene tree with everything else: a HUD scene over it, a
 * sprite entity in front, a screen on top.
 *
 * Override `render(gl)` in a subclass, or pass it as an option. The canvas is the scene's size (by default the
 * game's), drawn at the scene's scale; `resize` changes it. Without WebGL (a page without it, or a test), the
 * context is null and nothing is drawn.
 *
 * @example
class View extends WebGLScene {
  render (gl) {
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    // ... draw the world
  }
}
game.addScene('view', new View({ width: 640, height: 400 }))
 */
class WebGLScene extends Scene {
  /**
   * @param {object} options All {@link Scene} options, and:
   * @param {integer} options.width The canvas's width in pixels (default: the game's `width` when drawn, else 640)
   * @param {integer} options.height The canvas's height in pixels (default: the game's `height` when drawn, else 400)
   * @param {function} options.render `render(gl)`, called each frame before the canvas is drawn (optional)
   * @param {function} options.createCanvas Returns a new canvas (default `document.createElement('canvas')`)
   * @param {object} options.contextAttributes For `getContext('webgl2', ...)` (default: no antialiasing, no depth
   *   buffer preservation, an alpha channel so the view composes over what is under it)
   * @param {boolean} options.pixelated Draw the canvas without smoothing when scaled (default: the game's setting)
   */
  constructor (options = {}) {
    super(options)
    this.createCanvas = options.createCanvas || (() => document.createElement('canvas'))
    this.canvas = this.createCanvas()
    this.width = options.width || 0
    this.height = options.height || 0
    this.canvas.width = this.width || 640
    this.canvas.height = this.height || 400
    if (options.render) this.render = options.render
    this.pixelated = options.pixelated
    this.contextAttributes = options.contextAttributes || { antialias: false, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: false }
    /** The WebGL 2 context, or null where there is none. */
    this.gl = null
    try {
      this.gl = this.canvas.getContext('webgl2', this.contextAttributes) || null
    } catch (e) {
      this.gl = null
    }
    this._sized = false
  }

  /**
   * Change the canvas's size. A scene made without a size takes the game's when first drawn, and follows the
   * game's `resize` event if told to (`followGame`).
   * @param {integer} width
   * @param {integer} height
   */
  resize (width, height) {
    if (this.canvas.width === width && this.canvas.height === height && this._sized) return
    this.width = width
    this.height = height
    this.canvas.width = width
    this.canvas.height = height
    this._sized = true
    if (this.gl) this.gl.viewport(0, 0, width, height)
    this.resized(width, height)
  }

  /**
   * Called after the canvas changes size, for a subclass that keeps buffers of the canvas's size. Does nothing.
   * @param {integer} width
   * @param {integer} height
   */
  resized (width, height) {}

  /**
   * Draw the frame into the canvas with WebGL. Does nothing; override it or pass `render` as an option.
   * @param {WebGL2RenderingContext} gl
   */
  render (gl) {}

  /** Renders, draws the canvas, then the child scenes and entities over it. */
  drawContent (context) {
    if (!this._sized) {
      var game = this.game
      this.resize(this.width || (game && game.width) || this.canvas.width, this.height || (game && game.height) || this.canvas.height)
    }
    if (this.gl) {
      this.render(this.gl)
      if (this.pixelated !== undefined && context.imageSmoothingEnabled !== undefined) context.imageSmoothingEnabled = !this.pixelated
      context.drawImage(this.canvas, 0, 0)
    }
    super.drawContent(context)
  }

  /**
   * Draws the scene straight to the page, alone: its canvas, the game canvas's size, put over the game canvas and
   * shown, the game canvas hidden. For a game whose frame is all WebGL (a 3D view with its HUD drawn in it): no 2D
   * canvas is drawn or composed, and no copy is made (copying a WebGL canvas into a 2D one can cost a slow GPU more
   * than the rendering: 70 ms a frame at 1920x960 on a Raspberry Pi 5). The game then skips its own drawing, and
   * takes the mouse on this canvas as well as its own. `withdraw` goes back.
   * @param {HTMLCanvasElement} page The game's canvas
   */
  present (page) {
    if (!this.gl) return
    this.resize(page.width, page.height)
    var style = this.canvas.style
    if (this.canvas.parentNode !== page.parentNode) {
      style.position = 'fixed'
      if (this.pixelated) style.imageRendering = 'pixelated'
      page.parentNode.insertBefore(this.canvas, page.nextSibling)
    }
    var box = page.getBoundingClientRect()
    var place = box.left + ',' + box.top + ',' + box.width + ',' + box.height
    if (place !== this._place) {
      this._place = place
      style.left = box.left + 'px'
      style.top = box.top + 'px'
      style.width = box.width + 'px'
      style.height = box.height + 'px'
    }
    style.display = ''
    page.style.visibility = 'hidden'
    this.render(this.gl)
  }

  /**
   * Back from `present`: the scene's canvas off the page, the game canvas shown again.
   * @param {HTMLCanvasElement} page The game's canvas
   */
  withdraw (page) {
    this.canvas.style.display = 'none'
    page.style.visibility = ''
  }

  /**
   * A compiled and linked program from vertex and fragment shader sources, or an error naming what failed.
   * @param {WebGL2RenderingContext} gl
   * @param {string} vertex
   * @param {string} fragment
   * @returns {WebGLProgram}
   */
  static program (gl, vertex, fragment) {
    var compile = (type, source) => {
      var shader = gl.createShader(type)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error((type === gl.VERTEX_SHADER ? 'vertex' : 'fragment') + ' shader: ' + gl.getShaderInfoLog(shader))
      return shader
    }
    var program = gl.createProgram()
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('program: ' + gl.getProgramInfoLog(program))
    return program
  }
}

export default WebGLScene
