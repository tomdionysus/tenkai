import IndexedSheet from './IndexedSheet.js'

/**
 * A game's pictures in palette numbers, by name: each a rectangle of one of several sheets (an
 * {@link IndexedSurface} each), cut once, with the point the game places it by (its anchor: a sprite's foot, a
 * strip's bottom left). Where an {@link IndexedSheet} numbers its pictures, these are named, as a remake's exported
 * pictures are; drawn with {@link IndexedSurface#blit}'s options (a colour table `map`, `flip`).
 *
 * @example
const pictures = new IndexedPictures({
  pictures: { 'button.10': { sheet: 'buttons', x: 0, y: 0, w: 32, h: 15 }, 'ship.fighter': { sheet: 'ships', x: 0, y: 0, w: 16, h: 12, anchor: [8, 11] } },
  sheets: { buttons: buttonSheet, ships: shipSheet }
})
pictures.draw(frame, 'button.10', 264, 5, { map: pressedColours })   // top left at (264, 5)
pictures.place(frame, 'ship.fighter', 120, 90)                       // its anchor at (120, 90)
 */
class IndexedPictures {
  /**
   * @param {object} options
   * @param {object} options.pictures By name: `{ sheet, x, y, w, h, anchor }` (anchor `[x, y]`, default `[0, 0]`)
   * @param {object} options.sheets By name: the surfaces the pictures are cut from
   */
  constructor ({ pictures, sheets }) {
    this.pictures = {}
    for (var name of Object.keys(pictures)) {
      var p = pictures[name]
      this.pictures[name] = { surface: IndexedSheet.cut(sheets[p.sheet], p.x, p.y, p.w, p.h), anchor: p.anchor || [0, 0], w: p.w, h: p.h }
    }
  }

  /** Whether there is a picture of that name. */
  has (name) {
    return name in this.pictures
  }

  /** A picture by name, `{ surface, anchor, w, h }`, or undefined. */
  get (name) {
    return this.pictures[name]
  }

  /** A picture with its top left at (x, y); nothing for an unknown name. */
  draw (surface, name, x, y, options = {}) {
    var p = this.pictures[name]
    if (p) surface.blit(p.surface, Object.assign({ dx: x, dy: y }, options))
  }

  /** A picture with its anchor at (x, y); nothing for an unknown name. */
  place (surface, name, x, y, options = {}) {
    var p = this.pictures[name]
    if (p) surface.blit(p.surface, Object.assign({ dx: x - p.anchor[0], dy: y - p.anchor[1] }, options))
  }
}

export default IndexedPictures
