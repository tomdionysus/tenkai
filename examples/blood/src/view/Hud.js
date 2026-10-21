// What Blood draws over the view (screen.cpp's viewDrawStatus at full size, and the weapon in hand): the health and
// ammo box with their numbers, the armour gauges, the keys, the pack, the messages; and the weapon's QAV animation,
// as the server says which plays and from when. All in Blood's 320x200 screen, scaled to the window as the original
// was to a 4:3 monitor, gathered each frame for the 3D view to draw in WebGL over the world (view/Overlay.js).
import { ScreenFit } from '../../../../index.js'
import Overlay from './Overlay.js'

// The pack's icons: the doctor's bag, the diving suit, the crystal ball, beast vision, the jumping boots (gPackIcons)
const PACK_ICONS = [2569, 2564, 2566, 2568, 2560]
const pad = (n) => String(Math.max(0, Math.min(999, n | 0))).padStart(3, ' ')

export default class Hud {
  constructor (game) {
    this.game = game
    this.messages = []
    this.overlay = new Overlay(game.indexes.tiles)
    this.qavs = null
    fetch('data/qavs.json').then((r) => r.json()).then((q) => { this.qavs = q })
  }

  say (text) {
    if (!text) return
    this.messages.push({ text, until: performance.now() + 4000 })
    if (this.messages.length > 4) this.messages.shift()
  }

  /** Blood's 320x200 screen inside the window, its pixels 1.2 times as tall as wide (a 4:3 monitor), at the bottom */
  frame () {
    const f = ScreenFit.fit({ width: 320, height: 200 }, { width: this.game.width, height: this.game.height }, { pixelAspect: 1.2, align: 'bottom' })
    return { scale: f.scale, sx: f.scaleX, sy: f.scaleY, x: f.x, y: f.y }
  }

  /** The frame's HUD, for the view: { vertices, count, rects } */
  build () {
    const c = this.game.client
    const you = c && c.state && c.state.you
    const f = this.frame()
    const O = this.overlay
    O.begin(f)
    if (you) {
      // The crosshair (viewDrawScreen, BLOOD.EXE 0x1e22c): tile 2319 at the view's middle, see-through, under the weapon
      if (this.game.crosshair && !you.dead) O.draw(2319, 160, 90, { alpha: 0.66 })
      if (!you.dead) this.weapon(you)
      this.status(you)
    }
    // The messages at the top left, across the whole window
    O.frame = { x: 0, y: 0, sx: f.sx, sy: f.sy }
    this.text()
    if (c && c.state) this.board(c.state, f)
    return O.hud
  }

  /** The tally at a level's end, and the frags in Bloodbath (or with the scores key held) */
  board (state, f) {
    const O = this.overlay, W = this.game.width, H = this.game.height
    const mid = W / 2 / f.sx
    if (state.ended) {
      const e = state.ended
      O.rect(0, 0, W, H, [0, 0, 0, 0.6])
      const top = H * 0.25 / f.sy
      O.text(state.title || '', mid, top, 1, { align: 'center' })
      O.text(e.secret ? 'Secret level found' : 'Level complete', mid, top + 22, 0, { align: 'center' })
      O.text('Kills ' + e.kills + ' of ' + e.total, mid, top + 36, 0, { align: 'center' })
      O.text('Secrets ' + e.secrets + ' of ' + e.totalSecrets, mid, top + 46, 0, { align: 'center' })
    } else if (state.mode === 2 || (this.game.input && this.game.input.down('scores'))) {
      const right = W / f.sx - 4
      const sorted = (state.players || []).slice().sort((a, b) => b.frags - a.frags)
      sorted.forEach((p, i) => O.text(p.name + '  ' + p.frags, right, 4 + i * 9, 0, { align: 'right' }))
    }
  }

