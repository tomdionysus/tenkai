/**
 * A screen's buttons as a set shown at a time: each a box (`{ x, y, width, height }`) with what a press does
 * (`act`) and whatever else the game keeps on it (its words, its row), added to the screen's {@link Hotspots} and
 * drawn by the game's own painter. A window shows one set, then another in its place (a menu's rows, then a
 * question's Yes and No). Buttons act at the press, as the original games' windows do, or at the release over
 * the same button with `release`.
 *
 * @example
const buttons = new Buttons({ hotspots: menu.hotspots, paint: (frame, b) => art.button(frame, b, b.text) })
buttons.show([
  { text: 'Load', x: 56, y: 71, width: 208, height: 15, act: () => load() },
  { text: 'Quit', x: 56, y: 158, width: 104, height: 15, act: null }
])
// in the screen's paint:
buttons.draw(frame)
 */
class Buttons {
  /**
   * @param {object} options
   * @param {Hotspots} options.hotspots The screen's, in its own coordinates
   * @param {function} options.paint `(frame, button)`: draws one button (optional)
   * @param {boolean} options.release Act at the release over the pressed button, not at the press (default
   *   false)
   */
  constructor ({ hotspots, paint = null, release = false }) {
    this.hotspots = hotspots
    this.paint = paint
    this.release = release
    this.buttons = []
  }

  /**
   * The buttons shown now, in place of any before (the hotspots cleared): each `{ x, y, width, height, act }`
   * and the game's own fields; `act` null for a button that does nothing.
   * @param {object[]} buttons
   */
  show (buttons) {
    this.buttons = buttons
    this.hotspots.clear()
    for (const b of buttons) {
      const act = () => { if (b.act) b.act() }
      this.hotspots.add(this.release ? { box: b, onClick: act } : { box: b, onDown: act })
    }
  }

  /** Every button drawn by the painter, in order. */
  draw (frame) {
    if (!this.paint) return
    for (const b of this.buttons) this.paint(frame, b)
  }
}

export default Buttons
