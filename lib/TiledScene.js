import Scene from './Scene.js'
import Sheet from './Sheet.js'

/**
 * TiledScene draws a map built from the tiles of a {@link Sheet}, in layers, with entities among them.
 *
 * The map is `layers`: each layer is a grid of rows, and each cell either `null` or a tile placement,
 * `[column, row]`, or `[column, row, overrides]` to change what the sheet says about that tile for this
 * placement (see {@link Sheet#info}).
 *
 * There are two ways to draw it:
 *
 * - `PERSPECTIVE_OVERHEAD` (the default): layers in key order, with child scenes between them by `z`, then
 *   all entities by `z`. For top-down maps where characters are always on top.
 * - `PERSPECTIVE_DEPTH`: the sheet's flat tiles (floor, rugs) first, then upright tiles (walls, furniture)
 *   and entities together in depth order: by the line each stands on, then by elevation. A character
 *   behind a chair is hidden by it, one on its seat is drawn over the seat but under its back, and one in
 *   front is drawn over it. Layer order only breaks ties. Child scenes are drawn last, as overlays.
 *
 * @extends Scene
 * @example
const room = new TiledScene({
  sheet: dungeon,                      // a Sheet whose `tiles` say which are flat, upright and solid
  layers: map.layers,
  perspectiveMode: TiledScene.PERSPECTIVE_DEPTH
})
room.addEntity('cat', cat)
if (!room.isSolid(x + 1, y)) walk()
 */
class TiledScene extends Scene {
  /**
	* @param {object} options The options for the TiledScene, as well as those of {@link Scene}:
	* @property {Sheet} sheet The tiles (or `asset` with `tileWidth` and `tileHeight`, for a plain grid)
	* @property {object|Array} layers The map: layers keyed by number, each a grid of tile placements
	* @property {number} perspectiveMode `TiledScene.PERSPECTIVE_OVERHEAD` or `TiledScene.PERSPECTIVE_DEPTH`
	*/
  constructor (options = {}) {
    super(options)
    this.sheet = options.sheet || new Sheet({ image: options.asset, tileWidth: options.tileWidth || 32, tileHeight: options.tileHeight || 32 })
    this._solid = {}
    this.layers = options.layers || {}
  }

  get tileWidth () { return this.sheet.tileWidth }
  get tileHeight () { return this.sheet.tileHeight }

  /** The map's layers. Setting them replaces the whole map. */
  get layers () { return this._layers }
  set layers (layers) {
    this._layers = layers
    this.invalidate()
  }

  /** Call after changing `layers` in place, so the next draw sees the change. `setTile` does this itself. */
  invalidate () {
    this._pieces = null
  }

  // Map queries and editing

  /** The keys of the layers, as numbers in ascending order. */
  get layerKeys () {
    return Object.keys(this._layers).map(Number).sort((a, b) => a - b)
  }

  /**
   * The placements in a cell, lowest layer first.
   * @returns {Array} Each `{ layer, tile, overrides }`
   */
  tilesAt (x, y) {
    var out = []
    for (var z of this.layerKeys) {
      var p = this._cell(z, x, y)
      if (p) out.push({ layer: z, tile: [p[0], p[1]], overrides: p[2] || null })
    }
    return out
  }

  _cell (z, x, y) {
    var layer = this._layers[z]
    return layer && layer[y] ? layer[y][x] : null
  }

  /**
   * Place a tile, or remove one with `null`. Creates the layer and rows as needed.
   * @param {number} z The layer
   * @param {integer} x Cell column
   * @param {integer} y Cell row
   * @param {Array|null} placement `[column, row]`, `[column, row, overrides]`, or null
   */
  setTile (z, x, y, placement) {
    var layer = this._layers[z] || (this._layers[z] = [])
    while (layer.length <= y) layer.push([])
    layer[y][x] = placement
    this.invalidate()
  }

  /**
   * Whether a cell blocks movement: a cell override if there is one, otherwise whether any of its tiles is
   * solid. A cell with no tiles at all is solid, so the edge of the map holds things in.
   */
  isSolid (x, y) {
    var key = x + ',' + y
    if (key in this._solid) return this._solid[key]
    var tiles = this.tilesAt(x, y)
    return tiles.length === 0 || tiles.some((t) => this.sheet.info(t.tile, t.overrides).solid)
  }

