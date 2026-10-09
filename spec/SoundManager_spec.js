const SoundManager = require('../lib/SoundManager')

// A minimal stand-in for the Web Audio API
function fakeContext () {
  var ctx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    sources: [],
    resume: jasmine.createSpy('resume'),
    decodeAudioData: (data) => Promise.resolve({ decoded: data }),
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
})
