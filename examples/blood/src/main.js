// Blood remade on Tenkai: the client. It shows Tenkai's start screen, finds the game's server (ServerFinder), joins
// it (GameClient), and draws what the server says through a WebGL scene (BuildView). Its only own state is where the
// player looks (sent with the keys held); everything else, every step of the game, is the server's.
import { GameEngine, GameClient, ServerFinder, ServerConfig } from '../../../index.js'
import BuildView from './view/BuildView.js'
import World from './net/World.js'
import Hud from './view/Hud.js'
import Sounds from './Sounds.js'
import { json, addImages, image } from './data.js'

// (no Ctrl key: with W it is the browser's close-tab, which a page cannot stop)
const KEYS = {
  forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
  strafeLeft: ['KeyA', 'Comma'], strafeRight: ['KeyD', 'Period'], jump: ['Space'], crouch: ['KeyC', 'KeyZ'],
  open: ['KeyE'], fire: ['KeyF'], scores: ['Tab'], medkit: ['KeyM'], beastVision: ['KeyB'], crystalBall: ['KeyK'], jumpBoots: ['KeyJ'],
  prevItem: ['BracketLeft'], nextItem: ['BracketRight'], useItem: ['Enter'], altFire: ['KeyX'], walk: ['ShiftLeft', 'ShiftRight'], lookUp: ['PageUp'], lookDown: ['PageDown'], lookCenter: ['End'],
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n, i) => ['weapon' + (i + 1), ['Digit' + n]]))
}
const BUTTON = { jump: 1, crouch: 2, fire: 4, altFire: 8, lookUp: 16, lookDown: 32 }
const KEY = { action: 1, prevItem: 4, nextItem: 8, useItem: 16, lookCenter: 256 }

