// Blood remade on Tenkai: the client. It shows Tenkai's start screen, finds the game's server (ServerFinder), joins
// it (GameClient), and draws what the server says through a WebGL scene (BuildView). Its only own state is where the
// player looks (sent with the keys held); everything else, every step of the game, is the server's.
import { GameEngine, GameClient, ServerFinder, ServerConfig } from '../../../index.js'
import BuildView from './view/BuildView.js'
import World from './net/World.js'
import Hud from './view/Hud.js'
import Sounds from './Sounds.js'
import { json, addImages, image } from './data.js'

const KEYS = {
  forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
  strafeLeft: ['KeyA', 'Comma'], strafeRight: ['KeyD', 'Period'], jump: ['Space'], crouch: ['KeyC', 'ControlLeft'],
  open: ['KeyE', 'Enter'], fire: ['KeyF'], scores: ['Tab'], medkit: ['KeyM'], altFire: ['KeyX'], walk: ['ShiftLeft', 'ShiftRight'], lookUp: ['PageUp'], lookDown: ['PageDown'], lookCenter: ['End'],
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n, i) => ['weapon' + (i + 1), ['Digit' + n]]))
}
const BUTTON = { jump: 1, crouch: 2, fire: 4, altFire: 8, lookUp: 16, lookDown: 32 }
const KEY = { action: 1, lookCenter: 256 }

export default class BloodClient extends GameEngine {
  constructor (indexes, options = {}) {
    super(Object.assign({
      targetId: 'game', fullscreen: true, enableScroll: false, enableZoom: false, pixelated: true, keys: KEYS,
      startScreen: { title: 'BLOOD', year: 1997, publisher: 'Monolith Productions', background: '#120000', color: '#e8d8c8', logoColor: '#a01010' }
    }, options))
    this.indexes = indexes
    addImages(this, indexes.tiles.pages.length)
    for (let k = 0; k < indexes.tiles.pages.length; k++) this.addAsset('tiles-' + k, 'data/tiles-' + k + '.png')
    this.look = { ang: 0, horiz: 100 }
    this.mouse = { dx: 0, dy: 0 }
    this.worlds = {}
  }

  async init () {
    this.view = this.addScene('view', new BuildView({ tiles: this.indexes.tiles, palettes: this.indexes.palettes, image: image(this) }))
    this.hud = new Hud(this)
    this.sounds = new Sounds(this, this.indexes.sounds)
    this.sounds.manager.base = ''
    this.pointerLook()
    const finder = new ServerFinder({ key: 'blood-server', config: new ServerConfig({ document, title: 'Blood server' }) })
    this.client = new GameClient({ name: localStorage.getItem('blood-name') || 'Caleb', tickTime: 1 / 30 })
    this.client.onWelcome = (c) => this.welcome(c)
    this.client.onEvent = (e) => this.event(e)
    this.client.onClose = async () => { this.hud.say('The connection to the server was lost.'); await finder.lost(this.address); window.location.reload() }
    const { socket, address } = await finder.find()
    this.address = address
    this.client.connect(socket)
    window.blood = this
  }

  async welcome (client) {
    await this.loadMap(client.state.map)
    const you = client.state.you
    this.look.ang = you.ang
    this.look.horiz = you.horiz
    this.hud.say(client.state.title)
  }

  async loadMap (name) {
    if (this.mapName === name) return
    this.mapName = name
    this.playSong(this.client.state.song)
    const map = await json('data/maps/' + name + '.json')
    this.world = new World(map)
    this.view.setMap(map)
  }

  /** The level's song (BLOOD.INI's Song), rendered to MP3 from the original's MIDI */
  async playSong (song) {
    if (!song || !this.sounds) return
    if (!this.music) this.music = await json('data/music.json').catch(() => ({}))
    const m = this.music[song]
    if (m) this.sounds.manager.playMusic('data/' + m.file, { volume: 0.5 })
  }

  event (e) {
    if (e.type === 'message') this.hud.say(e.text)
    else if (e.type === 'sound' && this.sounds) this.sounds.event(e, this.view.eye)
  }

