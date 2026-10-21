// The game's sounds on the client: the server sends which sound and where; this plays it from data/sounds/ through
// Tenkai's SoundManager, louder the nearer it is and panned to its side, at the pitch the SFX gives it.
import { SoundManager } from '../../../index.js'

export default class Sounds {
  constructor (game, index) {
    this.game = game
    this.byId = {}
    for (const s of Object.values(index)) this.byId[s.id] = s
    this.manager = new SoundManager({ base: 'data/', context: game.audioContext })
  }

  /** A sound event from the server: { id, x, y, z }, heard from the eye */
  event (e, eye) {
    const s = this.byId[e.id]
    if (!s) return
    let volume = Math.min(1, (s.relVol || 80) / 80)
    if (e.x !== undefined && eye) {
      const d = Math.hypot(e.x - eye.x, e.y - eye.y)
      volume *= Math.max(0, 1 - d / 24000)
      if (volume <= 0.01) return
    }
    const rate = (s.pitch || 65536) / 65536 * (1 + ((Math.random() * 2 - 1) * (s.pitchRange || 0)) / 65536)
    this.manager.play(s.file, { channel: 'effects', volume: volume * 0.7, rate })
  }
}
