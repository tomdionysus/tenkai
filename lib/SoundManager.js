/**
 * SoundManager plays sounds through the Web Audio API: one looping background sound, which cross-fades
 * when it changes, effects on top, streamed music, and a voice for spoken lines. Sounds are loaded by URL
 * and cached.
 *
 * Every sound goes through a **channel**: `music`, `effects`, `background` or `voice`, each with its own
 * volume under the overall one, so a player can turn the music down without losing the dialogue.
 *
 * [play()]{@link SoundManager#play} is the general method the others are built on. It returns a handle to
 * stop, seek or watch one sound, and it can start several clips together as layers of one sound, some
 * looping and some not, as games do with music written as separate instrument tracks.
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
// Music in layers that start together; the drums loop, the intro does not
const theme = sounds.play([{ src: 'intro.ogg' }, { src: 'drums.ogg', loop: true }], { channel: 'music' })
theme.seek(12.5)
sounds.playVoice('lines/hello.ogg')
if (sounds.voicePlaying) { ... }
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
    this._channels = {}
    for (var name of SoundManager.CHANNELS) {
      this._channels[name] = this.context.createGain()
      this._channels[name].connect(this._master)
    }
    this._voice = null
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
    if (this._music) this._music.element.volume = this._muted ? 0 : this._volume * this._channels.music.gain.value * this._music.volume
  }

  /**
   * A channel's volume, 0 to 1, under the overall volume.
   * @param {string} name `music`, `effects`, `background` or `voice`
   * @returns {number}
   */
  channelVolume (name) {
    return this._channel(name).gain.value
  }

  /**
   * Set a channel's volume.
   * @param {string} name `music`, `effects`, `background` or `voice`
   * @param {number} volume 0 to 1
   */
  setChannelVolume (name, volume) {
    this._channel(name).gain.value = volume
    // Streamed music plays outside Web Audio, so its element follows the channel
    if (name === 'music') this._applyVolume()
  }

  _channel (name) {
    var channel = this._channels[name]
    if (!channel) throw new Error('SoundManager: no such channel ' + name)
    return channel
  }

  /**
   * Play a sound and return a handle to it. `src` is one URL, or a list of layers that start together, each
   * a URL or `{ src, loop }`. The sound starts once all its layers have loaded; the handle works at once,
   * so it can be stopped before it starts.
   *
   * The handle has `playing` (true from the call until every layer has ended or it is stopped), `stop()`,
   * `seek(seconds)` (restart every layer at that time, wrapping looping layers round), `volume`, and
   * `ended`, a promise resolved when it stops playing.
   *
   * @param {string|Array<string|object>} src URL relative to the base, or layers
   * @param {object} options
   * @param {string} options.channel (optional, default `effects`)
   * @param {boolean} options.loop Loop every layer that does not say otherwise (optional, default false)
   * @param {number} options.loopStart Where a looping layer's loop begins, in seconds: it plays from the start,
   *   then repeats from here (optional, default the start; a layer can give its own)
   * @param {number} options.loopEnd Where the loop ends, in seconds (optional, default the end)
   * @param {number} options.volume 0 to 1 (optional, default 1)
   * @param {number} options.offset Start this many seconds in (optional, default 0)
   * @returns {object} The handle
   */
  play (src, options = {}) {
    var layers = (Array.isArray(src) ? src : [src]).map((l) => typeof l === 'string' ? { src: l } : l)
    var output = this.context.createGain()
    output.gain.value = options.volume == null ? 1 : options.volume
    output.connect(this._channel(options.channel || 'effects'))
    var resolveEnded
    var handle = new SoundHandle(this, layers.map((l) => ({
      src: l.src,
      loop: l.loop === undefined ? !!options.loop : !!l.loop,
      loopStart: l.loopStart === undefined ? options.loopStart : l.loopStart,
      loopEnd: l.loopEnd === undefined ? options.loopEnd : l.loopEnd
    })), output, new Promise((resolve) => { resolveEnded = resolve }))
    handle._resolveEnded = resolveEnded
    Promise.all(layers.map((l) => this.load(l.src))).then((buffers) => {
      if (handle._stopped) return
      handle._buffers = buffers
      handle._start(handle._seekTo === undefined ? (options.offset || 0) : handle._seekTo)
    })
    return handle
  }

  /**
   * Speak a line on the voice channel. Only one line plays at a time: a new one stops the last.
   * @param {string} src URL relative to the base
   * @param {object} options As for [play()]{@link SoundManager#play} (optional)
   * @returns {object} The line's handle
   */
  playVoice (src, options = {}) {
    this.stopVoice()
    this._voice = this.play(src, Object.assign({}, options, { channel: 'voice' }))
    return this._voice
  }

  /** Stop the line being spoken. */
  stopVoice () {
    if (this._voice) this._voice.stop()
    this._voice = null
  }

  /** Whether a line is being spoken, counting from when it was asked for, while it loads. */
  get voicePlaying () { return !!(this._voice && this._voice.playing) }

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
      source.connect(gain).connect(this._channels.effects)
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
    bg.gain.connect(this._channels.background)
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

