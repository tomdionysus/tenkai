/**
 * An IsometricProjection turns positions in a 3D world (x, y, and z for height) into positions on the screen,
 * and back. It is the one place an isometric game's geometry is defined, shared by its scene, its game logic
 * and anything else that needs to know where something is, such as a map screen or the mouse.
 *
 * The projection is linear: each world axis has a vector on the screen, the pixels one unit along it moves,
 * and the world's origin has a screen position. The classic 2:1 isometric view, where a step along x goes two
 * pixels right and one down and a step along y two pixels left and one down, is the default; any other
 * direction or ratio (dimetric views, or axes pointing elsewhere, as some games have them) is a different set
 * of vectors.
 *
 * Height (z) moves straight up the screen. A projected point is given as the point on the ground below it and
 * its height in pixels, as an {@link Entity} has them (`y` where it stands, `elevation` above that), so
 * entities in a scene in depth order are sorted correctly: farther first, then lower first.
 *
 * @example
// Classic 2:1 isometric, 1 pixel of height per unit of z
const iso = new IsometricProjection()
iso.project(10, 0, 0)          // { x: 20, y: 10, elevation: 0 }
iso.toScreen(10, 0, 5)         // { x: 20, y: 5 }
iso.toWorld(20, 10)            // { x: 10, y: 0 } (at height 0)

// Wreckers (Amiga, 1991): x runs up and left, y up and right, origin at (2048, 3072)
const wreckers = new IsometricProjection({ xAxis: [-2, -1], yAxis: [2, -1], origin: [2048, 3072] })
 */
class IsometricProjection {
  /**
   * @param {object} options
   * @param {number[]} options.xAxis Screen pixels for one unit of x, [dx, dy] (optional, default [2, 1])
   * @param {number[]} options.yAxis Screen pixels for one unit of y (optional, default [-2, 1])
   * @param {number} options.zScale Screen pixels up for one unit of z (optional, default 1)
   * @param {number[]} options.origin Screen position of the world's origin (optional, default [0, 0])
   */
  constructor (options = {}) {
    this.xAxis = options.xAxis || [2, 1]
    this.yAxis = options.yAxis || [-2, 1]
    this.zScale = options.zScale === undefined ? 1 : options.zScale
    this.origin = options.origin || [0, 0]
    var det = this.xAxis[0] * this.yAxis[1] - this.yAxis[0] * this.xAxis[1]
    if (!det) throw new Error('IsometricProjection: the x and y axes must not be parallel')
    this._det = det
  }

  /**
   * Where a world position appears: the screen point on the ground below it, and its height in pixels.
   * @param {number} x
   * @param {number} y
   * @param {number} z (optional, default 0)
   * @returns {{x: number, y: number, elevation: number}}
   */
  project (x, y, z = 0) {
    return {
      x: this.origin[0] + x * this.xAxis[0] + y * this.yAxis[0],
      y: this.origin[1] + x * this.xAxis[1] + y * this.yAxis[1],
      elevation: z * this.zScale
    }
  }

  /**
   * The screen point of a world position.
   * @param {number} x
   * @param {number} y
   * @param {number} z (optional, default 0)
   * @returns {{x: number, y: number}}
   */
  toScreen (x, y, z = 0) {
    var p = this.project(x, y, z)
    return { x: p.x, y: p.y - p.elevation }
  }

  /**
   * The world position at a screen point, at a given height: where the mouse points on a floor, say.
   * @param {number} sx
   * @param {number} sy
   * @param {number} z Height of the plane to find the point on (optional, default 0)
   * @returns {{x: number, y: number}}
   */
  toWorld (sx, sy, z = 0) {
    var dx = sx - this.origin[0]
    var dy = sy + z * this.zScale - this.origin[1]
    return this.vectorToWorld(dx, dy)
  }

  /**
   * The world vector (in x and y) that moves a point by a screen vector: for controls that follow the
   * screen, where "up" means up the screen whichever way the world's axes run.
   * @param {number} dx
   * @param {number} dy
   * @returns {{x: number, y: number}}
   */
  vectorToWorld (dx, dy) {
    var [ax, ay] = this.xAxis
    var [bx, by] = this.yAxis
    return {
      x: (dx * by - dy * bx) / this._det,
      y: (ax * dy - ay * dx) / this._det
    }
  }

  /**
   * How far away a world position is: larger is nearer the viewer. Things are drawn in increasing order of
   * depth, then height. It is the ground point's screen y.
   * @param {number} x
   * @param {number} y
   * @returns {number}
   */
  depth (x, y) {
    return this.origin[1] + x * this.xAxis[1] + y * this.yAxis[1]
  }
}

export default IsometricProjection
