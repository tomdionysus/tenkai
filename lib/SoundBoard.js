import SoundManager from './SoundManager.js'
import SoundVoices from './SoundVoices.js'

/**
 * SoundBoard plays a game's sounds by number, as old games call them: each number a sound file at a rate, some
 * numbers a phrase of others played one after another ("unit" "deployed"). Effects take turns on a few
 * {@link SoundVoices} (as a driver alternates its channels), a new one replacing what that voice played; speech goes
 * on the {@link SoundManager}'s voice channel, a new line stopping the last. It stays silent until the player's
 * first click or key (`unlock`, the browser's rule), then loads every sound.
 *
 * @example
const sounds = new SoundBoard({
  engine: game,
  base: 'sounds/',
  sounds: { 3: { file: 'click.wav' }, 20: { file: 'unit.wav', speech: true }, 21: { file: 'deployed.wav', speech: true } },
  phrases: { 14: [20, 21] },
  voices: 2
})
game.on('mousedown', () => sounds.unlock())
sounds.play(14)
sounds.keep(5)   // each frame while the alarm should sound: started again whenever it ends
sounds.stop(5)
sounds.toggle('speech')   // the setup screen's SPEECH OFF: the speech group silent until toggled again
 */
class SoundBoard {
  /**
   * @param {object} options
   * @property {GameEngine} engine Its audio context, unlocked on the first gesture
   * @property {string} base Where the files are (default '')
   * @property {object} sounds By number: `{ file, rate, speech, group }` (rate default 1; the group it is switched
   *   on and off with, default 'speech' for speech and 'effects' for the rest)
   * @property {object} phrases By number: the numbers played in turn (optional)
   * @property {integer} voices Voices the effects take turns on (default 2)
   * @property {string} channel The effects' SoundManager channel (default 'effects')
   * @property {function} manager `(context) => SoundManager`, to make it some other way (optional)
   */
  constructor (options) {
    this.engine = options.engine
    this.base = options.base || ''
    this.sounds = options.sounds
    this.phrases = options.phrases || {}
    this.count = options.voices || 2
    this.channel = options.channel || 'effects'
    this.makeManager = options.manager || ((context) => new SoundManager({ base: this.base, context }))
    this.manager = null
    this.voices = null
    this.turn = 0
    /** The number each voice last played. */
    this.numbers = new Array(this.count).fill(null)
    /** Each group switched off, by name (a group not here is on). */
    this.off = {}
  }

  /** A sound's group: its own, else 'speech' or 'effects'. */
  groupOf (s) {
    return s.group || (s.speech ? 'speech' : 'effects')
  }

  /** Whether a group of sounds is on. */
  enabled (group) {
    return !this.off[group]
  }

  /** A group switched on or off: its sounds not played while off. */
  enable (group, on) {
    if (on) delete this.off[group]
    else this.off[group] = true
  }

  /** A group switched the other way; answers whether it is on now. */
  toggle (group) {
    this.enable(group, !this.enabled(group))
    return this.enabled(group)
  }

  /** Whether it can play (after the first gesture). */
  get ready () {
    return !!this.manager
  }

  /** The first click or key: the audio context unlocked and every sound loaded. */
  unlock () {
    if (this.manager) return
    this.engine.unlockAudio()
    if (!this.engine.audioContext) return
    this.manager = this.makeManager(this.engine.audioContext)
    this.voices = new SoundVoices({ manager: this.manager, count: this.count })
    var files = new Set(Object.values(this.sounds).map((s) => s.file))
    this.manager.preload(Array.from(files))
  }

  /** Plays a sound or a phrase by number; resolves when it has ended. */
  async play (n) {
    if (!this.manager) return
    var phrase = this.phrases[n]
    if (!phrase) return this.one(n)
    for (var part of phrase) await this.one(part)
  }

  /** One sound: speech on the voice channel, an effect on the next voice in turn. Resolves when it has ended. */
  one (n) {
    var s = this.sounds[n]
    if (!s || !this.manager || !this.enabled(this.groupOf(s))) return Promise.resolve()
    var options = { rate: s.rate || 1 }
    if (s.speech) return this.manager.playVoice(s.file, options).ended
    this.turn = (this.turn + 1) % this.count
    var handle = this.voices.play(this.turn, s.file, Object.assign({ channel: this.channel }, options))
    if (handle) this.numbers[this.turn] = n
    return handle ? handle.ended : Promise.resolve()
  }

  /** Whether effect n is playing on a voice. */
  playing (n) {
    if (!this.voices) return false
    return this.numbers.some((m, v) => m === n && !!this.voices.playing(v))
  }

  /** Effect n played unless it is playing already: called while a sound should go on (an alarm). */
  keep (n) {
    if (!this.playing(n)) this.one(n)
  }

  /** Effect n stopped on every voice playing it. */
  stop (n) {
    if (!this.voices) return
    this.numbers.forEach((m, v) => {
      var h = m === n && this.voices.playing(v)
      if (h) h.stop()
    })
  }
}

export default SoundBoard
