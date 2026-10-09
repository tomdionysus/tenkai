/**
 * SoundManager plays sounds through the Web Audio API: one looping background sound, which cross-fades
 * when it changes, and effects on top. Sounds are loaded by URL and cached.
 *
 * With `exclusiveEffects`, a new effect stops the previous one, as in many older adventure games that had
 * a single effect channel.
 *
 * Browsers only allow audio after a user gesture: call [resume()]{@link SoundManager#resume} from a click
 * or key handler.
 *
 * @example
const sounds = new SoundManager({ base: 'sounds/' })
sounds.playBackground('wind.wav', { volume: 0.5 })
sounds.playEffect('door.wav').then(() => console.log('door closed'))
 */
class SoundManager {
  /**
   * @param {object} options
   * @param {string} options.base Prefix for every URL (optional)
   * @param {boolean} options.exclusiveEffects A new effect stops the previous one (optional, default false)
   * @param {AudioContext} options.context The audio context to use (optional, created if not given)
   * @param {function} options.createMusic Creates the media element for music (optional, for testing)
   */
  constructor (options = {}) {
    this.base = options.base || ''
    this.exclusiveEffects = !!options.exclusiveEffects
    var AudioContext = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
    this.context = options.context || new AudioContext()
    this._createMusic = options.createMusic || ((src) => new window.Audio(src))
    // Everything except music goes through one gain, for the overall volume and muting
    this._master = this.context.createGain()
    this._master.connect(this.context.destination)
    this._volume = 1
    this._muted = false
    this._buffers = {}
    this._effects = new Set()
    this._background = null
    this._music = null
    this.fade = 0.15
  }

  /** Overall volume, 0 to 1, for effects, the background and music. */
  get volume () { return this._volume }
  set volume (v) {
    this._volume = v
    this._applyVolume()
  }

  /** Whether all sound is silenced. */
  get muted () { return this._muted }
  set muted (m) {
    this._muted = !!m
    this._applyVolume()
  }

  _applyVolume () {
    this._master.gain.value = this._muted ? 0 : this._volume
    if (this._music) this._music.element.volume = this._muted ? 0 : this._volume * this._music.volume
  }

  /** Resume audio after a user gesture. */
  resume () {
    if (this.context.state === 'suspended') this.context.resume()
  }

  /**
   * Load and decode a sound.
   * @param {string} src URL relative to the base
   * @returns {Promise<AudioBuffer|null>} null if it could not be loaded
   */
  load (src) {
    if (!this._buffers[src]) {
      this._buffers[src] = fetch(this.base + src)
        .then((r) => r.ok ? r.arrayBuffer() : Promise.reject(new Error('Sound not found: ' + src)))
        .then((data) => this.context.decodeAudioData(data))
        .catch(() => null)
    }
    return this._buffers[src]
  }

  /**
   * Load several sounds ahead of playing them.
   * @param {string[]} srcs URLs relative to the base
   * @returns {Promise} Resolves when all have loaded or failed
   */
  preload (srcs) {
    return Promise.all(srcs.map((src) => this.load(src)))
  }

  /**
   * Play music, streamed from a media element rather than decoded into memory, so long tracks start at
   * once and cost little. Any music already playing stops.
   * @param {string} src URL relative to the base
   * @param {object} options
   * @param {boolean} options.loop Loop the track (optional, default true)
   * @param {number} options.volume 0 to 1 (optional, default 1)
   * @returns {HTMLAudioElement} The element playing the music
   */
  playMusic (src, options = {}) {
    this.stopMusic()
    var element = this._createMusic(this.base + src)
    element.loop = options.loop === undefined ? true : !!options.loop
    this._music = { src, element, volume: options.volume === undefined ? 1 : options.volume }
    this._applyVolume()
    var playing = element.play()
    // Browsers refuse to play until the user has interacted with the page; the track simply does not start
    if (playing && playing.catch) playing.catch(() => {})
    return element
  }

  /** Stop the music. */
  stopMusic () {
    if (this._music) this._music.element.pause()
    this._music = null
  }

  /** The URL of the music playing, or null. */
  get music () { return this._music ? this._music.src : null }

  /**
   * Play an effect.
   * @param {string} src URL relative to the base
   * @param {object} options
   * @param {number} options.volume 0 to 1 (optional, default 1)
   * @param {boolean} options.loop Loop until stopped (optional)
   * @returns {Promise} Resolves when the effect ends or is stopped
   */
  playEffect (src, options = {}) {
    if (this.exclusiveEffects) this.stopEffects()
    var token = this._effectToken = {}
    this._lastEffect = this.load(src).then((buffer) => new Promise((resolve) => {
      if (!buffer || (this.exclusiveEffects && this._effectToken !== token)) return resolve()
      var source = this.context.createBufferSource()
      var gain = this.context.createGain()
      gain.gain.value = options.volume == null ? 1 : options.volume
      source.buffer = buffer
      source.loop = !!options.loop
      source.connect(gain).connect(this._master)
      source.onended = () => { this._effects.delete(source); resolve() }
      this._effects.add(source)
      source.start()
    }))
    return this._lastEffect
  }

  /** Stop every playing effect. */
  stopEffects () {
    for (var source of this._effects) {
      try { source.stop() } catch (e) {}
    }
    this._effects.clear()
    this._effectToken = null
  }

  /** Whether any effect is playing. */
  get effectPlaying () { return this._effects.size > 0 }

  /**
   * Wait for the most recently started effect to finish.
   * @returns {Promise}
   */
  waitEffect () {
    return this._lastEffect || Promise.resolve()
  }

  /**
   * Play a looping background sound. If it is already playing only its volume changes; otherwise the
   * previous background fades out.
   * @param {string} src URL relative to the base
   * @param {object} options
   * @param {number} options.volume 0 to 1 (optional, default 1)
   */
  playBackground (src, options = {}) {
    var volume = options.volume == null ? 1 : options.volume
    if (this._background && this._background.src === src) return this.setBackgroundVolume(volume)
    this.stopBackground()
    var bg = { src, volume, gain: this.context.createGain(), source: null }
    bg.gain.gain.value = 0
    bg.gain.connect(this._master)
    this._background = bg
    return this.load(src).then((buffer) => {
      if (!buffer || this._background !== bg) return
      bg.source = this.context.createBufferSource()
      bg.source.buffer = buffer
      bg.source.loop = true
      bg.source.connect(bg.gain)
      bg.source.start()
      bg.gain.gain.setTargetAtTime(bg.volume, this.context.currentTime, this.fade)
    })
  }

  /** The URL of the background sound, or null. */
  get background () { return this._background ? this._background.src : null }

  /**
   * Change the background volume.
   * @param {number} volume 0 to 1
   */
  setBackgroundVolume (volume) {
    if (!this._background) return
    this._background.volume = volume
    this._background.gain.gain.setTargetAtTime(volume, this.context.currentTime, this.fade)
  }

  /** Silence the background without losing its place. */
  pauseBackground () {
    if (this._background) this._background.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.05)
  }

  /** Bring the background back after [pauseBackground()]{@link SoundManager#pauseBackground}. */
  resumeBackground () {
    if (this._background) this._background.gain.gain.setTargetAtTime(this._background.volume, this.context.currentTime, 0.1)
  }

  /** Fade out and stop the background. */
  stopBackground () {
    var bg = this._background
    if (!bg) return
    this._background = null
    bg.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.1)
    setTimeout(() => { if (bg.source) bg.source.stop() }, 500)
  }
}

module.exports = SoundManager
