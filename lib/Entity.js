const HasEntitiesMixin = require('./HasEntitiesMixin')
const Sheet = require('./Sheet')

/**
 * Entity is a sprite: one tile of a {@link Sheet}, drawn at a position, which can play animation clips
 * from the sheet and hold child entities that move, scale and rotate with it.
 *
 * An entity's position is where its anchor is. The anchor is a point within the tile, such as a
 * character's feet or the centre of a ship, and rotation, scaling and flipping happen about it. Children
 * are positioned relative to it.
 *
 * @mixes HasEntitiesMixin
 * @example
const cat = new Entity({ sheet: catSheet, tile: [1, 0], x: 224, y: 316 })
scene.addEntity('cat', cat)
cat.play('walkRight')
 */
class Entity {
  /**
	* Create a new Entity.
	* @param {Object} options
	* @property {Sheet} sheet The sheet whose tiles the entity shows (optional)
	* @property {Asset|HTMLImageElement|HTMLCanvasElement} image A single image to show whole, instead of a sheet (optional)
	* @property {integer[]} tile The tile to show, [column, row] (optional, default [0, 0] with a sheet or image)
	* @property {number[]} anchor [x, y] within the tile that the position refers to (optional, default the sheet's anchor)
	* @property {number} x The anchor's x-coordinate relative to the parent (optional, default 0)
	* @property {number} y The anchor's y-coordinate relative to the parent (optional, default 0)
	* @property {number} z Drawing order among the parent's entities (optional, default 0)
	* @property {number} elevation Pixels above the ground: drawn this much higher, and sorted above things at
	* the same depth that are lower (optional, default 0)
	* @property {number} scale Scale about the anchor (optional, default 1)
	* @property {number} rotate Rotation in radians about the anchor (optional, default 0)
	* @property {boolean} flipX Mirror horizontally about the anchor (optional, default false)
	* @property {boolean} visible Whether it and its children are drawn (optional, default true)
	*/
  constructor (options = {}) {
    // Entities can have child entities
    HasEntitiesMixin(this)

    this.sheet = options.sheet || (options.image ? new Sheet({ image: options.image, tileWidth: options.tileWidth, tileHeight: options.tileHeight }) : null)
    this.tile = options.tile !== undefined ? options.tile : (this.sheet ? [0, 0] : null)
    this.anchor = options.anchor || null

    this.x = options.x || 0
    this.y = options.y || 0
    this.z = options.z || 0
    this.elevation = options.elevation || 0
    this.parent = options.parent || null
    this.visible = options.visible === undefined ? true : !!options.visible
    this.scale = options.scale === undefined ? 1 : options.scale
    this.rotate = options.rotate || 0
    this.flipX = !!options.flipX

    // Animation state
    this.clip = null
    this.frame = 0
    this.animating = false
    this.done = false
    this.speed = 1
    this.loop = false
    this._frameTime = 0
    this._onComplete = null
  }

  /** The width of one tile, in pixels. */
  get width () { return this.sheet ? this.sheet.tileWidth : 0 }

  /** The height of one tile, in pixels. */
  get height () { return this.sheet ? this.sheet.tileHeight : 0 }

  /** The anchor in use: the entity's own, else its sheet's, else the top-left. */
  get origin () { return this.anchor || (this.sheet && this.sheet.anchor) || [0, 0] }

  /** The {@link GameEngine} this entity belongs to, found through its parents. */
  get game () {
    var node = this.parent
    while (node && node.parent) node = node.parent
    return node && node.isGameEngine ? node : null
  }

  // Animation

  /**
   * Play a clip from the sheet. If that clip is already animating, only its options change, unless
   * `restart` is set, so this can be called every step without restarting the animation. A clip that was
   * stopped or has finished starts again from its first frame.
   * @param {string|object} clip The clip's name in the sheet, or a clip
   * @param {object} options
   * @param {boolean} options.restart Start from the first frame even if this clip is already playing
   * @param {number} options.speed Scales the frame delays: 2 is twice as fast, 0 holds the current frame
   * (optional, default 1)
   * @param {boolean} options.loop Loop or not, overriding the clip (optional, default the clip's own)
   * @param {function} options.onComplete Called with the entity when a clip that does not loop has shown
   * its last frame for its delay (optional)
   */
  play (clip, options = {}) {
    var name = clip
    clip = this.sheet ? this.sheet.clip(clip) : clip
    if (!clip) throw new Error('No such clip: ' + name)
    this.speed = options.speed === undefined ? 1 : options.speed
    this.loop = options.loop === undefined ? clip.loop : !!options.loop
    this._onComplete = options.onComplete || null
    // Asking for the clip that is animating only updates its options; a stopped or finished clip starts again
    if (clip === this.clip && this.animating && !options.restart) return
    this.clip = clip
    this.done = false
    this.animating = true
    this.setFrame(0)
  }

  /**
   * Show a frame of the current clip and start its delay afresh. With a speed of 0 the frame is held, so
   * game logic can choose frames itself.
   * @param {integer} frame The frame's index in the clip
   */
  setFrame (frame) {
    if (!this.clip) return
    this._show(Math.max(0, Math.min(frame, this.clip.frames.length - 1)))
    this._frameTime = 0
  }

  _show (frame) {
    this.frame = frame
    var f = this.clip.frames[frame]
    this.tile = [f[0], f[1]]
  }

  /** Stop animating, keeping the current tile. */
  stop () {
    this.animating = false
  }

  /**
   * Advance the animation, and those of child entities, by the given game time. The {@link GameEngine}
   * does this every step; call it yourself only for entities outside the engine's scenes.
   * @param {number} ms Milliseconds of game time
   */
  animate (ms) {
    if (this.animating && this.speed > 0) {
      this._frameTime += ms * this.speed
      // Each frame is shown for its delay. A frame with a delay of 0 is shown for one step: it is left
      // alone in the step it appears and moved on from in the next.
      var changed = false
      while (this.animating) {
        var delay = this._delay()
        if (delay > 0 ? this._frameTime < delay - 1e-6 : changed) break
        this._frameTime = delay > 0 ? this._frameTime - delay : 0
        this._advance()
        changed = true
      }
    }
    this.animateEntities(ms)
  }

  _delay () {
    var f = this.clip.frames[this.frame]
    return f.length > 2 && f[2] != null ? f[2] : this.clip.delay
  }

  // Move on from the current frame: to the next, back to the first, or to the end of the clip
  _advance () {
    if (this.frame + 1 < this.clip.frames.length) return this._show(this.frame + 1)
    if (this.loop) return this._show(0)
    this.animating = false
    this.done = true
    if (this._onComplete) {
      var fn = this._onComplete
      this._onComplete = null
      fn(this)
    }
  }

  // Drawing

  /**
   * Apply the entity's position, elevation, scale, rotation and flip to the context. After this, (0, 0) is
   * the anchor.
   */
  applyTransform (context) {
    context.translate(this.x, this.y - this.elevation)
    if (this.scale !== 1) context.scale(this.scale, this.scale)
    if (this.rotate) context.rotate(this.rotate)
    if (this.flipX) context.scale(-1, 1)
  }

  /**
	* Draw the entity and its children.
	* @param {CanvasRenderingContext2D} context The context in which to draw
	*/
  draw (context) {
    if (!this.visible) return
    context.save()
    this.applyTransform(context)
    if (this.sheet && this.tile) {
      var [ax, ay] = this.origin
      this.sheet.draw(context, this.tile, 0 - ax, 0 - ay)
    }
    this.drawEntities(context)
    context.restore()
  }
}

module.exports = Entity
