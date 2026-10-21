// What Blood draws over the view (screen.cpp's viewDrawStatus at full size, and the weapon in hand): the health and
// ammo box with their numbers, the armour gauges, the keys, the messages; and the weapon's QAV animation, as the
// server says which plays and from when. All in Blood's 320x200 screen, scaled to the window as the original was to
// a 4:3 monitor.
import Tiles from './Tiles.js'

const pad = (n) => String(Math.max(0, Math.min(999, n | 0))).padStart(3, ' ')

export default class Hud {
  constructor (game) {
    this.game = game
    this.messages = []
    this.tiles = new Tiles(game.indexes.tiles, (name) => game.getAsset(name))
    this.qavs = null
    fetch('data/qavs.json').then((r) => r.json()).then((q) => { this.qavs = q })
  }

  say (text) {
    if (!text) return
    this.messages.push({ text, until: performance.now() + 4000 })
    if (this.messages.length > 4) this.messages.shift()
  }

  /** The 320x200 screen inside the canvas: as wide as 4:3 allows, centred */
  frame () {
    const W = this.game.width, H = this.game.height
    const scale = Math.min(W / 320, H / 240)
    return { scale, sx: scale, sy: scale * 1.2, x: (W - 320 * scale) / 2, y: H - 200 * scale * 1.2 }
  }

  draw (ctx) {
    const c = this.game.client
    const you = c && c.state && c.state.you
    const f = this.frame()
    ctx.save()
    ctx.imageSmoothingEnabled = false
    if (you) {
      this.tint(ctx, you)
      ctx.save()
      // The weapon fills the bottom of the whole screen width, as Blood scaled it to the view
      ctx.translate(f.x, f.y)
      ctx.scale(f.sx, f.sy)
      if (!you.dead) this.weapon(ctx, you)
      this.status(ctx, you)
      ctx.restore()
    }
    this.text(ctx, f)
    if (c && c.state) this.board(ctx, c.state, f)
    ctx.restore()
  }

  /** The tally at a level's end, and the frags in Bloodbath */
  board (ctx, state, f) {
    const size = Math.max(12, Math.round(9 * f.sx))
    ctx.font = 'bold ' + size + 'px monospace'
    ctx.textAlign = 'center'
    const line = (text, y, color = '#e8d8c8') => { ctx.fillStyle = 'black'; ctx.fillText(text, this.game.width / 2 + 2, y + 2); ctx.fillStyle = color; ctx.fillText(text, this.game.width / 2, y) }
    if (state.ended) {
      const e = state.ended
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(0, 0, this.game.width, this.game.height)
      line(state.title, this.game.height * 0.3, '#ff4030')
      line(e.secret ? 'Secret level found' : 'Level complete', this.game.height * 0.3 + size * 2)
      line('Kills ' + e.kills + ' of ' + e.total, this.game.height * 0.3 + size * 4)
      line('Secrets ' + e.secrets + ' of ' + e.totalSecrets, this.game.height * 0.3 + size * 5.5)
    } else if (state.mode === 2 || (this.game.input && this.game.input.down('scores'))) {
      ctx.textAlign = 'right'
      ctx.font = 'bold ' + Math.round(size * 0.8) + 'px monospace'
      const sorted = (state.players || []).slice().sort((a, b) => b.frags - a.frags)
      sorted.forEach((p, i) => { ctx.fillStyle = 'black'; ctx.fillText(p.name + '  ' + p.frags, this.game.width - 7, 7 + i * size + 1); ctx.fillStyle = '#e8d8c8'; ctx.fillText(p.name + '  ' + p.frags, this.game.width - 8, 6 + i * size) })
    }
    ctx.textAlign = 'left'
  }

  /** Red when hurt, gold when picking up (Blood's palette flashes) */
  tint (ctx, you) {
    const a = Math.min(0.5, (you.hurt || 0) / 64)
    if (a > 0) { ctx.fillStyle = `rgba(160, 0, 0, ${a})`; ctx.fillRect(0, 0, this.game.width, this.game.height) }
    if (you.flash > 0) { ctx.fillStyle = `rgba(255, 220, 120, ${you.flash / 40})`; ctx.fillRect(0, 0, this.game.width, this.game.height) }
  }

  /** The QAV's frame at its time: up to 8 tiles about the QAV's origin, bobbing with the walk */
  weapon (ctx, you) {
    const w = you.qav
    if (!w || !this.qavs) return
    const q = this.qavs[w.qav]
    if (!q) return
    const c = this.game.client
    const at = w.at + c.fraction() * 4
    const frame = q.frames[Math.max(0, Math.min(q.frames.length - 1, Math.floor(at / q.ticksPerFrame)))]
    const bob = this.game.bob || { x: 0, y: 0 }
    for (const t of frame.tiles) {
      this.tiles.draw(ctx, t.picnum, q.x + t.x + bob.x, q.y + t.y + bob.y, {
        scale: t.z / 65536 || 1, flipY: !!(t.stat & 4), alpha: t.stat & 32 ? 0.33 : t.stat & 1 ? 0.66 : 1, dark: Math.max(0, (t.shade + (this.game.weaponShade || 0)) / 64)
      })
    }
  }

  /** Blood's full-size status: health and ammo at the bottom left, armour and keys at the bottom right */
  status (ctx, you) {
    const T = this.tiles
    T.draw(ctx, 2201, 34, 187)
    if (you.health >= 16 || (performance.now() & 512) || you.health === 0) T.number(ctx, pad(you.health), 2190, 8, 183)
    const ammoType = [-1, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9][you.weapon]
    if (ammoType >= 0) T.number(ctx, pad(ammoType === 6 ? you.ammo[ammoType] / 10 : you.ammo[ammoType]), 2240, 42, 183)
    T.draw(ctx, 2173, 284, 187)
    // Blood's TileHGauge: as much of the gauge's tile from its left as the armour is of 200
    const gauge = (tile, y, value) => {
      if (!value) return
      T.draw(ctx, tile, 250, y, { topLeft: true, width: Math.round(T.size(tile).w * Math.min(1, value / 200)) })
      T.number(ctx, pad(value), 2230, 255, y + 3, { scale: 0.5 })
    }
    gauge(2207, 175, you.armor[1])
    gauge(2209, 183, you.armor[0])
    gauge(2208, 191, you.armor[2])
    for (let i = 0; i < 6; i++) {
      const x = i & 1 ? 320 - (78 + (i >> 1) * 10) : 73 + (i >> 1) * 10
      T.draw(ctx, 2220 + i, x, 194, { dark: you.keys[i + 1] ? 0 : 0.7, alpha: you.keys[i + 1] ? 1 : 0.5 })
    }
  }

  text (ctx, f) {
    const now = performance.now()
    this.messages = this.messages.filter((m) => m.until > now)
    const size = Math.max(10, Math.round(7 * f.sx))
    ctx.font = 'bold ' + size + 'px monospace'
    ctx.textBaseline = 'top'
    this.messages.forEach((m, i) => {
      const y = 4 + i * size * 1.2
      ctx.fillStyle = 'black'; ctx.fillText(m.text, 5, y + 1)
      ctx.fillStyle = '#d8c09a'; ctx.fillText(m.text, 4, y)
    })
  }
}
