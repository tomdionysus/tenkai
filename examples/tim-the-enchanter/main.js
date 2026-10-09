const { GameEngine, TiledScene, Entity, Sheet } = require('../../index')
const ORIGINAL_MAP = require('./map.json')
const TILESET = require('./assets/tileset_dungeon.json')
const Editor = require('./editor')

const TILE = 64
// Seconds to walk one tile, and how high a hop rises above the higher of its two ends, in pixels
const STEP_TIME = 0.4
const HOP_HEIGHT = 14

const DIRECTIONS = {
  down: { row: 0, dx: 0, dy: 1 },
  left: { row: 1, dx: -1, dy: 0 },
  right: { row: 2, dx: 1, dy: 0 },
  up: { row: 3, dx: 0, dy: -1 }
}

const SAVE_KEY = 'tenkai-tim-the-enchanter-map'

/**
 * Tim the Enchanter: Gallagher the cat explores a dungeon room, one tile at a time. The room is a
 * depth-sorted TiledScene, so Gallagher passes behind and in front of the furniture, and jumps up onto it.
 * Tab switches to the map editor.
 */
class TimTheEnchanter extends GameEngine {
  constructor (options = {}) {
    super(Object.assign({
      enableScroll: false,
      enableZoom: false,
      pixelated: true,
      keys: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['Space'], mode: ['Tab'] }
    }, options))
    this.addAsset('dungeon', 'assets/tileset_dungeon.png')
    this.addAsset('gallagher', 'assets/gallagher.png')
    this.message = null
  }

  init () {
    this.dungeon = new Sheet(Object.assign({ image: this.getAsset('dungeon') }, TILESET))

    // Gallagher's sheet: three frames for each of four directions, one direction per row. His position is
    // the bottom middle of his tile, where he stands.
    var clips = {}
    for (var dir in DIRECTIONS) clips[dir] = { row: DIRECTIONS[dir].row, columns: [0, 1, 2, 1], delay: 100, loop: true }
    this.catSheet = new Sheet({ image: this.getAsset('gallagher'), tileWidth: TILE, tileHeight: TILE, anchor: [TILE / 2, TILE], clips })

    this.room = this.addScene('room', new TiledScene({
      sheet: this.dungeon,
      perspectiveMode: TiledScene.PERSPECTIVE_DEPTH,
      foreground: (context) => this.drawOverlay(context)
    }))
    this.cat = new Cat(this, this.room.addEntity('gallagher', new Entity({ sheet: this.catSheet })))

    this.play = new Play(this)
    this.editor = new Editor(this)
    this.loadMap(savedMap() || copy(ORIGINAL_MAP))
    this.setMode(this.play)

    this.on('mousedown', () => { if (this.mode.click) this.mode.click(this.mouseX, this.mouseY) })
  }

  // Put a map in the room: its layers, solidity overrides and torches, with Gallagher at the start
  loadMap (map) {
    this.map = map
    this.room.layers = map.layers
    this.room.clearSolid()
    for (var key in map.solid) this.room.setSolid(...key.split(',').map(Number), map.solid[key])

    for (var old of this.torches || []) this.room.removeEntity(old.name)
    this.torches = map.torches.map((t, i) => {
      // A torch hangs on the face of the wall, which stands at the top of its row, so the torch stands just in
      // front of that line, behind anything on the floor below it
      var torch = new Entity({ sheet: this.dungeon, anchor: [TILE / 2, 1], x: t.x * TILE + TILE / 2, y: t.y * TILE + 1 })
      this.room.addEntity('torch' + i, torch).play('torch')
      return torch
    })

    this.cat.place(map.start.x, map.start.y, map.start.facing)
  }

  update (dt) {
    if (this.input.pressed('mode')) this.setMode(this.mode === this.play ? this.editor : this.play)
    super.update(dt)
  }

  say (text) {
    this.message = text
    if (this.messageTimer) this.messageTimer.cancel()
    this.messageTimer = this.after(3, () => { this.message = null })
  }

  saveMap () {
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.map)) } catch (e) {}
    console.log(JSON.stringify(this.map))
  }

  revertMap () {
    try { window.localStorage.removeItem(SAVE_KEY) } catch (e) {}
    this.loadMap(copy(ORIGINAL_MAP))
  }

  // Over the room: the editor's markers, then the title and help in the room's empty corner, and messages
  drawOverlay (context) {
    if (this.mode.drawMarkers) this.mode.drawMarkers(context)
    context.save()
    context.textBaseline = 'top'
    context.fillStyle = '#e8d8b0'
    context.font = 'bold 28px Georgia, "Times New Roman", serif'
    context.fillText('Tim the Enchanter', 24, 456)
    context.font = '16px Georgia, "Times New Roman", serif'
    context.fillStyle = '#b8a888'
    this.mode.help.forEach((line, i) => context.fillText(line, 24, 500 + i * 22))
    if (this.message) {
      context.font = 'italic 20px Georgia, "Times New Roman", serif'
      context.textAlign = 'center'
      var w = context.measureText(this.message).width + 40
      context.fillStyle = 'rgba(0, 0, 0, 0.75)'
      context.fillRect(this.width / 2 - w / 2, 300, w, 40)
      context.fillStyle = '#f0e0b8'
      context.fillText(this.message, this.width / 2, 310)
    }
    context.restore()
  }
}

