import Scene from './Scene.js'
import IsometricProjection from './IsometricProjection.js'

/**
 * IsometricScene shows a 3D world in isometric view: entities placed by world position are projected onto
 * the screen and drawn in depth order, farthest first, over a ground drawn by child scenes.
 *
 * An entity is placed in the world by giving it a `world` position, `{ x, y, z }` (see
 * [place()]{@link IsometricScene#place}). Each frame, before drawing, the scene sets the entity's `x` and `y`
 * to the point on the ground below it and its `elevation` to its height in pixels, through the scene's
 * {@link IsometricProjection}; the scene draws in `PERSPECTIVE_DEPTH` order, so nearer things cover farther
 * ones and, at the same depth, higher things cover lower. Entities without a `world` position keep their own
 * `x` and `y`, so labels and effects can be placed on the screen directly.
 *
 * The ground is whatever child scenes draw, beneath the entities: for pre-drawn isometric art, a
 * {@link TiledScene} of flat tiles (as many 16-bit games drew their worlds), or a {@link BackgroundScene}.
 *
 * Pre-drawn art has walls, railings and arches that characters pass behind, but the art is one flat picture.
 * **Occluders** handle this, as games such as Wreckers (Amiga, 1991) did: an occluder is the foreground part of
 * the art at a place (an image, transparent elsewhere, at a screen position), with a test of which entities are
 * behind it. After drawing an entity, the scene draws over it, clipped to the entity's own box, every occluder
 * that hides it; nearer entities, drawn later, are not affected. Scenery that should be sorted with the
 * characters instead can simply be entities.
 *
 * Game logic belongs in an {@link IsometricWorld}, which knows where things can go; the scene only shows it.
 *
 * @extends Scene
 * @example
const projection = new IsometricProjection({ xAxis: [-2, -1], yAxis: [2, -1], origin: [2048, 3072] })
const view = new IsometricScene({ projection, clip: frameOutline })
view.addScene('ground', new TiledScene({ sheet: stationTiles, layers: [stationMap] }))
view.place('officer', officer, 1020, 356, 896)
// Each step, after moving: keep the officer in the middle of a 256 by 144 view
view.centerOn(officer.world, 128, 96, [8, 1])
 */
class IsometricScene extends Scene {
  /**
   * @param {object} options Scene options, and:
   * @param {IsometricProjection} options.projection (optional, default classic 2:1 isometric)
   */
  constructor (options = {}) {
    super(Object.assign({ perspectiveMode: Scene.PERSPECTIVE_DEPTH }, options))
    this.projection = options.projection || new IsometricProjection()
    // Entities are drawn on a grid of this many pixels (0 for none): give the camera's snap, so a character the
    // camera follows stays still on the screen instead of shivering a pixel as both are rounded apart
    this.snap = options.snap || 0
    this.occluders = []
    // The scene's own offset, so the camera can move the whole view
    this.camera = { x: 0, y: 0 }
  }

  /**
   * Add an entity at a world position.
   * @param {string} name
   * @param {Entity} entity
   * @param {number} x
   * @param {number} y
   * @param {number} z (optional, default 0)
   * @returns {Entity}
   */
  place (name, entity, x, y, z = 0) {
    entity.world = { x, y, z }
    this.addEntity(name, entity)
    this.projectEntity(entity)
    return entity
  }

  /**
   * Set an entity's screen position from its world position. The scene does this for every entity before
   * drawing; call it to know where an entity is on the screen in between.
   * @param {Entity} entity
   */
  projectEntity (entity) {
    var w = entity.world
    if (!w) return
    var p = this.projection.project(w.x, w.y, w.z || 0)
    entity.x = p.x
    entity.y = p.y
    entity.elevation = p.elevation
    if (this.snap) {
      // Snap where it is drawn, (x, y - elevation), keeping the elevation for depth
      entity.x = Math.floor(p.x / this.snap) * this.snap
      entity.y = Math.floor((p.y - p.elevation) / this.snap) * this.snap + p.elevation
    }
  }

  /**
   * Move the view so that a world position appears at a point of the scene's area, such as the middle of the
   * view. Rounded to whole pixels, or to steps of `snap` pixels, as old games scrolled in steps: one number
   * for both axes, or [x, y], such as [8, 1] for 8-pixel steps across and smooth scrolling up and down.
   * @param {{x: number, y: number, z: number}} position A world position, such as an entity's `world`
   * @param {number} sx Where it should appear, in the scene's area
   * @param {number} sy
   * @param {number|number[]} snap Round the scroll to this many pixels (optional, default 1)
   */
  centerOn (position, sx, sy, snap = 1) {
    var [snapX, snapY] = Array.isArray(snap) ? snap : [snap, snap]
    var p = this.projection.toScreen(position.x, position.y, position.z || 0)
    this.camera.x = Math.floor((p.x - sx) / snapX) * snapX
    this.camera.y = Math.floor((p.y - sy) / snapY) * snapY
  }

