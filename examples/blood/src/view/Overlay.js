// The HUD's drawing, gathered for the 3D view to draw in WebGL over the world (BuildView's drawHud): tiles placed
// as Build's rotatesprite places them, in Blood's 320x200 screen mapped onto the window, text in Blood's fonts
// (tiles from 4096: data/tiles.json's fonts), and plain rectangles. Each tile is drawn through the palette and its
// shade, as the original drew its status bar and the weapon in hand.
import { FLOATS, MASKED, TRANSLUCENT, TRANSLUCENT_MORE } from './geometry.js'

export default class Overlay {
  /** @param {object} index data/tiles.json */
  constructor (index) {
    this.tiles = index.tiles
    this.fonts = index.fonts || []
    this.vertices = new Float32Array(FLOATS * 6 * 512)
    this.count = 0
    this.rects = []
    this.frame = { x: 0, y: 0, sx: 1, sy: 1 }
  }

  /** A new frame's HUD, drawn in a 320x200 screen placed at (x, y) with these scales */
  begin (frame) {
    this.count = 0
    this.rects = []
    this.frame = frame
  }

  /** What the view draws: { vertices, count, rects } */
  get hud () { return { vertices: this.vertices, count: this.count, rects: this.rects } }

  size (picnum) { const t = this.tiles[picnum]; return t ? { w: t.w, h: t.h } : { w: 0, h: 0 } }

  /**
   * A tile at (x, y) in the 320x200 screen: its centre with its offsets (rotatesprite's way), or its top left with
   * `topLeft`; `scale`, `flipX`, `flipY`, `alpha` (0.33 or 0.66: Blood's two translucencies), `shade` (Build's,
   * darker up to 63), `pal`, `width` (only so much of it from its left: a gauge)
   */
  draw (picnum, x, y, o = {}) {
    const t = this.tiles[picnum]
    if (!t || t.page === undefined || !t.w) return
    const scale = o.scale || 1
    const w = Math.min(t.w, o.width === undefined ? t.w : o.width)
    if (w <= 0) return
    let dx = x, dy = y
    if (!o.topLeft) { dx -= (t.w / 2 + t.xo) * scale; dy -= (t.h / 2 + t.yo) * scale }
    const f = this.frame
    const X0 = f.x + dx * f.sx, Y0 = f.y + dy * f.sy, X1 = X0 + w * scale * f.sx, Y1 = Y0 + t.h * scale * f.sy
    const e = 0.001
    let u0 = 0, u1 = w - e, v0 = 0, v1 = t.h - e
    if (o.flipX) { u0 = t.w - e; u1 = t.w - w }
    if (o.flipY) { const k = v0; v0 = v1; v1 = k }
    let flags = MASKED
    if (o.alpha !== undefined && o.alpha < 1) flags |= o.alpha < 0.5 ? TRANSLUCENT_MORE : TRANSLUCENT
    this.quad(X0, Y0, X1, Y1, u0, v0, u1, v1, picnum, o.shade || 0, o.pal || 0, flags)
  }

  quad (X0, Y0, X1, Y1, u0, v0, u1, v1, pic, shade, pal, flags) {
    if ((this.count + 6) * FLOATS > this.vertices.length) {
      const more = new Float32Array(this.vertices.length * 2)
      more.set(this.vertices)
      this.vertices = more
    }
    const c = [[X0, Y0, u0, v0], [X1, Y0, u1, v0], [X1, Y1, u1, v1], [X0, Y1, u0, v1]]
    let at = this.count * FLOATS
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const p = c[k]
      this.vertices.set([p[0], p[1], 0, p[2], p[3], pic, shade, pal, flags, 0], at)
      at += FLOATS
    }
    this.count += 6
  }

  /** Blood's DrawStatNumber: digits from tile `base` (0) up, each placed by its centre */
  number (text, base, x, y, o = {}) {
    const width = this.size(base).w + 1
    for (const ch of String(text)) {
      if (ch !== ' ') this.draw(base + ch.charCodeAt(0) - 48, x, y, o)
      x += width * (o.scale || 1)
    }
  }

  /** The width of a text in a font, in the 320x200 screen's pixels */
  textWidth (text, font = 0) {
    const f = this.fonts[font]
    if (!f) return 0
    let w = 0
    for (const ch of String(text)) { const g = f.glyphs[ch.charCodeAt(0)]; if (g) w += g[0] + f.spacing }
    return w
  }

  /** Text in one of Blood's fonts, its top left at (x, y) (`align`: 'center' or 'right' about x), in `pal` and `shade` */
  text (text, x, y, font = 0, o = {}) {
    const f = this.fonts[font]
    if (!f) return
    const scale = o.scale || 1
    if (o.align === 'center') x -= this.textWidth(text, font) * scale / 2
    else if (o.align === 'right') x -= this.textWidth(text, font) * scale
    for (const ch of String(text)) {
      const code = ch.charCodeAt(0), g = f.glyphs[code]
      if (!g) continue
      // (a glyph's top is given against the line's baseline: the line's height down from its top)
      if (code > 32) this.draw(f.tile + code - 32, x, y + (f.height + g[1]) * scale, { topLeft: true, scale, shade: o.shade, pal: o.pal })
      x += (g[0] + f.spacing) * scale
    }
  }

  /** A plain rectangle in the window's pixels, under the tiles or `over` them */
  rect (x, y, w, h, color, over = false) { this.rects.push({ x, y, w, h, color, over }) }
}
