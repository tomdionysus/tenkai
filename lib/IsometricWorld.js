/**
 * An IsometricWorld is the game's model of a 3D space, kept apart from how it is drawn: where things can
 * stand and move, what is in the way, and which part of the world a point is in. Positions are world
 * coordinates (x, y, and z for height), as an {@link IsometricProjection} uses; an {@link IsometricScene}
 * shows the world, but game logic only needs this.
 *
 * It holds three kinds of thing:
 *
 * - **Regions**: named boxes, such as the rooms and corridors of a station or the decks of a ship. A point is
 *   in the first region whose box contains it. Regions also scope colliders, so a large world stays fast.
 * - **Colliders**: boxes with a `type`, such as walls, doors, lifts or consoles. A move into one is decided by
 *   the handler for its type (see [on()]{@link IsometricWorld#on}); without a handler, it blocks.
 * - **Bodies**: things that move, each with a size, that block one another.
 *
 * Boxes include their low edges and exclude their high ones: x from `x0` up to but not including `x1`. A box
 * without `z0` and `z1` spans every height.
 *
 * @example
const world = new IsometricWorld()
world.addRegion({ name: 'bridge', x0: 0, x1: 200, y0: 0, y1: 120, z0: 0, z1: 100 })
world.addCollider({ region: 'bridge', x0: 0, x1: 200, y0: 0, y1: 8, type: 'wall' })
world.addCollider({ region: 'bridge', x0: 90, x1: 110, y0: 110, y1: 120, type: 'door', to: 'corridor' })
world.on('door', (body, door) => door.open)          // passable only when open

const officer = world.addBody({ x: 100, y: 60, z: 0, size: [8, 8, 32] })
const result = world.move(officer, 0, -4, 0)          // { moved: true } or { moved: false, collider, body }
 */
class IsometricWorld {
  constructor () {
    this.regions = []
    this.bodies = []
    this._colliders = new Map() // region name (or null, for colliders in no region) -> list
    this._handlers = {}
  }

  // Regions

  /**
   * Add a region.
   * @param {object} region `{ name, x0, x1, y0, y1, z0, z1 }` and anything else the game wants to keep
   * @returns {object} The region
   */
  addRegion (region) {
    this.regions.push(region)
    return region
  }

  /**
   * The region containing a point: the first added that does.
   * @param {number} x
   * @param {number} y
   * @param {number} z (optional; without it, height is ignored)
   * @returns {object|null}
   */
  regionAt (x, y, z) {
    for (var r of this.regions) if (IsometricWorld.contains(r, x, y, z)) return r
    return null
  }

  // Colliders

  /**
   * Add a collider.
   * @param {object} collider `{ x0, x1, y0, y1, z0, z1, type, region }` and anything else the game wants to
   * keep. `region` is the name of the region it belongs to: only bodies in that region meet it. Leave it out
   * for colliders that apply everywhere.
   * @returns {object} The collider
   */
  addCollider (collider) {
    var key = collider.region === undefined ? null : collider.region
    if (!this._colliders.has(key)) this._colliders.set(key, [])
    this._colliders.get(key).push(collider)
    return collider
  }

  /** Every collider, in the order added within each region. */
  get colliders () {
    return [].concat(...this._colliders.values())
  }

  /**
   * The colliders belonging to a region (given as a region or its name), in the order added; with `true` as
   * the second argument, followed by those in no region. For tests other than a point, such as a shot's path.
   * @param {object|string} region
   * @param {boolean} withUnscoped Include colliders in no region (optional, default false)
   * @returns {object[]}
   */
  collidersIn (region, withUnscoped = false) {
    var name = region && typeof region === 'object' ? region.name : region
    var own = this._colliders.get(name === undefined ? null : name) || []
    return withUnscoped && name !== null && name !== undefined ? own.concat(this._colliders.get(null) || []) : own.slice()
  }