export default class BloodClient extends GameEngine {
  constructor (indexes, options = {}) {
    super(Object.assign({
      targetId: 'game', fullscreen: true, enableScroll: false, enableZoom: false, pixelated: true, keys: KEYS,
      startScreen: { title: 'BLOOD', year: 1997, publisher: 'Monolith Productions', cover: 'assets/cover.png' }
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
    json('data/voxels.json').then((v) => this.view.setVoxels(v)).catch(() => {})
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

  /**
   * The mouse turns and looks while the game has it: once a click on the game takes the pointer (pointer lock), or,
   * where the browser will not give it, from that click while the page has the focus. Leaving the page (or Escape)
   * lets the mouse go; a click takes it again
   */
  pointerLook () {
    const canvases = () => [this.element, this.view && this.view.canvas].filter(Boolean)
    const shown = () => canvases().find((c) => c.style.visibility !== 'hidden' && c.style.display !== 'none') || this.element
    const locked = () => canvases().includes(document.pointerLockElement)
    this.mouseHeld = false
    const release = () => { this.mouseHeld = false; this.mouse.fire = this.mouse.alt = false }
    const lock = () => {
      const canvas = shown()
      if (locked() || !canvas.requestPointerLock) return
      try {
        const r = canvas.requestPointerLock()
        if (r && r.catch) r.catch(() => {})
      } catch (e) {}
    }
    document.addEventListener('mousedown', (e) => {
      if (!canvases().includes(e.target)) return
      // (the click that takes the mouse only takes it; the next ones fire)
      const had = this.mouseHeld || locked()
      this.mouseHeld = true
      lock()
      if (had) this.mouse[e.button === 2 ? 'alt' : 'fire'] = true
    })
    document.addEventListener('mousemove', (e) => {
      if (!locked() && !(this.mouseHeld && document.hasFocus() && canvases().includes(e.target))) return
      this.mouse.dx += e.movementX || 0
      this.mouse.dy += e.movementY || 0
    })
    document.addEventListener('mouseup', (e) => { this.mouse[e.button === 2 ? 'alt' : 'fire'] = false })
    document.addEventListener('contextmenu', (e) => { if (canvases().includes(e.target)) e.preventDefault() })
    // The pointer let go (Escape), the page left or hidden: the mouse is the player's again
    document.addEventListener('pointerlockchange', () => { if (!locked()) release() })
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', () => { if (document.hidden) release() })
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') release() })
  }

  update (dt) {
    if (!this.client || !this.client.player || !this.world) return
    const i = this.input
    if (i.pressed('lookCenter')) this.look.horiz = 100
    const run = !i.down('walk')
    const move = run ? 2048 : 1024
    let buttons = 0, keys = 0, newWeapon = 0
    if (i.down('jump')) buttons |= BUTTON.jump
    if (i.down('crouch')) buttons |= BUTTON.crouch
    if (i.down('fire') || this.mouse.fire) buttons |= BUTTON.fire
    if (i.down('altFire') || this.mouse.alt) buttons |= BUTTON.altFire
    if (i.down('open')) keys |= KEY.action
    if (i.down('prevItem')) keys |= KEY.prevItem
    if (i.down('nextItem')) keys |= KEY.nextItem
    if (i.down('useItem')) keys |= KEY.useItem
    for (let n = 1; n <= 10; n++) if (i.pressed('weapon' + n)) newWeapon = n
    // Blood's use keys: beast vision, the crystal ball, the jumping boots, the doctor's bag (the server acts on a press)
    let use = 0
    if (i.down('beastVision')) use |= 1
    if (i.down('crystalBall')) use |= 2
    if (i.down('jumpBoots')) use |= 4
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

  /**
   * The view angles, once a drawn frame by the time since the last (not by the game's fixed steps, which a frame
   * holds none, one or two of): the mouse and the turning keys. The steps send them on to the server, which turns
   * the player by them
   */
  turn () {
    const now = performance.now()
    const dt = Math.min(0.1, ((now - (this.turnedAt || now)) / 1000))
    this.turnedAt = now
    const i = this.input
    this.look.ang = (this.look.ang + this.mouse.dx * 2 + i.axis('left', 'right') * 1024 * dt + 2048 * 4) % 2048
    this.look.horiz = Math.max(0, Math.min(200, this.look.horiz - this.mouse.dy * 0.6 + i.axis('lookDown', 'lookUp') * 120 * dt))
    this.mouse.dx = this.mouse.dy = 0
  }

  /**
   * Playing, the frame is all WebGL: the world and the HUD drawn by the view straight to the page, the engine's 2D
   * canvas hidden and not drawn; otherwise (the start screen) the engine draws as usual
   */
  draw (context) {
    const playing = this.client && this.client.state && this.world && this.view && this.view.gl && !this.screenStack.some((s) => s.visible)
    if (playing) {
      this.turn()
      this.drawWorld()
      this.view.hud = this.hud.build()
      this.view.present(this.element)
      return
    }
    if (this.view) this.view.withdraw(this.element)
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
    // The bob, as the server works it out each tick (Blood's playerProcess), between the last two: the eye moves
    // across by its width and up and down by its height (Blood's view bobbing, both on by default), the weapon by
    // the sway (viewDrawScreen, BLOOD.EXE 0x1d3a2 and 0x1e282)
    const nb = you.bob || [0, 0, 0, 0], ob = was.bob || nb
    const bob = nb.map((v, i) => lerp(ob[i], v))
    const a = this.look.ang / 2048 * Math.PI * 2
    const across = bob[0] / 16
    this.view.eye = { x: lerp(was.x, you.x) - across * Math.sin(a), y: lerp(was.y, you.y) + across * Math.cos(a), z: lerp(was.z, you.z) + bob[1] + shake, ang: this.look.ang, horiz: you.dead ? 100 : this.look.horiz, sectnum: you.sectnum }
    this.sway = { x: bob[2] / 256, y: bob[3] / 256 }
    const sec = this.world.map.sectors[you.sectnum]
    this.weaponShade = sec ? sec.floorshade : 0
    // Under water the world is seen through WATER.PAL (Blood's palette 1)
    const xs = sec && sec.extra >= 0 ? this.world.map.xsectors[sec.extra] : null
    this.view.palette = xs && xs.underwater ? 1 : 0
    this.view.sprites = this.world.sprites(previous, state, t, you.sprite)
    // Hurt, the screen reddens; picking up, it flashes gold (Blood's palette fades)
    const hurt = Math.min(0.5, (you.hurt || 0) / 64), flash = Math.min(0.5, (you.flash || 0) / 40)
    this.view.tint = hurt >= flash ? [0.63, 0, 0, hurt] : [1, 0.86, 0.47, flash]
  }
}

Promise.all([json('data/tiles.json'), json('data/palettes.json'), json('data/sounds.json')]).then(([tiles, palettes, sounds]) => new BloodClient({ tiles, palettes, sounds }).start())