/** The channels every sound goes through. */
SoundManager.CHANNELS = ['music', 'effects', 'background', 'voice']

/**
 * A sound started by [SoundManager.play()]{@link SoundManager#play}: one or more layers playing together.
 */
class SoundHandle {
  constructor (manager, layers, output, ended) {
    this.manager = manager
    this.layers = layers
    this.ended = ended
    this._output = output
    this._buffers = null
    this._nodes = []
    this._stopped = false
  }

  /** True from the call that started it until every layer has ended or it is stopped. */
  get playing () { return !this._stopped }

  /** The sound's volume, 0 to 1. */
  get volume () { return this._output.gain.value }
  set volume (v) { this._output.gain.value = v }

  _start (offset) {
    var context = this.manager.context
    var when = context.currentTime + 0.02
    var nodes = []
    var starts = []
    this._buffers.forEach((buffer, i) => {
      if (!buffer) return
      var layer = this.layers[i]
      var at = offset
      if (at >= buffer.duration) {
        if (!layer.loop) return
        // Past the end, a loop wraps round within its loop region
        var ls = layer.loopStart || 0
        var le = layer.loopEnd || buffer.duration
        at = le > ls ? ls + (at - ls) % (le - ls) : at % buffer.duration
      }
      starts.push(at)
      var node = context.createBufferSource()
      node.buffer = buffer
      node.loop = layer.loop
      if (layer.loop && layer.loopStart !== undefined) node.loopStart = layer.loopStart
      if (layer.loop && layer.loopEnd !== undefined) node.loopEnd = layer.loopEnd
      node.connect(this._output)
      node.onended = () => {
        if (this._nodes !== nodes) return
        nodes.splice(nodes.indexOf(node), 1)
        if (!nodes.length) this._finish()
      }
      nodes.push(node)
    })
    this._nodes = nodes
    nodes.forEach((node, i) => node.start(when, starts[i]))
    if (!nodes.length) this._finish()
  }

  _finish () {
    if (this._stopped) return
    this._stopped = true
    this._nodes = []
    this._resolveEnded()
  }

  /**
   * Restart every layer at a time in seconds; looping layers wrap round, others past their end stay silent.
   * Before the sound has loaded, it starts there instead.
   * @param {number} seconds
   */
  seek (seconds) {
    if (this._stopped) return
    var old = this._nodes
    this._nodes = []
    for (var node of old) {
      try { node.stop() } catch (e) {}
    }
    if (this._buffers) this._start(seconds)
    else this._seekTo = seconds
  }

  /** Stop it. */
  stop () {
    var nodes = this._nodes
    this._nodes = []
    for (var node of nodes) {
      try { node.stop() } catch (e) {}
    }
    this._finish()
  }
}

SoundManager.SoundHandle = SoundHandle

export default SoundManager
