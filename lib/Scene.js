import HasScenesMixin from './HasScenesMixin.js'
import HasEntitiesMixin from './HasEntitiesMixin.js'

/**
 * Scene is a container for child Scenes and {@link Entity} instances, drawn together: a layer of a game
 * such as a background, a playfield or a HUD.
 *
 * To draw something of its own, a scene can paint under its children in `background(context)` and over
 * them in `foreground(context)`, either by overriding those methods or by passing them as options.
 *
 * @mixes HasScenesMixin
 * @mixes HasEntitiesMixin
 * @example
game.addScene('board', new Scene({
  background: (context) => { context.fillStyle = '#1c2340'; context.fillRect(0, 0, 640, 720) },
  foreground: (context) => context.fillText('SCORE ' + game.score, 16, 40)
}))
 */
class Scene {
  /**
	* Create a new Scene.
	* @param {object} options
	* @property {number} x The x-coordinate relative to the parent (optional, default 0)
	* @property {number} y The y-coordinate relative to the parent (optional, default 0)
	* @property {number} z Drawing order among the parent's scenes (optional, default 0)
	* @property {number} scale Scale for the scene and everything in it (optional, default 1)
	* @property {number} rotate Rotation in radians for the scene and everything in it (optional, default 0)
	* @property {boolean} visible Whether it and its children are drawn (optional, default true)
	* @property {number} perspectiveMode How entities are ordered: `Scene.PERSPECTIVE_OVERHEAD` by `z`, or
	* `Scene.PERSPECTIVE_DEPTH` by where they stand (optional, default overhead)
	* @property {number} timeScale Speed of animation for everything in the scene; 0 pauses it (optional, default 1)
	* @property {function} background Draws under the children, as `background(context)` (optional)
	* @property {function} foreground Draws over the children, as `foreground(context)` (optional)
	* @property {number[][]} clip A polygon, as [[x, y], ...] in the scene's coordinates, outside which nothing
	* of the scene is drawn: for a view inside a shaped frame (optional, default none)
	*/
  constructor (options = {}) {
    HasScenesMixin(this, options)
    HasEntitiesMixin(this)

    this.asset = options.asset
    this.x = options.x || 0
    this.y = options.y || 0
    this.z = options.z || 0
    this.parent = options.parent === undefined ? null : options.parent
    this.visible = options.visible === undefined ? true : !!options.visible
    this.scale = options.scale === undefined ? 1 : options.scale
    this.rotate = options.rotate || 0
    this.perspectiveMode = options.perspectiveMode || Scene.PERSPECTIVE_OVERHEAD
    this.timeScale = options.timeScale === undefined ? 1 : options.timeScale
    if (options.background) this.background = options.background
    if (options.foreground) this.foreground = options.foreground
    this.clip = options.clip || null
  }

  /** The {@link GameEngine} this scene belongs to, found through its parents. */
  get game () {
    var node = this
    while (node.parent) node = node.parent
    return node.isGameEngine ? node : null
  }

  /**
	* Advance the animations of everything in this Scene by the given game time, scaled by `timeScale`.
	* @param {number} ms Milliseconds of game time
	*/
  animate (ms) {
    ms *= this.timeScale
    this.animateScenes(ms)
    this.animateEntities(ms)
  }

  /**
	* Draw under the children, in the scene's own coordinates. Override it, or pass it as an option.
	* @param {CanvasRenderingContext2D} context
	*/
  background (context) {}

  /**
	* Draw over the children, in the scene's own coordinates. Override it, or pass it as an option.
	* @param {CanvasRenderingContext2D} context
	*/
  foreground (context) {}

  /**
	* Draw the scene: its background, child scenes, entities, then its foreground.
	* @param {CanvasRenderingContext2D} context The context in which to draw
	*/
  draw (context) {
    if (!this.visible) return
    context.save()
    this.applyTransform(context)
    if (this.clip && this.clip.length > 2) {
      context.beginPath()
      context.moveTo(this.clip[0][0], this.clip[0][1])
      for (var i = 1; i < this.clip.length; i++) context.lineTo(this.clip[i][0], this.clip[i][1])
      context.closePath()
      context.clip()
    }
    this.background(context)
    this.drawContent(context)
    this.foreground(context)
    context.restore()
  }

  /** Apply the scene's position, scale and rotation to the context. */
  applyTransform (context) {
    context.translate(this.x, this.y)
    if (this.scale !== 1) context.scale(this.scale, this.scale)
    if (this.rotate) context.rotate(this.rotate)
  }

  /**
   * The part of the scene that can be seen, in its own coordinates, worked out from the context's current
   * transform and its canvas: [left, top, right, bottom]. Scenes with a lot to draw use it to skip what is
   * off screen. Null when the context cannot tell (no transform or canvas), in which case draw everything.
   * @param {CanvasRenderingContext2D} context A context with this scene's transform applied
   * @returns {number[]|null}
   */
  visibleBounds (context) {
    if (!context.getTransform || !context.canvas) return null
    var m = context.getTransform()
    var det = m.a * m.d - m.b * m.c
    if (!det) return null
    var w = context.canvas.width
    var h = context.canvas.height
    var xs = []
    var ys = []
    for (var [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) {
      var tx = cx - m.e
      var ty = cy - m.f
      xs.push((m.d * tx - m.c * ty) / det)
      ys.push((m.a * ty - m.b * tx) / det)
    }
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  }

  /** Draw what the scene contains, between its background and foreground. Subclasses replace this. */
  drawContent (context) {
    this.drawScenes(context)
    this.drawEntities(context)
  }
}

/**
 * Entities are drawn in order of `z`.
 */
Scene.PERSPECTIVE_OVERHEAD = 1
/**
 * Entities are drawn in depth order: by where they stand (`y`), then by `elevation`, so things nearer the
 * bottom of the screen are in front. In a {@link TiledScene}, upright tiles are sorted in with them.
 */
Scene.PERSPECTIVE_DEPTH = 2

export default Scene