  /**
   * Override whether a cell is solid, such as a doorway through a wall tile. `null` removes the override.
   */
  setSolid (x, y, solid) {
    var key = x + ',' + y
    if (solid == null) delete this._solid[key]
    else this._solid[key] = !!solid
  }

  /** Remove every solidity override. */
  clearSolid () {
    this._solid = {}
  }

  /** The cell containing a point in the scene's coordinates, as [x, y]. */
  cellAt (px, py) {
    return [Math.floor(px / this.tileWidth), Math.floor(py / this.tileHeight)]
  }

  // Drawing

  drawContent (context) {
    if (!this._sceneOrderMap) this.sortScenesZ()
    if (this.perspectiveMode === TiledScene.PERSPECTIVE_DEPTH) return this._drawDepth(context)

    // Layers and child scenes share one z order: at each z, the layer's tiles, then the scenes at that z
    for (var z of this._layerOrder()) this._drawLayer(context, z)
    this.drawEntities(context)
  }

  // Every z that has a layer or a child scene, in ascending order
  _layerOrder () {
    var zs = new Set(Object.keys(this._layers).concat(Object.keys(this._sceneOrderMap)).map(Number))
    return Array.from(zs).sort((a, b) => a - b)
  }

  _drawLayer (context, z) {
    var layer = this._layers[z]
    if (layer) {
      // Only the cells that can be seen
      var b = this.visibleBounds(context)
      var w = this.tileWidth
      var h = this.tileHeight
      var y0 = b ? Math.max(0, Math.floor(b[1] / h)) : 0
      var y1 = b ? Math.min(layer.length, Math.ceil(b[3] / h)) : layer.length
      for (var y = y0; y < y1; y++) {
        var row = layer[y]
        if (!row) continue
        var x0 = b ? Math.max(0, Math.floor(b[0] / w)) : 0
        var x1 = b ? Math.min(row.length, Math.ceil(b[2] / w)) : row.length
        for (var x = x0; x < x1; x++) {
          if (row[x]) this.sheet.draw(context, row[x], x * w, y * h)
        }
      }
    }
    this.drawScenes(context, z)
  }

  // Depth drawing: the ground, then upright tiles merged with the entities in depth order
  _drawDepth (context) {
    var pieces = this._depthPieces()
    for (var g of pieces.ground) this.sheet.draw(context, g.tile, g.x, g.y)

    var entities = this.sortedEntities()
    var upright = pieces.upright
    var i = 0
    var j = 0
    while (i < upright.length || j < entities.length) {
      var p = upright[i]
      var e = entities[j]
      // A tile goes first unless the entity stands nearer the back, or at the same line but lower
      if (p && (!e || p.base < e.y || (p.base === e.y && p.elevation <= (e.elevation || 0)))) {
        this.sheet.draw(context, p.tile, p.x, p.y)
        i++
      } else {
        e.draw(context)
        j++
      }
    }
    this.drawScenes(context)
  }

  // Every placement, resolved into ground pieces and upright pieces in depth order. Cached until the map
  // changes.
  _depthPieces () {
    if (this._pieces) return this._pieces
    var ground = []
    var upright = []
    var w = this.tileWidth
    var h = this.tileHeight
    var order = 0
    for (var z of this.layerKeys) {
      var layer = this._layers[z]
      for (var y = 0; y < layer.length; y++) {
        var row = layer[y]
        if (!row) continue
        for (var x = 0; x < row.length; x++) {
          var p = row[x]
          if (!p) continue
          var info = this.sheet.info(p, p[2])
          var piece = { tile: [p[0], p[1]], x: x * w, y: y * h, elevation: info.elevation, order: order++ }
          if (info.flat) {
            ground.push(piece)
          } else {
            // The line its object stands on: the bottom of the row `stand` rows below this one
            piece.base = (y + 1 + info.stand) * h
            upright.push(piece)
          }
        }
      }
    }
    ground.sort((a, b) => (a.elevation - b.elevation) || (a.order - b.order))
    upright.sort((a, b) => (a.base - b.base) || (a.elevation - b.elevation) || (a.order - b.order))
    this._pieces = { ground, upright }
    return this._pieces
  }
}

TiledScene.PERSPECTIVE_OVERHEAD = Scene.PERSPECTIVE_OVERHEAD
TiledScene.PERSPECTIVE_DEPTH = Scene.PERSPECTIVE_DEPTH

export default TiledScene