  /**
   * The world position under a point of the scene's area, on the plane at height z: what the mouse points at.
   * @param {number} sx
   * @param {number} sy
   * @param {number} z (optional, default 0)
   * @returns {{x: number, y: number}}
   */
  worldAt (sx, sy, z = 0) {
    return this.projection.toWorld(sx + this.camera.x, sy + this.camera.y, z)
  }

  /**
   * Add an occluder: foreground art that hides the entities behind it.
   * @param {object} occluder
   * @param {HTMLImageElement|HTMLCanvasElement} occluder.image The foreground, transparent elsewhere (or an
   * atlas, with `sx`, `sy`, `width` and `height` giving the part to use)
   * @param {number} occluder.x Where its top left goes, in the ground's coordinates
   * @param {number} occluder.y
   * @param {function} occluder.hides `hides(entity)`: whether the entity is behind it (optional, default all)
   * @param {Scene} occluder.source Take the art live from this scene (the ground, say) where `image` is opaque:
   *   `image` is then only a mask, and the art follows changes to the scene once
   *   {@link IsometricScene#invalidateOccluders} is told of them (optional)
   * @returns {object} The occluder
   */
  addOccluder (occluder) {
    var o = Object.assign({ sx: 0, sy: 0 }, occluder)
    if (o.width === undefined) o.width = o.image.width
    if (o.height === undefined) o.height = o.image.height
    if (o.source) o.dirty = true
    this.occluders.push(o)
    return o
  }

  /**
   * Mark the live occluders (those with a `source`) over a rectangle of the ground as needing their art taken
   * again, after the scene changed there (a tile replaced, say).
   */
  invalidateOccluders (x, y, width, height) {
    for (var o of this.occluders) {
      if (o.source && o.x < x + width && o.x + o.width > x && o.y < y + height && o.y + o.height > y) o.dirty = true
    }
  }

  /** The image and source rectangle to draw an occluder with: for a live one, its art taken again if needed. */
  occluderArt (o) {
    if (!o.source) return { image: o.image, sx: o.sx, sy: o.sy }
    if (o.dirty || !o.art) {
      o.dirty = false
      var canvas = o.art || (typeof document !== 'undefined' && document.createElement ? document.createElement('canvas') : null)
      var context = canvas && canvas.getContext ? canvas.getContext('2d') : null
      if (!context) return { image: o.image, sx: o.sx, sy: o.sy }
      canvas.width = o.width
      canvas.height = o.height
      context.clearRect(0, 0, o.width, o.height)
      context.save()
      context.translate(-o.x, -o.y)
      o.source.drawContent(context)
      context.restore()
      context.globalCompositeOperation = 'destination-in'
      context.drawImage(o.image, o.sx, o.sy, o.width, o.height, 0, 0, o.width, o.height)
      context.globalCompositeOperation = 'source-over'
      o.art = canvas
    }
    return { image: o.art, sx: 0, sy: 0 }
  }

  /** Remove every occluder. */
  clearOccluders () {
    this.occluders = []
  }

  /**
   * The occluders that hide an entity: those whose box overlaps the entity's and whose test says it is behind.
   * @param {Entity} entity
   * @returns {object[]}
   */
  occludersOf (entity) {
    var box = IsometricScene.entityBox(entity)
    if (!box) return []
    return this.occluders.filter((o) => o.x < box[2] && o.x + o.width > box[0] && o.y < box[3] && o.y + o.height > box[1] &&
      (!o.hides || o.hides(entity)))
  }

  /** Draw the ground, then the entities in depth order, each followed by the occluders that hide it. */
  drawContent (context) {
    for (var entity of Object.values(this._entities)) this.projectEntity(entity)
    context.save()
    context.translate(-this.camera.x, -this.camera.y)
    this.drawScenes(context)
    for (entity of this.sortedEntities()) {
      entity.draw(context)
      if (!this.occluders.length || !entity.visible) continue
      var covering = this.occludersOf(entity)
      if (!covering.length) continue
      var box = IsometricScene.entityBox(entity)
      context.save()
      context.beginPath()
      context.rect(box[0], box[1], box[2] - box[0], box[3] - box[1])
      context.clip()
      for (var o of covering) {
        var art = this.occluderArt(o)
        context.drawImage(art.image, art.sx, art.sy, o.width, o.height, o.x, o.y, o.width, o.height)
      }
      context.restore()
    }
    context.restore()
  }

  /**
   * The screen box an entity's tile covers, [left, top, right, bottom], or null if it has no size.
   * @param {Entity} entity
   * @returns {number[]|null}
   */
  static entityBox (entity) {
    var w = entity.width
    var h = entity.height
    if (!w || !h) return null
    var [ax, ay] = entity.origin || [0, 0]
    var left = entity.x - ax
    var top = entity.y - (entity.elevation || 0) - ay
    return [left, top, left + w, top + h]
  }
}

export default IsometricScene
