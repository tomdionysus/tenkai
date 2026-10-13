/**
 * RollingCounter is a number shown as old games show money and scores: it runs toward its target a step at a time,
 * by a share of the difference (`divisor`: a quarter by default, at least 1, at most `most`), gathered in `fraction`
 * parts before the number moves, and a digit that changes rolls: the old one moves out of its box as the new one
 * comes in. `offset` is how far the roll has gone (in parts, negative when counting down); `digits` says which
 * digits roll from what to what.
 *
 * @example
const credits = new RollingCounter({ divisor: 4, most: 128, fraction: 8 })
// each step:
credits.step(house.credits)
credits.digits(6).forEach((d, i) => {
  if (!d.rolling) return draw(d.from, x + i * 10, top)
  draw(d.from, x + i * 10, top - credits.offset)             // going up and out
  draw(d.to, x + i * 10, top + 8 - credits.offset)           // coming up from below
})
 */
class RollingCounter {
  /**
   * @param {object} options
   * @property {number} divisor The share of the difference taken a step (default 4)
   * @property {number} most The most a step takes, in parts (default 128)
   * @property {integer} fraction Parts to a unit (default 8)
   */
  constructor (options = {}) {
    this.divisor = options.divisor || 4
    this.most = options.most || 128
    this.fraction = options.fraction || 8
    /** The number shown, or null before the first step */
    this.shown = null
    this.offset = 0
  }

  /** One step toward the target (the first shows it at once). */
  step (target) {
    if (this.shown === null) {
      this.shown = target
      return
    }
    var diff = target - this.shown
    if (diff !== 0) {
      var step = Math.trunc(diff / this.divisor)
      if (step === 0) step = diff < 0 ? -1 : 1
      this.offset += Math.max(-this.most, Math.min(this.most, step))
    } else this.offset = 0
    if (this.offset < 0 && this.shown === 0) this.offset = 0
    this.shown += Math.trunc(this.offset / this.fraction)
    var f = this.fraction
    if (this.offset > 0) this.offset %= f
    if (this.offset < 0) this.offset = -((-this.offset) % f)
  }

  /**
   * The number's last `count` digits (spaces before it), each `{ from, to, rolling }`: from the number shown to the
   * next as it rolls up, or from the one below to it as it rolls down.
   */
  digits (count) {
    var older = this.shown || 0
    var newer = older
    if (this.offset < 0 && older > 0) older--
    if (this.offset > 0) newer++
    var top = Math.pow(10, count) - 1
    var a = String(Math.max(0, Math.min(top, older))).padStart(count, ' ')
    var b = String(Math.max(0, Math.min(top, newer))).padStart(count, ' ')
    var out = []
    for (var i = 0; i < count; i++) out.push({ from: a[i], to: b[i], rolling: a[i] !== b[i] })
    return out
  }
}

export default RollingCounter
