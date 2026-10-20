/**
 * Text let out a letter at a time, as old games type their screens' words: a count of letters out so far, one more
 * every so many steps, with a call for each as it comes (a click of the keys, a sound for a letter that is not a
 * vowel), and all the rest at once on a press. The screen draws the part let out with `shown`; several texts typed
 * one after another share the count, each told how many letters came before it.
 *
 * @example
const typing = new Typewriter({ letter: (ch) => { if (!'AEIOU'.includes(ch)) sounds.play(3) } })
// each frame, drawing the lines in turn:
let before = 0
before += draw(typing.shown(welcome, before), 16, 16)
before += draw(typing.shown(advert, before), 16, 32)
if (typing.tick(welcome + advert)) next()
// a press: the rest at once
typing.all(welcome + advert)
 */
class Typewriter {
  /**
   * @param {object} options
   * @param {integer} options.every Steps between letters (default 1: a letter a step)
   * @param {function} options.letter `(ch, index)` called as each letter comes out (optional); `ch` is '' when `tick`
   *   is given a count instead of the text
   */
  constructor ({ every = 1, letter = null } = {}) {
    this.every = every
    this.letter = letter
    /** Letters out so far. */
    this.typed = 0
    this.steps = 0
  }

  /** Back to the start: nothing out. */
  reset () {
    this.typed = 0
    this.steps = 0
  }

  /**
   * One step: the next letter out when it is due. `text` is the whole text being typed (a string, or its length).
   * @returns {boolean} whether all of it is out
   */
  tick (text) {
    var total = typeof text === 'string' ? text.length : text
    if (this.typed >= total) return true
    this.steps++
    if (this.steps >= this.every) {
      this.steps = 0
      var index = this.typed++
      if (this.letter) this.letter(typeof text === 'string' ? text[index] : '', index)
    }
    return this.typed >= total
  }

  /** The rest at once (a press that will not wait). */
  all (text) {
    this.typed = typeof text === 'string' ? text.length : text
    this.steps = 0
  }

  /** Whether all of a text is out. */
  done (text) {
    return this.typed >= (typeof text === 'string' ? text.length : text)
  }

  /** The part of a text let out, `before` being the letters typed before it (the texts typed earlier). */
  shown (text, before = 0) {
    return text.slice(0, Math.max(0, Math.min(text.length, this.typed - before)))
  }
}

export default Typewriter
