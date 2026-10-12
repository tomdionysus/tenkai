import SoundVoices from '../lib/SoundVoices.js'

describe('SoundVoices', () => {
  // A manager whose sounds play until stopped (or ended by the spec)
  function manager () {
    const played = []
    return {
      played,
      play (src, options) {
        const h = { src, options, playing: true, stop () { this.playing = false } }
        played.push(h)
        return h
      }
    }
  }

  it('should replace a voice\'s sound with a new one, leaving the other voices', () => {
    const m = manager()
    const voices = new SoundVoices({ manager: m, count: 2 })
    const a = voices.play(0, 'a', { loop: true })
    const b = voices.play(1, 'b')
    const c = voices.play(0, 'c')
    expect(a.playing).toBe(false)
    expect(b.playing).toBe(true)
    expect(voices.playing(0)).toBe(c)
    expect(a.options).toEqual({ loop: true })
  })

  it('should not cut off a held sound until it ends', () => {
    const voices = new SoundVoices({ manager: manager() })
    const held = voices.play(3, 'scream', {}, { hold: true })
    expect(voices.play(3, 'shot')).toBeNull()
    expect(held.playing).toBe(true)
    held.playing = false
    expect(voices.play(3, 'shot').src).toBe('shot')
  })

  it('should let only an equal or higher priority cut a sound off', () => {
    const voices = new SoundVoices({ manager: manager() })
    voices.play(0, 'alarm', {}, { priority: 2 })
    expect(voices.play(0, 'step', {}, { priority: 1 })).toBeNull()
    expect(voices.play(0, 'alarm again', {}, { priority: 2 }).src).toBe('alarm again')
  })

  it('should give a claim every voice, refusing other sounds while it plays', () => {
    const voices = new SoundVoices({ manager: manager() })
    const a = voices.play(0, 'a')
    const tune = voices.claim('tune', { channel: 'music' })
    expect(a.playing).toBe(false)
    expect(voices.list.every((h) => h === null)).toBe(true)
    expect(voices.claimPlaying).toBe(true)
    expect(voices.play(1, 'b')).toBeNull()
    tune.playing = false
    expect(voices.play(1, 'b').src).toBe('b')
    const again = voices.claim('tune 2')
    voices.stop()
    expect(again.playing).toBe(false)
    expect(voices.claimed).toBeNull()
    expect(voices.playing(1)).toBeNull()
  })
})
