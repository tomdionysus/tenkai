/**
 * Facings picks a sprite's picture for the way it faces, as old games store them: a picture for each of a number
 * of directions, often only the half from north round to south, the other half drawn mirrored; and for things that
 * walk, several frames to each direction's picture.
 *
 * A facing is a number from 0 (north) round clockwise to `turn` (256 by default, as many games keep it), rounded
 * to the nearest direction. `pictures` says which picture each direction uses, north first, so several directions
 * can share one: a soldier's north, side and south pictures for eight directions are `[0, 1, 1, 1, 2]`.
 *
 * @example
const tank = new Facings({ directions: 8, mirror: true })               // pictures 0-4, the west side mirrored
const { offset, flip } = tank.pick(unit.facing)
const soldier = new Facings({ directions: 8, mirror: true, pictures: [0, 1, 1, 1, 2], frames: 3 })
soldier.pick(unit.facing, step % 3)                                     // offset is picture * 3 + frame
 */
class Facings {
  /**
   * @param {object} options
   * @property {integer} directions How many ways it can face (8, 16, ...)
   * @property {boolean} mirror Pictures only from north to south, mirrored for the west side (default false)
   * @property {integer[]} pictures The picture for each direction from north (default one each, in order)
   * @property {integer} frames Frames to a picture (default 1)
   * @property {number} turn The facing of a whole turn (default 256)
   */
  constructor (options) {
    this.directions = options.directions
    this.mirror = !!options.mirror
    var count = this.mirror ? (this.directions >> 1) + 1 : this.directions
    this.pictures = options.pictures || Array.from({ length: count }, (v, i) => i)
    this.frames = options.frames || 1
    this.turn = options.turn || 256
  }

  /** The nearest direction to a facing, 0 (north) to `directions - 1`. */
  direction (facing) {
    var step = this.turn / this.directions
    var d = Math.floor((facing + step / 2) / step) % this.directions
    return d < 0 ? d + this.directions : d
  }

  /**
   * The picture for a facing (and a frame of it): `offset` from the thing's first picture, and whether it is
   * drawn mirrored.
   * @returns {{offset: integer, flip: boolean}}
   */
  pick (facing, frame = 0) {
    var d = this.direction(facing)
    var flip = this.mirror && d > this.directions >> 1
    var k = flip ? this.directions - d : d
    return { offset: this.pictures[k] * this.frames + (frame % this.frames), flip }
  }
}

export default Facings
