/**
 * A fixed number of voices for a game's sounds, as old sound chips and drivers had (the Amiga's four channels): each
 * sound plays on a voice, and a new one replaces whatever that voice was playing, unless the sound playing is held
 * (it cannot be cut off until it ends) or has a higher priority. A claim (a tune) takes every voice: it stops them
 * all, and every other sound is refused while it plays. Sounds are played through a {@link SoundManager}.
 *
 * @example
const voices = new SoundVoices({ manager: game.sound, count: 4 })
voices.play(0, 'sfx/shot.wav')
voices.play(3, 'sfx/scream.wav', {}, { hold: true })   // not cut off on voice 3 until it ends
voices.claim('music/title.ogg', { channel: 'music', loop: true })
 */
class SoundVoices {
  /**
   * @param {object} options
   * @param {SoundManager} options.manager What plays the sounds
   * @param {integer} options.count How many voices (default 4)
   */
  constructor ({ manager, count = 4 }) {
    this.manager = manager
    /** Each voice's last sound (a SoundManager handle), or null. */
    this.list = new Array(count).fill(null)
    /** The sound holding every voice, or null. */
    this.claimed = null
  }

  /** Whether a claim is playing (every other sound is refused). */
  get claimPlaying () {
    return !!(this.claimed && this.claimed.playing)
  }

  /** Voice v's sound while it plays, or null. */
  playing (v) {
    const h = this.list[v]
    return h && h.playing ? h : null
  }

  /**
   * Play a sound on voice v, replacing what it plays, unless a claim is playing, or the voice's sound is held or of
   * a higher priority.
   * @param {integer} v The voice
   * @param {string} src The sound, as for {@link SoundManager#play}
   * @param {object} options For {@link SoundManager#play} (loop, rate, channel...)
   * @param {object} rules
   * @param {boolean} rules.hold Not to be cut off by another sound on this voice until it ends (default false)
   * @param {number} rules.priority Cut off only by a sound of this priority or higher (default 0)
   * @returns {object|null} The sound's handle, or null if refused
   */
  play (v, src, options = {}, { hold = false, priority = 0 } = {}) {
    if (this.claimPlaying) return null
    const current = this.playing(v)
    if (current && (current.held || current.priority > priority)) return null
    if (this.list[v]) this.list[v].stop()
    const handle = this.manager.play(src, options)
    handle.held = hold
    handle.priority = priority
    this.list[v] = handle
    return handle
  }

  /**
   * Play a sound that takes every voice: the voices and any claim before it are stopped.
   * @returns {object} The sound's handle
   */
  claim (src, options = {}) {
    this.release()
    this.stopVoices()
    this.claimed = this.manager.play(src, options)
    return this.claimed
  }

  /** Stop the claim, if any. */
  release () {
    if (this.claimed) this.claimed.stop()
    this.claimed = null
  }

  /** Stop every voice's sound. */
  stopVoices () {
    for (let v = 0; v < this.list.length; v++) {
      if (this.list[v]) this.list[v].stop()
      this.list[v] = null
    }
  }

  /** Silence: the claim and every voice stopped. */
  stop () {
    this.release()
    this.stopVoices()
  }
}

export default SoundVoices
