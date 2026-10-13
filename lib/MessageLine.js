/**
 * MessageLine is a one-line status strip as old games run theirs (Westwood's, for one): each message has an
 * importance; a new one at least as important as the next waiting takes its place, the line showing is held for
 * `hold` steps unless something more important waits, and a change scrolls: the old line slides down out of the
 * strip as the new one comes down into it over `scroll` steps. A message already showing or waiting is not added
 * again (letter case aside).
 *
 * It keeps the lines; the game draws them where `rows()` says, clipped to its strip.
 *
 * @example
const line = new MessageLine({ hold: 900, scroll: 10, gap: 11 })
line.say('Harvester deployed.', 1)
// each step:
line.step()
for (const { text, y } of line.rows()) font.draw(strip, text, 9, top + y)
 */
class MessageLine {
  /**
   * @param {object} options
   * @property {integer} hold Steps a line shows before a message of no more importance replaces it (default 900)
   * @property {integer} scroll Steps a change takes to scroll (default 10)
   * @property {integer} gap Pixels from the new line to the old as they scroll (default `scroll + 1`)
   */
  constructor (options = {}) {
    this.hold = options.hold === undefined ? 900 : options.hold
    this.scroll = options.scroll === undefined ? 10 : options.scroll
    this.gap = options.gap === undefined ? this.scroll + 1 : options.gap
    // The line showing, the next, and the one waiting after it, with their importances
    this.lines = ['', '', '']
    this.importance = [-1, -1, -1]
    this.timer = 0
    this.offset = 0
    this.scrolling = false
    this.now = 0
  }

  /** The line showing (while scrolling, the one going). */
  get text () {
    return this.lines[0]
  }

  /** A message, with its importance (higher shows sooner). */
  say (text, importance = 0) {
    this._update(text, importance)
  }

  /** One step. */
  step () {
    this.now++
    this._update('', 0)
  }

  /**
   * What to draw: each line and its y from where the line rests (the new line above it while scrolling, the old
   * below), to be clipped to the strip.
   * @returns {Array} `{ text, y }` each
   */
  rows () {
    var out = []
    if (this.scrolling) {
      if (this.lines[1]) out.push({ text: this.lines[1], y: -this.offset })
      if (this.lines[0]) out.push({ text: this.lines[0], y: this.gap - this.offset })
    } else if (this.lines[0]) out.push({ text: this.lines[0], y: 0 })
    return out
  }

  _update (text, importance) {
    var same = (a, b) => a.toLowerCase() === b.toLowerCase()
    if (this.scrolling) {
      if (text && !same(text, this.lines[1]) && importance >= this.importance[2]) {
        this.lines[2] = text
        this.importance[2] = importance
      }
      if (this.timer > this.now) return
      if (this.offset !== 0) {
        if (this.importance[2] <= this.importance[1]) this.timer = this.now + 1
        this.offset--
        return
      }
      this.lines[0] = this.lines[1]
      this.importance[0] = this.importance[1] !== 0 ? this.importance[1] - 1 : 0
      this.lines[1] = this.lines[2]
      this.importance[1] = this.importance[2]
      this.lines[2] = ''
      this.importance[2] = -1
      this.timer = this.now + (this.importance[1] <= this.importance[0] ? this.hold : 1)
      this.scrolling = false
      return
    }
    if (text) {
      if (!same(text, this.lines[0]) && !same(text, this.lines[1]) && !same(text, this.lines[2])) {
        if (importance >= this.importance[1]) {
          this.lines[2] = this.lines[1]
          this.importance[2] = this.importance[1]
          this.lines[1] = text
          this.importance[1] = importance
        } else if (importance >= this.importance[2]) {
          this.lines[2] = text
          this.importance[2] = importance
        }
      }
    } else if (!this.lines[0] && !this.lines[1]) return
    if (this.importance[1] <= this.importance[0] && this.timer >= this.now) return
    this.scrolling = true
    this.offset = this.scroll
    this.timer = 0
  }
}

export default MessageLine