  /** The QAV's frame at its time: up to 8 tiles about the QAV's origin, bobbing with the walk */
  weapon (you) {
    const w = you.qav
    if (!w || !this.qavs) return
    const q = this.qavs[w.qav]
    if (!q) return
    const c = this.game.client
    const at = w.at + c.fraction() * 4
    const frame = q.frames[Math.max(0, Math.min(q.frames.length - 1, Math.floor(at / q.ticksPerFrame)))]
    // Where Blood draws it (viewDrawScreen, BLOOD.EXE 0x1e282): the middle across and 220 down, moved by the sway
    // and by how far the weapon's height has fallen behind the eye's
    const sway = this.game.sway || { x: 0, y: 0 }
    const x0 = 160 + sway.x, y0 = 220 + sway.y + ((you.zWeapon || 0) - 0xc00) / 128
    for (const t of frame.tiles) {
      this.overlay.draw(t.picnum, x0 + t.x, y0 + t.y, {
        scale: t.z / 65536 || 1, flipY: !!(t.stat & 4), alpha: t.stat & 32 ? 0.33 : t.stat & 1 ? 0.66 : 1,
        shade: Math.max(0, Math.min(63, t.shade + (this.game.weaponShade || 0))), pal: t.pal || 0
      })
    }
  }

  /** Blood's full-size status: health and ammo at the bottom left, armour, keys and the pack at the bottom right */
  status (you) {
    const O = this.overlay
    O.draw(2201, 34, 187)
    if (you.health >= 16 || (performance.now() & 512) || you.health === 0) O.number(pad(you.health), 2190, 8, 183)
    const ammoType = [-1, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9][you.weapon]
    if (ammoType >= 0) O.number(pad(ammoType === 6 ? you.ammo[ammoType] / 10 : you.ammo[ammoType]), 2240, 42, 183)
    O.draw(2173, 284, 187)
    // Blood's TileHGauge: as much of the gauge's tile from its left as the armour is of 200
    const gauge = (tile, y, value) => {
      if (!value) return
      O.draw(tile, 250, y, { topLeft: true, width: Math.round(O.size(tile).w * Math.min(1, value / 200)) })
      O.number(pad(value), 2230, 255, y + 3, { scale: 0.5 })
    }
    gauge(2207, 175, you.armor[1])
    gauge(2209, 183, you.armor[0])
    gauge(2208, 191, you.armor[2])
    this.pack(you)
    for (let i = 0; i < 6; i++) {
      const x = i & 1 ? 320 - (78 + (i >> 1) * 10) : 73 + (i >> 1) * 10
      O.draw(2220 + i, x, 194, { shade: you.keys[i + 1] ? 0 : 40, alpha: you.keys[i + 1] ? 1 : 0.66 })
    }
  }

  /**
   * Blood's pack: the chosen item's icon and store in the status bar's right box (DrawPackItemInStatusBar), and
   * after a change of item the whole pack in a row above the bar, the chosen one framed, each's store over it,
   * brighter while in use (viewDrawPack)
   */
  pack (you) {
    const O = this.overlay
    const pack = you.pack || [], active = you.packActive || []
    if (you.packItem >= 0 && pack[you.packItem] > 0) {
      O.draw(PACK_ICONS[you.packItem], 286, 186)
      O.number(pad(pack[you.packItem]), 2250, 302, 183, { scale: 0.5 })
    }
    if (!(you.packTime > 0)) return
    const held = [0, 1, 2, 3, 4].filter((n) => pack[n] > 0)
    let x = 160 - Math.trunc(held.reduce((w, n) => w + O.size(PACK_ICONS[n]).w + 1, 0) / 2)
    const y = 200 - O.size(2201).h
    for (const n of held) {
      const w = O.size(PACK_ICONS[n]).w
      O.draw(PACK_ICONS[n], x + 1, y - 20, { topLeft: true })
      if (n === you.packItem) O.draw(2559, x, y - 21, { topLeft: true })
      O.number(pad(pack[n]), 2250, x + 4, y - 25, { shade: active[n] ? 4 : 24 })
      x += w + 1
    }
  }

  /** The messages, newest last, in Blood's small font */
  text () {
    const now = performance.now()
    this.messages = this.messages.filter((m) => m.until > now)
    this.messages.forEach((m, i) => this.overlay.text(m.text, 2, 2 + i * 8, 0))
  }
}
