/**
 * MessageQueue holds the messages of a modal message box: one shows at a time, others wait behind it in turn, and
 * each stays at least `hold` steps before a click can dismiss it (so a click meant for the game does not dismiss
 * a message that has just appeared). What a message is, and how the box draws it, is the game's: show it in a
 * {@link Screen} that is `modal` while `current` is set.
 *
 * @example
const hints = new MessageQueue({ hold: 30 })
if (hints.show({ text: 'Build a refinery.', picture: 63 })) game.showScreen(hintBox)
// each step:
hints.step()
// a click on the box:
if (hints.dismiss() && !hints.current) game.hideScreen(hintBox)
 */
class MessageQueue {
  /**
   * @param {object} options
   * @property {integer} hold Steps a message shows before it can be dismissed (default 0)
   */
  constructor (options = {}) {
    this.hold = options.hold || 0
    /** The message showing, or null */
    this.current = null
    this.waiting = []
    this.holding = 0
    this._closed = null
  }

  /** Whether a message shows. */
  get open () {
    return this.current !== null
  }

  /** Whether the message showing can be dismissed yet. */
  get ready () {
    return this.open && this.holding <= 0
  }

  /**
   * A message to show: at once if none shows, else after those before it.
   * @param {*} message
   * @param {function} closed Called when it is dismissed (optional)
   * @returns {boolean} Whether it shows now (the box was closed)
   */
  show (message, closed = null) {
    if (this.open) {
      this.waiting.push([message, closed])
      return false
    }
    this._present(message, closed)
    return true
  }

  /** One step: the message showing is held a step less. */
  step () {
    if (this.holding > 0) this.holding--
  }

  /**
   * A click on the box: the message showing goes if it has been held long enough, and the next shows.
   * @returns {boolean} Whether a message went
   */
  dismiss () {
    if (!this.ready) return false
    var closed = this._closed
    this.current = null
    this._closed = null
    if (closed) closed()
    if (this.waiting.length) this._present(...this.waiting.shift())
    return true
  }

  /** Forget every message, without calling their `closed`. */
  clear () {
    this.current = null
    this._closed = null
    this.waiting = []
  }

  _present (message, closed) {
    this.current = message
    this._closed = closed
    this.holding = this.hold
  }
}

export default MessageQueue