  /** The mouse turns and looks once the canvas has the pointer (a click takes it) */
  pointerLook () {
    const canvas = this.element
    canvas.addEventListener('click', () => { if (document.pointerLockElement !== canvas && canvas.requestPointerLock) canvas.requestPointerLock() })
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return
      this.mouse.dx += e.movementX
      this.mouse.dy += e.movementY
    })
    canvas.addEventListener('mousedown', (e) => { if (document.pointerLockElement === canvas) this.mouse[e.button === 2 ? 'alt' : 'fire'] = true })
    canvas.addEventListener('mouseup', (e) => { this.mouse[e.button === 2 ? 'alt' : 'fire'] = false })
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  update (dt) {
    if (!this.client || !this.client.player || !this.world) return
    const i = this.input
    // The view angles: the mouse and the turning keys, here (sent to the server, which moves the player by them)
    const turnKeys = i.axis('left', 'right')
    this.look.ang = (this.look.ang + this.mouse.dx * 2 + turnKeys * 1024 * dt + 2048 * 4) % 2048
    this.look.horiz = Math.max(0, Math.min(200, this.look.horiz - this.mouse.dy * 0.6 + i.axis('lookDown', 'lookUp') * 120 * dt))
    if (i.pressed('lookCenter')) this.look.horiz = 100
    this.mouse.dx = this.mouse.dy = 0
    const run = !i.down('walk')
    const move = run ? 2048 : 1024
    let buttons = 0, keys = 0, newWeapon = 0
    if (i.down('jump')) buttons |= BUTTON.jump
    if (i.down('crouch')) buttons |= BUTTON.crouch
    if (i.down('fire') || this.mouse.fire) buttons |= BUTTON.fire
    if (i.down('altFire') || this.mouse.alt) buttons |= BUTTON.altFire
    if (i.down('open')) keys |= KEY.action
    for (let n = 1; n <= 10; n++) if (i.pressed('weapon' + n)) newWeapon = n
    let use = 0
    if (i.down('medkit')) use |= 8
    const held = {
      run: run ? 1 : 0, forward: i.axis('back', 'forward') * move, strafe: i.axis('strafeRight', 'strafeLeft') * move,
      ang: Math.round(this.look.ang) & 2047, horiz: Math.round(this.look.horiz), buttons, keys, newWeapon, use
    }
    // A script driving the page (the checks in tools/) holds keys by setting `forced`
    if (this.forced) { Object.assign(held, this.forced); if (this.forced.ang !== undefined) this.look.ang = this.forced.ang }
    // Numbered when it changes: the server says which it has taken (Quake's way, for prediction)
    const text = JSON.stringify(held)
    if (text !== this.lastHeld) { this.lastHeld = text; this.inputSeq = (this.inputSeq || 0) + 1 }
    held.seq = this.inputSeq
    this.client.input(held)
    this.view.clock += dt * 120
  }

  draw (context) {
    if (this.client && this.client.state && this.world) this.drawWorld()
    super.draw(context)
  }

  drawWorld () {
    const c = this.client, state = c.state, previous = c.previous, t = c.fraction()
    if (state.map !== this.mapName) { this.loadMap(state.map); return }
    for (const s of this.world.apply(state)) this.view.changed(s)
    const you = state.you, was = (previous && previous.you) || you
    if (!you) return
    const lerp = (a, b) => a + (b - a) * t
    // The view shakes after a shot or a blast, by the server's amount
    const shake = you.shake ? (Math.random() * 2 - 1) * you.shake / 4 : 0
    this.view.eye = { x: lerp(was.x, you.x), y: lerp(was.y, you.y), z: lerp(was.z, you.z) + shake, ang: this.look.ang, horiz: you.dead ? 100 : this.look.horiz }
    // The weapon sways as the player moves (Blood's bob), and takes the light of where the player stands
    const speed = Math.hypot(you.x - was.x, you.y - was.y)
    this.bobPhase = (this.bobPhase || 0) + speed / 40
    const amount = Math.min(1, speed / 150)
    this.bob = { x: Math.sin(this.bobPhase) * 6 * amount, y: Math.abs(Math.cos(this.bobPhase)) * 6 * amount }
    const sec = this.world.map.sectors[you.sectnum]
    this.weaponShade = sec ? sec.floorshade : 0
    // Under water the world is seen through WATER.PAL (Blood's palette 1)
    const xs = sec && sec.extra >= 0 ? this.world.map.xsectors[sec.extra] : null
    this.view.palette = xs && xs.underwater ? 1 : 0
    this.view.sprites = this.world.sprites(previous, state, t, you.sprite)
  }

  drawOver (context) { if (this.hud) this.hud.draw(context) }
}

Promise.all([json('data/tiles.json'), json('data/palettes.json'), json('data/sounds.json')]).then(([tiles, palettes, sounds]) => new BloodClient({ tiles, palettes, sounds }).start())
