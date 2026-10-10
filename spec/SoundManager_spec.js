import SoundManager from '../lib/SoundManager.js'

// A minimal stand-in for the Web Audio API
function fakeContext () {
  var ctx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    sources: [],
    resume: jasmine.createSpy('resume'),
    decodeAudioData: (data) => Promise.resolve({ decoded: data, duration: 10 }),
    createGain: () => {
      var gain = { gain: { value: 1, setTargetAtTime: jasmine.createSpy('setTargetAtTime') } }
      gain.connect = (next) => next
      return gain
    },
    createBufferSource: () => {
      var source = {
        connect: (next) => next,
        start: jasmine.createSpy('start'),
        stop: jasmine.createSpy('stop').and.callFake(() => source.onended && source.onended())
      }
      ctx.sources.push(source)
      return source
    }
  }
  return ctx
}

describe('SoundManager', () => {
  var ctx, sounds
  beforeEach(() => {
    ctx = fakeContext()
    global.fetch = jasmine.createSpy('fetch').and.callFake((url) => Promise.resolve({ ok: !url.includes('missing'), arrayBuffer: () => Promise.resolve(url) }))
    sounds = new SoundManager({ base: 'snd/', context: ctx })
  })

  afterEach(() => { delete global.fetch })

  it('should load each sound once, with the base prefixed', async () => {
    await sounds.load('a.wav')
    await sounds.load('a.wav')
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith('snd/a.wav')
  })

  it('should resolve null for a missing sound', async () => {
    expect(await sounds.load('missing.wav')).toBeNull()
  })

  it('should resume a suspended context', () => {
    ctx.state = 'suspended'
    sounds.resume()
    expect(ctx.resume).toHaveBeenCalled()
  })

  it('should play effects and resolve when they end', async () => {
    var played = sounds.playEffect('a.wav', { volume: 0.5 })
    await sounds.load('a.wav')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(ctx.sources.length).toEqual(1)
    expect(sounds.effectPlaying).toBe(true)
    ctx.sources[0].onended()
    await played
    expect(sounds.effectPlaying).toBe(false)
  })

  it('should let effects overlap by default', async () => {
    sounds.playEffect('a.wav')
    sounds.playEffect('b.wav')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(ctx.sources.length).toEqual(2)
    expect(ctx.sources[0].stop).not.toHaveBeenCalled()
  })

  it('should stop the previous effect when effects are exclusive', async () => {
    sounds = new SoundManager({ context: ctx, exclusiveEffects: true })
    sounds.playEffect('a.wav')
    await new Promise((resolve) => setTimeout(resolve, 0))
    sounds.playEffect('b.wav')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(ctx.sources[0].stop).toHaveBeenCalled()
    expect(ctx.sources.length).toEqual(2)
  })

  it('should keep the background playing and only change volume when the same sound is asked for', async () => {
    await sounds.playBackground('wind.wav', { volume: 0.5 })
    expect(ctx.sources.length).toEqual(1)
    await sounds.playBackground('wind.wav', { volume: 0.2 })
    expect(ctx.sources.length).toEqual(1)
    expect(sounds.background).toEqual('wind.wav')
  })

  it('should replace the background with a different sound', async () => {
    jasmine.clock().install()
    await sounds.playBackground('wind.wav')
    await sounds.playBackground('sea.wav')
    jasmine.clock().tick(600)
    expect(ctx.sources[0].stop).toHaveBeenCalled()
    expect(sounds.background).toEqual('sea.wav')
    jasmine.clock().uninstall()
  })

  it('should stop the background', () => {
    sounds.playBackground('wind.wav')
    sounds.stopBackground()
    expect(sounds.background).toBeNull()
  })

  it('should resolve waitEffect immediately with no effects', async () => {
    await sounds.waitEffect()
  })

  it('should mute and set the volume of everything through one gain', () => {
    sounds.volume = 0.5
    expect(sounds._master.gain.value).toEqual(0.5)
    sounds.muted = true
    expect(sounds._master.gain.value).toEqual(0)
    sounds.muted = false
    expect(sounds._master.gain.value).toEqual(0.5)
  })

  it('should stream music from a media element, replacing what is playing', () => {
    var elements = []
    var music = new SoundManager({
      base: 'music/',
      context: ctx,
      createMusic: (src) => {
        var el = { src, play: jasmine.createSpy('play').and.returnValue(Promise.resolve()), pause: jasmine.createSpy('pause') }
        elements.push(el)
        return el
      }
    })
    music.playMusic('theme.mp3', { volume: 0.6 })
    expect(elements[0].src).toEqual('music/theme.mp3')
    expect(elements[0].loop).toBe(true)
    expect(elements[0].volume).toBeCloseTo(0.6)
    expect(music.music).toEqual('theme.mp3')
    music.playMusic('battle.mp3', { loop: false })
    expect(elements[0].pause).toHaveBeenCalled()
    expect(elements[1].loop).toBe(false)
    music.muted = true
    expect(elements[1].volume).toEqual(0)
    music.stopMusic()
    expect(music.music).toBeNull()
  })

  it('should preload several sounds', async () => {
    await sounds.preload(['a.wav', 'b.wav'])
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  describe('play', () => {
    var settle = () => new Promise((resolve) => setTimeout(resolve, 0))

    it('should start every layer together once all have loaded, looping as asked', async () => {
      var h = sounds.play(['a.ogg', { src: 'b.ogg', loop: true }], { channel: 'music' })
      expect(h.playing).toBe(true)
      expect(ctx.sources.length).toEqual(0)
      await settle()
      expect(ctx.sources.length).toEqual(2)
      expect(ctx.sources.map((n) => n.loop)).toEqual([false, true])
      var when = ctx.sources[0].start.calls.argsFor(0)[0]
      expect(ctx.sources[1].start.calls.argsFor(0)[0]).toEqual(when)
    })

    it('should end when every layer has ended', async () => {
      var h = sounds.play(['a.ogg', 'b.ogg'])
      await settle()
      ctx.sources[0].onended()
      expect(h.playing).toBe(true)
      ctx.sources[1].onended()
      expect(h.playing).toBe(false)
      await h.ended
    })

    it('should not start if stopped while loading', async () => {
      var h = sounds.play('a.ogg')
      h.stop()
      expect(h.playing).toBe(false)
      await settle()
      expect(ctx.sources.length).toEqual(0)
    })

    it('should seek by restarting layers, wrapping looping ones and silencing others past their end', async () => {
      var h = sounds.play(['a.ogg', { src: 'b.ogg', loop: true }])
      await settle()
      var old = ctx.sources.slice()
      h.seek(12)
      expect(old[0].stop).toHaveBeenCalled()
      expect(old[1].stop).toHaveBeenCalled()
      expect(h.playing).toBe(true)
      var fresh = ctx.sources.slice(2)
      expect(fresh.length).toEqual(1)
      expect(fresh[0].loop).toBe(true)
      expect(fresh[0].start.calls.argsFor(0)[1]).toEqual(2)
    })

    it('should loop over a region, and wrap a seek within it', async () => {
      var h = sounds.play('a.ogg', { loop: true, loopStart: 4, loopEnd: 8 })
      await settle()
      expect([ctx.sources[0].loopStart, ctx.sources[0].loopEnd]).toEqual([4, 8])
      h.seek(13)
      expect(ctx.sources[1].start.calls.argsFor(0)[1]).toEqual(5)
      var own = sounds.play([{ src: 'b.ogg', loop: true, loopStart: 1 }])
      await settle()
      expect(ctx.sources[2].loopStart).toEqual(1)
      expect(ctx.sources[2].loopEnd).toBeUndefined()
      own.stop()
    })

    it('should apply a seek made before loading, and an offset', async () => {
      var h = sounds.play('a.ogg', { offset: 3 })
      h.seek(4)
      await settle()
      expect(ctx.sources[0].start.calls.argsFor(0)[1]).toEqual(4)
      sounds.play('b.ogg', { offset: 3 })
      await settle()
      expect(ctx.sources[1].start.calls.argsFor(0)[1]).toEqual(3)
    })

    it('should set its own volume and its channel', async () => {
      var h = sounds.play('a.ogg', { volume: 0.25 })
      expect(h.volume).toEqual(0.25)
      h.volume = 0.5
      expect(h.volume).toEqual(0.5)
      expect(() => sounds.play('a.ogg', { channel: 'nope' })).toThrowError(/no such channel/)
    })
  })

  describe('channels', () => {
    it('should keep a volume per channel', () => {
      expect(sounds.channelVolume('music')).toEqual(1)
      sounds.setChannelVolume('voice', 0.3)
      expect(sounds.channelVolume('voice')).toEqual(0.3)
      expect(() => sounds.channelVolume('x')).toThrowError(/no such channel/)
    })

    it('should scale streamed music by the music channel', () => {
      var element = { play: () => Promise.resolve(), pause: () => {} }
      sounds = new SoundManager({ context: ctx, createMusic: () => element })
      sounds.playMusic('m.ogg', { volume: 0.5 })
      sounds.setChannelVolume('music', 0.5)
      expect(element.volume).toEqual(0.25)
    })
  })

  describe('voice', () => {
    it('should speak one line at a time and count loading as speaking', async () => {
      var first = sounds.playVoice('one.ogg')
      expect(sounds.voicePlaying).toBe(true)
      var second = sounds.playVoice('two.ogg')
      expect(first.playing).toBe(false)
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(ctx.sources.length).toEqual(1)
      ctx.sources[0].onended()
      expect(second.playing).toBe(false)
      expect(sounds.voicePlaying).toBe(false)
      sounds.playVoice('three.ogg')
      sounds.stopVoice()
      expect(sounds.voicePlaying).toBe(false)
    })
  })
})
