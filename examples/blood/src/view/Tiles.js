// Tiles drawn in 2D (the status bar, the weapon in hand) from the true-colour atlas pages (data/tiles-N.png), as
// Build's rotatesprite places them: centred on their offsets, or from their top left; flipped, scaled, see-through.
export default class Tiles {
  /** @param {object} index data/tiles.json; @param {function} image (name) -> a loaded image */
  constructor (index, image) {
    this.index = index.tiles
    this.image = image
  }

  size (picnum) { const t = this.index[picnum]; return t ? { w: t.w, h: t.h } : { w: 0, h: 0 } }

  /**
   * Draw a tile in 320x200 coordinates (the caller has scaled the context): at (x, y) its centre (with its
   * offsets), or its top left with `topLeft`; `scale` (1 = 100%), `alpha`, `flipX`, `flipY`, `dark` (0-1, Build's
   * shade as darkness)
   */
  draw (ctx, picnum, x, y, o = {}) {
    const t = this.index[picnum]
    if (!t || t.page === undefined || !t.w) return
    const img = this.image('tiles-' + t.page)
    if (!img) return
    const scale = o.scale || 1
    const w = t.w * scale, h = t.h * scale
    let dx = x, dy = y
    if (!o.topLeft) { dx -= (t.w / 2 + t.xo) * scale; dy -= (t.h / 2 + t.yo) * scale }
    ctx.save()
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha
    ctx.translate(dx + (o.flipX ? w : 0), dy + (o.flipY ? h : 0))
    ctx.scale(o.flipX ? -1 : 1, o.flipY ? -1 : 1)
    // Darker by Build's shade: the tile's own pixels only (a filter, so nothing behind it darkens)
    if (o.dark) ctx.filter = 'brightness(' + Math.max(0, 1 - o.dark).toFixed(2) + ')'
    ctx.drawImage(img, t.x, t.y, t.w, t.h, 0, 0, w, h)
    ctx.restore()
  }

  /** Blood's DrawStatNumber: digits from tile `base` (0) up, from the top left */
  number (ctx, text, base, x, y, o = {}) {
    const width = this.size(base).w + 1
    for (const ch of String(text)) {
      if (ch !== ' ') this.draw(ctx, base + ch.charCodeAt(0) - 48, x, y, Object.assign({ topLeft: true }, o))
      x += width * (o.scale || 1)
    }
  }
}