/**
 * Gallagher: which cell he is in, which way he faces, and how high he stands. He walks a cell at a time on
 * the floor, or along the top of something at the same height, and jumps up onto things: a chair seat, the
 * bed, a table. Walking off something hops him down to the floor.
 */
class Cat {
  constructor (game, entity) {
    this.game = game
    this.entity = entity
    this.step = null
    this.height = 0
  }

  place (x, y, facing) {
    this.x = x
    this.y = y
    this.facing = facing
    this.step = null
    this.height = 0
    this.moveEntity(x, y, 0)
    this.stand()
  }

  moveEntity (x, y, elevation) {
    this.entity.x = Math.round(x * TILE + TILE / 2)
    this.entity.y = Math.round((y + 1) * TILE)
    this.entity.elevation = Math.round(elevation)
  }

  // Whether the floor of a cell is open to walk on
  floorOpen (x, y) {
    return !this.game.room.isSolid(x, y)
  }

  // The height of the lowest thing in a cell he could stand on top of, or null
  surfaceAt (x, y) {
    var room = this.game.room
    var heights = room.tilesAt(x, y).map((t) => room.sheet.info(t.tile, t.overrides).surface).filter((h) => h != null)
    return heights.length ? Math.min(...heights) : null
  }

  stand () {
    this.entity.stop()
    this.entity.tile = [1, DIRECTIONS[this.facing].row]
  }

  // Walk a cell: along the floor, along the top of something at his height, or down off it. Returns whether
  // a step started.
  go (dir) {
    var d = DIRECTIONS[dir]
    this.facing = dir
    var x = this.x + d.dx
    var y = this.y + d.dy
    var to = null
    if (this.height > 0 && this.surfaceAt(x, y) === this.height) to = this.height
    else if (this.floorOpen(x, y)) to = 0
    return to === null ? (this.stand(), false) : this.startStep(x, y, to, dir)
  }

  // Jump a cell: up onto whatever can be stood on there, or down to the floor, or a hop along it
  jump (dir) {
    var d = DIRECTIONS[dir]
    this.facing = dir
    var x = this.x + d.dx
    var y = this.y + d.dy
    var surface = this.surfaceAt(x, y)
    var to = surface !== null ? surface : (this.floorOpen(x, y) ? 0 : null)
    return to === null ? (this.stand(), false) : this.startStep(x, y, to, dir, true)
  }

  startStep (x, y, to, dir, jumping = false) {
    this.step = { fromX: this.x, fromY: this.y, toX: x, toY: y, from: this.height, to, arc: jumping || to !== this.height, t: 0 }
    this.entity.play(dir)
    return true
  }

  // Move along the current step; at its end, report the cell arrived in
  update (dt) {
    var s = this.step
    if (!s) return null
    s.t = Math.min(1, s.t + dt / STEP_TIME)
    var hop = s.arc ? Math.sin(Math.PI * s.t) * HOP_HEIGHT : 0
    this.moveEntity(s.fromX + (s.toX - s.fromX) * s.t, s.fromY + (s.toY - s.fromY) * s.t, s.from + (s.to - s.from) * s.t + hop)
    if (s.t < 1) return null
    this.x = s.toX
    this.y = s.toY
    this.height = s.to
    this.step = null
    return [this.x, this.y]
  }
}

/** Walking about. */
class Play {
  constructor (game) {
    this.game = game
    this.help = ['Arrow keys: walk', 'Space: jump up onto a chair, the bed or a table', 'Tab: map editor']
  }

  enter () {
    this.jumpWanted = false
    this.game.cat.stand()
  }

  update (dt) {
    var game = this.game
    var cat = game.cat
    // A jump asked for in the middle of a step happens when the step ends
    if (game.input.pressed('jump')) this.jumpWanted = true
    var arrived = cat.update(dt)
    if (arrived) {
      var trigger = game.map.triggers.find((t) => t.x === arrived[0] && t.y === arrived[1])
      if (trigger && trigger.type === 'exit') game.say('A way out. There is nothing beyond it yet.')
    }
    if (cat.step) return

    // The most recently pressed arrow that is still held; he keeps walking while it is held
    var dir = game.input.latest('up', 'down', 'left', 'right')
    if (this.jumpWanted) {
      this.jumpWanted = false
      return cat.jump(dir || cat.facing)
    }
    if (!dir) return cat.stand()
    cat.go(dir)
  }
}

function savedMap () {
  try {
    var saved = window.localStorage.getItem(SAVE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch (e) {
    return null
  }
}

function copy (o) {
  return JSON.parse(JSON.stringify(o))
}

var game = new TimTheEnchanter({ targetId: 'game' })
game.start()
window.game = game