  /**
   * The colliders containing a point, in the order they were added: those of the region the point is in
   * (or of `region`, if given), then those in no region.
   * @param {number} x
   * @param {number} y
   * @param {number} z (optional)
   * @param {object|string} region The region to look in, or its name (optional, default the point's)
   * @returns {object[]}
   */
  collidersAt (x, y, z, region) {
    if (region === undefined) region = this.regionAt(x, y, z)
    var name = region && typeof region === 'object' ? region.name : region
    var out = []
    for (var key of name !== null && name !== undefined ? [name, null] : [null]) {
      for (var c of this._colliders.get(key) || []) if (IsometricWorld.contains(c, x, y, z)) out.push(c)
    }
    return out
  }

  /**
   * Decide what happens when something moves into a collider of a type: `fn(body, collider, world, to)`
   * returns true to let the move happen, false to stop it. It may also change the body or the world: open a
   * door, start a lift, move the body somewhere else. `to` is the position being moved to, `{ x, y, z }`.
   * Without a handler, a collider blocks.
   * @param {string} type
   * @param {function} fn
   */
  on (type, fn) {
    this._handlers[type] = fn
  }

  // Bodies

  /**
   * Add a moving body.
   * @param {object} body `{ x, y, z, size: [sx, sy, sz] }` and anything else the game wants to keep, such as
   * the entity that shows it. The body's box is centred on x and y and stands on z.
   * @returns {object} The body
   */
  addBody (body) {
    if (body.z === undefined) body.z = 0
    if (!body.size) body.size = [0, 0, 0]
    if (body.solid === undefined) body.solid = true
    this.bodies.push(body)
    return body
  }

  /** Remove a body. */
  removeBody (body) {
    var i = this.bodies.indexOf(body)
    if (i >= 0) this.bodies.splice(i, 1)
  }

  /**
   * The solid bodies, other than `body`, whose boxes would overlap `body`'s at a position.
   * @param {object} body
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {object[]}
   */
  bodiesAt (body, x, y, z) {
    var out = []
    var [sx, sy, sz] = body.size
    for (var o of this.bodies) {
      if (o === body || !o.solid) continue
      var [ox, oy, oz] = o.size
      if (Math.abs(o.x - x) * 2 < sx + ox && Math.abs(o.y - y) * 2 < sy + oy && z < o.z + oz && o.z < z + sz) out.push(o)
    }
    return out
  }

  /**
   * Move a body by (dx, dy, dz) if it may go there. The colliders at the new position (in the region of the
   * new position) are asked in turn, through their types' handlers; then other bodies. The move happens only
   * if nothing stops it.
   * @param {object} body
   * @param {number} dx
   * @param {number} dy
   * @param {number} dz (optional, default 0)
   * @returns {{moved: boolean, collider: (object|undefined), blocker: (object|undefined), region: (object|null)}}
   * What happened: when stopped, the collider or body that stopped it. `region` is the body's region after.
   */
  move (body, dx, dy, dz = 0) {
    var to = { x: body.x + dx, y: body.y + dy, z: body.z + dz }
    var region = this.regionAt(to.x, to.y, to.z)
    for (var c of this.collidersAt(to.x, to.y, to.z, region)) {
      var fn = this._handlers[c.type]
      if (!fn || !fn(body, c, this, to)) return { moved: false, collider: c, region: this.regionAt(body.x, body.y, body.z) }
    }
    if (body.solid) {
      var others = this.bodiesAt(body, to.x, to.y, to.z)
      if (others.length) return { moved: false, blocker: others[0], region: this.regionAt(body.x, body.y, body.z) }
    }
    body.x = to.x
    body.y = to.y
    body.z = to.z
    return { moved: true, region }
  }

  /**
   * Whether a box contains a point. Low edges are inside, high edges outside; a box without `z0` and `z1`
   * spans every height, and a point without z matches any box's height.
   * @param {object} box `{ x0, x1, y0, y1, z0, z1 }`
   * @param {number} x
   * @param {number} y
   * @param {number} z (optional)
   * @returns {boolean}
   */
  static contains (box, x, y, z) {
    if (x < box.x0 || x >= box.x1 || y < box.y0 || y >= box.y1) return false
    if (z === undefined || box.z0 === undefined) return true
    return z >= box.z0 && z < box.z1
  }
}

export default IsometricWorld
