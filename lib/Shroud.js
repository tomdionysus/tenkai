/**
 * Shroud is the fog of war over a {@link TiledScene}: one layer of the scene's map that covers the cells a
 * player has not seen with a tile of their own, and edges seen ground where it meets unseen ground with a tile
 * picked by which of its four neighbours are seen.
 *
 * Which neighbours are seen makes a mask: north 1, east 2, south 4, west 8. A cell seen on every side (15) is
 * left clear. Cells off the map count as seen unless `edge: 'unseen'`, so ground at the map's border is not
 * edged against nothing.
 *
 * The shroud does not keep what has been seen: the game does, and `update` asks it, for the whole map or only
 * the cells in view.
 *
 * @example
const shroud = new Shroud({
  scene: battlefield,
  layer: 1,
  columns: 64,
  rows: 64,
  unseen: [0, 5],                          // a black tile
  edges: (mask) => [1 + mask, 5]           // the sheet's sixteen edge tiles, in mask order
})
shroud.update((x, y) => seen[y][x], view)  // view: { x, y, width, height } in cells, or nothing for all of it
 */
class Shroud {
  /**
   * @param {object} options
   * @property {TiledScene} scene The scene whose layer it is
   * @property {number} layer The layer's key, above the ground and the scene's things
   * @property {integer} columns The map's width in cells
   * @property {integer} rows The map's height in cells
   * @property {Array} unseen The placement for a cell not seen
   * @property {function} edges `(mask) => placement`, for a seen cell with unseen neighbours (mask 0 to 14)
   * @property {string} edge `'seen'` (the default) or `'unseen'`: what the cells off the map count as
   */
  constructor (options) {
    this.scene = options.scene
    this.layer = options.layer
    this.columns = options.columns
    this.rows = options.rows
    this.unseen = options.unseen
    this.edges = options.edges
    this.edge = options.edge || 'seen'
    var grid = []
    for (var y = 0; y < this.rows; y++) grid.push(new Array(this.columns).fill(this.unseen))
    this.scene.layers[this.layer] = grid
    this.scene.invalidate()
  }

  /** The layer's grid of placements. */
  get grid () {
    return this.scene.layers[this.layer]
  }

  /**
   * The mask of a seen cell's seen neighbours (north 1, east 2, south 4, west 8).
   * @param {function} seen `(x, y) => boolean`, for cells on the map
   */
  mask (seen, x, y) {
    var at = (cx, cy) => (cx < 0 || cy < 0 || cx >= this.columns || cy >= this.rows) ? this.edge === 'seen' : !!seen(cx, cy)
    return (at(x, y - 1) ? 1 : 0) | (at(x + 1, y) ? 2 : 0) | (at(x, y + 1) ? 4 : 0) | (at(x - 1, y) ? 8 : 0)
  }

  /**
   * Brings the cells up to date with what has been seen.
   * @param {function} seen `(x, y) => boolean`, for cells on the map
   * @param {object} [area] `{ x, y, width, height }` in cells: only these (the view), or the whole map
   */
  update (seen, area) {
    var a = area || { x: 0, y: 0, width: this.columns, height: this.rows }
    var grid = this.grid
    var x0 = Math.max(0, a.x)
    var y0 = Math.max(0, a.y)
    var x1 = Math.min(this.columns, a.x + a.width)
    var y1 = Math.min(this.rows, a.y + a.height)
    for (var y = y0; y < y1; y++) {
      for (var x = x0; x < x1; x++) {
        if (!seen(x, y)) {
          grid[y][x] = this.unseen
          continue
        }
        var mask = this.mask(seen, x, y)
        grid[y][x] = mask === 15 ? null : this.edges(mask)
      }
    }
    this.scene.invalidate()
  }
}

export default Shroud
