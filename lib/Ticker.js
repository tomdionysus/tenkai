import FrameClock from './FrameClock.js'

/**
 * A Ticker is a status strip run as a ticker tape: messages enter at the right edge of a window a pixel column a
 * frame and cross it to the left, each followed by a gap, with a blank column when nothing waits. Up to `limit`
 * messages wait their turn, and one the same as the last accepted is dropped (a repeated warning is not shown
 * twice). `hold` shows one text alone (scrolled in once and kept: "GAME PAUSED") until `resume` restores the tape.
 * The text is drawn by a {@link BitmapFont}, clipped to the window, so the look is the game's.
 *
 * It is a sibling of {@link MessageLine}, which shows one message at a time by importance.
 *
 * @example
const ticker = new Ticker({ font, window: { x: 32, y: 145, width: 128, height: 7 }, colour: '#cc0000', onStart: (text) => log.add(text) })
ticker.post('WARNING PLASMODIAN WAVE')
update (dt) { ticker.update(dt) }
draw (context) { ticker.draw(context) }
 */
class Ticker {
  /**
   * @param {object} options
   * @param {BitmapFont} options.font Draws the text (`draw(context, text, x, y, { colour, clip })`)
   * @param {object} options.window `{ x, y, width, height }`: the strip, in the context's coordinates
   * @param {string} options.colour The text's colour (optional: the font's own)
   * @param {number} options.step Pixel columns a character (optional, default the font's `cellWidth`)
   * @param {number} options.rate Columns a second (optional, default 50)
   * @param {number} options.limit How many messages wait at most (optional, default 16)
   * @param {string} options.gap What follows each message (optional, default three spaces)
   * @param {function} options.onStart `onStart(text)` as a message starts across (optional)
   */
  constructor (options = {}) {
    this.font = options.font
    this.window = options.window
    this.colour = options.colour
    this.step = options.step || (this.font && this.font.cellWidth) || 8
    this.limit = options.limit === undefined ? 16 : options.limit
    this.gap = options.gap === undefined ? '   ' : options.gap
    this.onStart = options.onStart || (() => {})
    this.clock = new FrameClock(options.rate === undefined ? 50 : options.rate)
    /** The messages waiting their turn */
    this.queue = []
    this.last = null
    // The tape: the characters that have entered the window or are entering it, how many of the tape's characters
    // have gone before them, and how many pixel columns have entered in all
    this.tape = ''
    this.start = 0
    this.columns = 0
    this.held = null
  }

  /**
   * Post a message: it waits its turn, unless the queue is full or it is the same as the last accepted.
   * @param {string} text
   * @returns {boolean} Whether it was accepted
   */
  post (text) {
    if (text === this.last || this.queue.length >= this.limit) return false
    this.last = text
    this.queue.push(text)
    return true
  }

  /** Show only this text until `resume`: it scrolls in once and stays; the tape is kept to restore. */
  hold (text) {
    if (!this.held) this.held = { tape: this.tape, start: this.start, columns: this.columns }
    this.tape = text
    this.start = 0
    this.columns = 0
  }

  /** Whether a held text shows. */
  get holding () {
    return this.held !== null
  }

  /** The tape back as it was before `hold`. */
  resume () {
    if (!this.held) return
    Object.assign(this, this.held)
    this.held = null
  }

  /**
   * The columns that `dt` more seconds bring in.
   * @param {number} dt Seconds
   */
  update (dt) {
    for (let n = this.clock.frames(dt); n > 0; n--) this.column()
  }

  // One more pixel column into the window
  column () {
    const step = this.step
    if (this.held) {
      if (this.columns < Math.min(this.window.width, this.tape.length * step + step)) this.columns++
      return
    }
    // At the end of the tape, the next message and its gap, or a blank column
    if (this.columns >= (this.start + this.tape.length) * step) {
      if (!this.queue.length) this.last = null
      const next = this.queue.shift()
      if (next !== undefined) this.onStart(next)
      this.tape += next !== undefined ? next + this.gap : ' '
    }
    this.columns++
    // Keep only what can still be seen
    const first = Math.floor((this.columns - this.window.width) / step) - 1
    if (first > this.start) {
      this.tape = this.tape.slice(first - this.start)
      this.start = first
    }
  }

  /** Where the tape's first kept character is drawn, in the context's coordinates. */
  get x () {
    return this.window.x + this.window.width - this.columns + this.start * this.step
  }

  /** The tape through the font, clipped to the window. */
  draw (context) {
    this.font.draw(context, this.tape, this.x, this.window.y, { colour: this.colour, clip: this.window })
  }
}

export default Ticker
