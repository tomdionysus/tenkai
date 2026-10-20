// A fly-through of a map with no server: the view alone, to check the drawing against the original's.
//   fly.html?map=e1m1&x=..&y=..&z=..&ang=..&horiz=..
// Arrows turn and move, A and Z rise and fall, Page Up and Page Down look up and down.
import { GameEngine } from '../../../index.js'
import BuildView from './view/BuildView.js'
import { json, addImages, image } from './data.js'

const params = new URLSearchParams(window.location.search)

class Fly extends GameEngine {
  constructor (tiles, palettes) {
    super({ targetId: 'game', fullscreen: true, enableScroll: false, enableZoom: false, pixelated: true,
      keys: { left: ['ArrowLeft'], right: ['ArrowRight'], forward: ['ArrowUp'], back: ['ArrowDown'], up: ['KeyA'], down: ['KeyZ'], lookUp: ['PageUp'], lookDown: ['PageDown'], strafe: ['AltLeft'] } })
    this.tilesIndex = tiles
    this.palettesIndex = palettes
    addImages(this, tiles.pages.length)
  }

  async init () {
    const name = params.get('map') || 'e1m1'
    const map = await json('data/maps/' + name + '.json')
    this.view = this.addScene('view', new BuildView({ tiles: this.tilesIndex, palettes: this.palettesIndex, image: image(this) }))
    this.view.setMap(map)
    const s = map.start
    this.view.eye = {
      x: Number(params.get('x') || s.x), y: Number(params.get('y') || s.y), z: Number(params.get('z') || (map.sectors[s.sector].floorz - 0x2600)),
      ang: Number(params.get('ang') || s.ang), horiz: Number(params.get('horiz') || 100)
    }
    window.fly = this
  }

  update (dt) {
    if (!this.view) return
    const e = this.view.eye, i = this.input
    this.view.clock += dt * 120
    e.ang = (e.ang + i.axis('left', 'right') * 600 * dt + 2048) % 2048
    const a = e.ang / 2048 * Math.PI * 2, speed = 2048 * dt * i.axis('back', 'forward')
    e.x += Math.cos(a) * speed
    e.y += Math.sin(a) * speed
    e.z += i.axis('up', 'down') * 16384 * dt
    e.horiz = Math.max(0, Math.min(200, e.horiz + i.axis('lookDown', 'lookUp') * 100 * dt))
  }
}

Promise.all([json('data/tiles.json'), json('data/palettes.json')]).then(([tiles, palettes]) => new Fly(tiles, palettes).start())
