// Tiles drawn in 2D (the status bar, the weapon in hand), through Tenkai's PictureAtlas: one atlas a page of the
// true-colour tile pages (data/tiles-N.png), each tile a region by its number. Placed as Build's rotatesprite places
// them: centred on their offsets, or from their top left; flipped, scaled, see-through, darker in the shade.
import { PictureAtlas } from '../../../../index.js'

export default class Tiles {
  /** @param {object} index data/tiles.json; @param {function} asset (name) -> the engine's Asset of that image */
  constructor (index, asset) {
    this.index = index.tiles
    this.atlases = index.pages.map((_, k) => {
      const regions = {}
      for (const [n, t] of Object.entries(index.tiles)) if (t.page === k && t.w) regions[n] = [t.x, t.y, t.w, t.h]
      return new PictureAtlas({ image: asset('tiles-' + k), regions })
    })
  }

  size (picnum) { const t = this.index[picnum]; return t ? { w: t.w, h: t.h } : { w: 0, h: 0 } }

  /**
   * Draw a tile in 320x200 coordinates (the caller has scaled the context): at (x, y) its centre (with its offsets),
   * or its top left with `topLeft`; `scale` (1 = 100%), `alpha`, `flipX`, `flipY`, `dark` (0-1, Build's shade as
   * darkness), `width` (only that much of it from its left: a gauge)
   */
  draw (ctx, picnum, x, y, o = {}) {
    const t = this.index[picnum]
    if (!t || t.page === undefined || !t.w) return
    const scale = o.scale || 1
    let dx = x, dy = y
    if (!o.topLeft) { dx -= (t.w / 2 + t.xo) * scale; dy -= (t.h / 2 + t.yo) * scale }
    this.atlases[t.page].draw(ctx, String(picnum), dx, dy, {
      scale, flipX: o.flipX, flipY: o.flipY, alpha: o.alpha, width: o.width,
      filter: o.dark ? 'brightness(' + Math.max(0, 1 - o.dark).toFixed(2) + ')' : undefined
    })
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
