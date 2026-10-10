import { Entity } from '../../index.js'

/**
 * An Actor is a game object: a Tenkai Entity plus the state the game needs to move it and collide it.
 * Its sheet is anchored at the centre, so the actor's position is the middle of the sprite and it rotates
 * about it.
 */
class Actor {
  constructor (game, layer, sheet, options = {}) {
    this.game = game
    this.layer = layer

    // Drawn size in pixels
    this.scale = options.scale || 1
    this.width = sheet.tileWidth * this.scale
    this.height = sheet.tileHeight * this.scale

    // Velocity in pixels per second; angle in radians, 0 facing up the screen
    this.vx = options.vx || 0
    this.vy = options.vy || 0

    // Hitbox half extents. Smaller than the sprite by default so near misses feel fair.
    this.hw = (options.hitWidth || this.width * 0.6) / 2
    this.hh = (options.hitHeight || this.height * 0.6) / 2

    this.hp = options.hp || 1
    this.points = options.points || 0
    this.targetable = true
    this.age = 0
    this.dead = false

    // How far above the top of the screen the actor may be before it is removed. Enemies enter from above.
    this.cullTop = options.cullTop === undefined ? 400 : options.cullTop

    // Optional per-step behaviour: think(actor, dt)
    this.think = options.think || null

    this.entity = layer.addEntity('actor' + (game.nextId++), new Entity({
      sheet,
      tile: options.tile || [0, 0],
      x: options.x || 0,
      y: options.y || 0,
      z: options.z || 0,
      scale: this.scale,
      rotate: options.angle || 0
    }))
  }

  // Position and angle live on the entity
  get x () { return this.entity.x }
  set x (v) { this.entity.x = v }
  get y () { return this.entity.y }
  set y (v) { this.entity.y = v }
  get angle () { return this.entity.rotate }
  set angle (v) { this.entity.rotate = v }

  /**
   * Play one of the sheet's clips. onComplete is called once a clip that does not loop has finished, unless
   * the actor has gone.
   */
  play (clip, onComplete) {
    this.entity.play(clip, { onComplete: () => { if (!this.dead && onComplete) onComplete() } })
  }

  /** Point the actor along its velocity. */
  faceVelocity () {
    if (this.vx || this.vy) this.angle = Math.atan2(this.vx, -this.vy)
  }

  overlaps (other) {
    return Math.abs(this.x - other.x) < this.hw + other.hw && Math.abs(this.y - other.y) < this.hh + other.hh
  }

  remove () {
    if (this.dead) return
    this.dead = true
    this.layer.removeEntity(this.entity.name)
  }
}

export default Actor
