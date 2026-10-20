/**
 * A name typed with the keys, as old games take a saved game's or a colony's name: letters, digits and the signs
 * allowed added up to a longest, Backspace taking one back, Enter ending it and Escape giving it up. Keys come as
 * the browser's `KeyboardEvent.code` (`KeyA`, `Digit1`, `Space`, `Enter`...), so the letters are the keyboard's
 * whatever the layout; the event's `key` may be given too for a sign the codes do not cover.
 *
 * @example
const entry = new NameEntry({ longest: 15 })
entry.begin(asteroid.name)
// on each keydown:
switch (entry.key(e.code, e.key)) {
  case 'done': rename(entry.text); break
  case 'cancelled': stop(); break
}
draw(entry.text + cursor)
 */
class NameEntry {
  /**
   * @param {object} options
   * @param {integer} options.longest Most characters (default 15)
   * @param {object} options.signs By key code, the character it types besides the letters, digits and space
   *   (default `NameEntry.SIGNS`); `{}` for letters, digits and space alone
   * @param {boolean} options.upper Whether letters are typed in capitals (default true, as old games had them)
   * @param {RegExp} options.allowed What the event's `key` may add when the code gives nothing (default none)
   */
  constructor ({ longest = 15, signs = NameEntry.SIGNS, upper = true, allowed = null } = {}) {
    this.longest = longest
    this.signs = signs
    this.upper = upper
    this.allowed = allowed
    this.text = ''
    this.active = false
  }

  /** The signs a US keyboard's codes type. */
  static get SIGNS () {
    return { Minus: '-', Equal: '=', Backslash: '\\', Comma: ',', Period: '.', Slash: '/', BracketLeft: '[', BracketRight: ']', Quote: '\'', Semicolon: ';' }
  }

  /** Typing begun with a text (default empty). */
  begin (text = '') {
    this.text = text
    this.active = true
  }

  /** Typing ended. */
  end () {
    this.active = false
  }

  /**
   * A key while typing: a character added, Backspace, Enter or Escape.
   * @param {string} code The event's `code`
   * @param {string} key The event's `key` (optional)
   * @returns {string|null} 'done' on Enter, 'cancelled' on Escape, 'typed' when the text changed, else null
   */
  key (code, key = null) {
    if (!this.active) return null
    switch (code) {
      case 'Enter':
      case 'NumpadEnter':
        this.active = false
        return 'done'
      case 'Escape':
        this.active = false
        return 'cancelled'
      case 'Backspace':
        if (!this.text.length) return null
        this.text = this.text.slice(0, -1)
        return 'typed'
    }
    var ch = this.character(code, key)
    if (ch === null || this.text.length >= this.longest) return null
    this.text += ch
    return 'typed'
  }

  /** The character a key types, or null. */
  character (code, key = null) {
    var m = /^Key([A-Z])$/.exec(code)
    if (m) return this.upper ? m[1] : (key && key.length === 1 ? key : m[1].toLowerCase())
    m = /^(?:Digit|Numpad)(\d)$/.exec(code)
    if (m) return m[1]
    if (code === 'Space') return ' '
    if (this.signs[code] !== undefined) return this.signs[code]
    if (this.allowed && key && key.length === 1 && this.allowed.test(key)) return key
    return null
  }
}

export default NameEntry
