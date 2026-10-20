import SoundBoard from '../lib/SoundBoard.js'

describe('SoundBoard', () => {
  // A manager that records what it plays; every sound ends at once
  var manager = () => {
    var m = { played: [], preloaded: null }
    var handle = (what) => { m.played.push(what); return { ended: Promise.resolve(), stop () {}, playing: false } }
    m.play = (file, options) => handle(file + '@' + options.channel + ':' + options.rate)
    m.playVoice = (file) => handle(file + '@voice')
    m.preload = (files) => { m.preloaded = files }
    return m
  }
  var engine = () => ({ audioContext: null, unlockAudio () { this.audioContext = {} } })
  var sounds = { 1: { file: 'a.wav' }, 2: { file: 'b.wav', rate: 2 }, 3: { file: 'say.wav', speech: true } }

  it('should stay silent until unlocked, then load every sound once', async () => {
    var m = manager()
    var board = new SoundBoard({ engine: engine(), sounds: Object.assign({ 4: { file: 'a.wav' } }, sounds), manager: () => m })
    await board.play(1)
    expect(m.played).toEqual([])
    board.unlock()
    expect(board.ready).toBe(true)
    expect(m.preloaded.sort()).toEqual(['a.wav', 'b.wav', 'say.wav'])
  })

  it('should play effects in turn on its voices, speech on the voice channel, and phrases part after part', async () => {
    var m = manager()
    var board = new SoundBoard({ engine: engine(), sounds, phrases: { 9: [3, 2] }, manager: () => m })
    board.unlock()
    await board.play(1)
    await board.play(9)
    expect(m.played).toEqual(['a.wav@effects:1', 'say.wav@voice', 'b.wav@effects:2'])
    expect(board.turn).toBe(0)
  })

  it('should switch a group of sounds off and on, speech and effects their own groups unless given', async () => {
    var m = manager()
    var board = new SoundBoard({ engine: engine(), sounds: Object.assign({ 5: { file: 'm.wav', group: 'music' } }, sounds), manager: () => m })
    board.unlock()
    expect(board.toggle('speech')).toBe(false)
    await board.play(3)
    await board.play(1)
    expect(m.played).toEqual(['a.wav@effects:1'])
    board.enable('effects', false)
    board.enable('speech', true)
    await board.play(1)
    await board.play(3)
    await board.play(5)
    expect(m.played).toEqual(['a.wav@effects:1', 'say.wav@voice', 'm.wav@effects:1'])
    expect(board.enabled('effects')).toBe(false)
    expect(board.enabled('music')).toBe(true)
  })

  it('should keep an effect going without restarting it, and stop it by its number', () => {
    var m = manager()
    var live = []
    m.play = (file) => {
      m.played.push(file)
      var h = { ended: Promise.resolve(), playing: true, stop () { this.playing = false } }
      live.push(h)
      return h
    }
    var board = new SoundBoard({ engine: engine(), sounds, voices: 3, manager: () => m })
    board.unlock()
    board.keep(1)
    board.keep(1)
    board.one(2)
    expect(m.played).toEqual(['a.wav', 'b.wav'])
    expect(board.playing(1)).toBe(true)
    board.stop(1)
    expect(board.playing(1)).toBe(false)
    expect(live[1].playing).toBe(true)
    board.keep(1)
    expect(m.played).toEqual(['a.wav', 'b.wav', 'a.wav'])
  })
})
