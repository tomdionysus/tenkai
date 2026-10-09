// The map editor, a mode of the game. A cursor over the room steps the tile in each layer of a cell
// through the tileset, places whole objects (a chair, a bed) from the tileset's description, and marks
// cells as passable or solid where the tiles alone would say otherwise. The room's TiledScene draws the map
// being edited, so changes show at once.

// Marker tiles in the dungeon tileset
const CURSOR = [2, 8]
const SOLID = [1, 9]
const TRIGGER = [2, 9]

class Editor {
  constructor (game) {
    this.game = game
    this.x = 0
    this.y = 0
    this.z = 1
    this.objectIndex = 0
  }

  get room () { return this.game.room }
  get map () { return this.game.map }
  get objectNames () { return Object.keys(this.room.sheet.objects) }
  get objectName () { return this.objectNames[this.objectIndex] }

  enter () {
    this.x = this.game.cat.x
    this.y = this.game.cat.y
  }

  get help () {
    var placement = this.room.tilesAt(this.x, this.y).find((t) => t.layer === this.z)
    var info = placement ? this.room.sheet.info(placement.tile, placement.overrides) : null
    var describe = info
      ? 'tile ' + placement.tile.join(',') + (info.flat ? ', flat' : ', upright, elevation ' + info.elevation + (info.stand ? ', stands ' + info.stand + ' down' : ''))
      : 'empty'
    return [
      'Cell ' + this.x + ',' + this.y + (this.room.isSolid(this.x, this.y) ? ' (solid)' : '') + '   layer ' + this.z + ': ' + describe,
      'Arrows or click: move   Q E: layer   A D W S: tile   Backspace: clear',
      'O: object (' + this.objectName + ')   Enter: place it   B: solid / open   Z: save   X: revert'
    ]
  }

  update () {
    var input = this.game.input
    var moves = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }
    for (var dir in moves) if (input.pressed(dir)) this.moveTo(this.x + moves[dir][0], this.y + moves[dir][1])
    var keys = {
      KeyQ: () => { this.z = Math.max(0, this.z - 1) },
      KeyE: () => { this.z = Math.min(this.room.layerKeys.length, this.z + 1) },
      KeyA: () => this.stepTile(-1, 0),
      KeyD: () => this.stepTile(1, 0),
      KeyW: () => this.stepTile(0, -1),
      KeyS: () => this.stepTile(0, 1),
      Backspace: () => this.room.setTile(this.z, this.x, this.y, null),
      KeyO: () => { this.objectIndex = (this.objectIndex + 1) % this.objectNames.length },
      Enter: () => this.placeObject(),
      KeyB: () => this.toggleSolid(),
      KeyZ: () => { this.game.saveMap(); this.game.say('Map saved in this browser, and written to the console.') },
      KeyX: () => { this.game.revertMap(); this.game.say('Map reverted to the original.') }
    }
    for (var code in keys) if (input.pressed(code)) keys[code]()
  }

  moveTo (x, y) {
    this.x = Math.max(0, Math.min(this.map.width - 1, x))
    this.y = Math.max(0, Math.min(this.map.height - 1, y))
  }

  click (px, py) {
    this.moveTo(...this.room.cellAt(px, py))
  }

  // Step the tile in the current layer through the tileset, starting from the top-left tile if empty
  stepTile (dx, dy) {
    var placement = this.room.tilesAt(this.x, this.y).find((t) => t.layer === this.z)
    var tile = placement ? placement.tile : [0, 0]
    var sheet = this.room.sheet
    this.room.setTile(this.z, this.x, this.y, [(tile[0] + dx + sheet.columns) % sheet.columns, (tile[1] + dy + sheet.rows) % sheet.rows])
  }

  // Lay an object's tiles out as they are in the tileset, with its anchor tile at the cursor, in the lowest
  // layer above the floor that is empty in all those cells
  placeObject () {
    var object = this.room.sheet.objects[this.objectName]
    var left = Math.min(...object.tiles.map((t) => t[0]))
    var top = Math.min(...object.tiles.map((t) => t[1]))
    var cells = object.tiles.map((t) => ({ tile: t, x: this.x + t[0] - left - object.anchor[0], y: this.y + t[1] - top - object.anchor[1] }))
    var layer = 1
    while (cells.some((c) => this.room.tilesAt(c.x, c.y).some((t) => t.layer === layer))) layer++
    for (var c of cells) this.room.setTile(layer, c.x, c.y, c.tile)
  }

  // Cycle a cell between what its tiles say, forced solid, and forced open
  toggleSolid () {
    var key = this.x + ',' + this.y
    var next = !(key in this.map.solid) ? !this.room.isSolid(this.x, this.y) : null
    if (next === null) delete this.map.solid[key]
    else this.map.solid[key] = next
    this.room.setSolid(this.x, this.y, next)
  }

  // Solid cells, triggers and the cursor, in the room's coordinates
  drawMarkers (context) {
    var room = this.room
    var mark = (tile, x, y) => room.sheet.draw(context, tile, x * room.tileWidth, y * room.tileHeight)
    context.save()
    context.globalAlpha = 0.45
    for (var y = 0; y < this.map.height; y++) {
      for (var x = 0; x < this.map.width; x++) if (room.isSolid(x, y)) mark(SOLID, x, y)
    }
    context.globalAlpha = 1
    this.map.triggers.forEach((t) => mark(TRIGGER, t.x, t.y))
    mark(CURSOR, this.x, this.y)
    context.restore()
  }
}

module.exports = Editor
