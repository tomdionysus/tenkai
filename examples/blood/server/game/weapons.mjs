// The weapon in a player's hand (Blood's WeaponProcess): raising, holding, firing and lowering, each a QAV animation
// from BLOOD.RFF played on the server's clock; a shot goes off at the frames the QAV marks (its callbacks), so the
// weapon fires when the original's does. The client is told which QAV is playing and from when, and draws it.
import { VECTOR } from './combat.mjs'

const R = (n) => Math.floor(Math.random() * (2 * n + 1)) - n // Blood's Random3: -n to n

// Each weapon: its QAVs (by id), its ammo, and how it fires
export const WEAPONS = {
  1: { name: 'pitchfork', up: 0, idle: 1, fire: [2], down: 3, ammo: -1 },
  2: { name: 'flare pistol', up: 41, idle: 42, fire: [43], alt: [43], down: 44, ammo: 1, per: 1 },
  3: { name: 'sawed-off', up: 50, idle: 51, fire: [54, 55], alt: [56], reload: 57, down: 58, ammo: 2, per: 1 },
  4: { name: 'tommy gun', up: 64, idle: 65, fire: [66], alt: [67], down: 68, ammo: 3, per: 1, repeat: true },
  5: { name: 'napalm launcher', up: 89, idle: 90, fire: [91], down: 92, ammo: 4, per: 1 },
  6: { name: 'TNT', up: 16, idle: 20, fire: [23], alt: [22], down: 17, ammo: 5, per: 1 },
  7: { name: 'spray can', up: 8, idle: 9, fire: [10], down: 11, ammo: 6, per: 1, repeat: true }
}

export default class Weapons {
  constructor (game, p) {
    this.game = game
    this.p = p
    this.qavs = game.res.qavs
    this.state = 'idle'
    this.qav = WEAPONS[1].idle
    this.started = game.clock
    this.callbacksDone = -1
    this.barrel = 0
  }

  playing () { return this.qavs[this.qav] }

  play (state, qav) {
    this.state = state
    this.qav = qav
    this.started = this.game.clock
    this.callbacksDone = -1
  }

  /** Each tick (Blood's WeaponProcess) */
  tick (input) {
    const p = this.p, game = this.game
    if (p.health <= 0) return
    const w = WEAPONS[p.weapon] || WEAPONS[1]
    const q = this.playing()
    const elapsed = game.clock - this.started
    // The callbacks (shots) of the frames reached since last time
    if (q && (this.state === 'fire' || this.state === 'alt')) {
      const frame = Math.min(q.frames.length - 1, Math.floor(elapsed / q.ticksPerFrame))
      for (let f = this.callbacksDone + 1; f <= frame; f++) if (q.frames[f].callback > 0) this.shoot(w, q.frames[f].callback, this.state === 'alt')
      this.callbacksDone = frame
    }
    if (q && q.frames.some((f) => f.sound.id > 0)) {
      const frame = Math.min(q.frames.length - 1, Math.floor(elapsed / q.ticksPerFrame))
      for (let f = (this.soundsDone ?? -1) + 1; f <= frame; f++) if (q.frames[f].sound.id > 0) game.sound(p.sprite, q.frames[f].sound.id)
      this.soundsDone = frame
    }
    const done = !q || elapsed >= q.duration
    const want = input.newWeapon || p.weapons.want
    switch (this.state) {
      case 'down':
        if (done) { p.weapon = this.next; this.play('up', WEAPONS[p.weapon].up); this.soundsDone = -1 }
        return
      case 'up':
        if (done) this.play('idle', w.idle)
        return
      case 'fire': case 'alt':
        if (!done) return
        if (w.repeat && (input.buttons & (this.state === 'alt' ? 8 : 4)) && this.hasAmmo(w)) { this.play(this.state, this.state === 'alt' ? w.alt[0] : w.fire[0]); this.soundsDone = -1; return }
        if (w.reload && p.weapon === 3 && this.barrel === 0 && this.hasAmmo(w)) { this.play('reload', w.reload); return }
        this.play('idle', w.idle)
        return
      case 'reload':
        if (done) this.play('idle', w.idle)
        return
    }
    // Idle: a change of weapon, a shot, or nothing
    if (want && want !== p.weapon && p.weapons[want] && this.hasAmmo(WEAPONS[want] || {})) {
      p.weapons.want = 0
      this.next = want
      this.play('down', w.down)
      this.soundsDone = -1
      return
    }
    p.weapons.want = 0
    if ((input.buttons & 4) && this.hasAmmo(w)) {
      const qav = w.fire[p.weapon === 3 ? this.barrel : 0]
      this.play('fire', qav)
      this.soundsDone = -1
    } else if ((input.buttons & 8) && w.alt && this.hasAmmo(w)) {
      this.play('alt', w.alt[0])
      this.soundsDone = -1
    } else if (!this.hasAmmo(w) && p.weapon !== 1) {
      // Out of ammo: the best weapon there is ammo for
      const best = [4, 3, 5, 2, 6, 7, 1].find((n) => p.weapons[n] && this.hasAmmo(WEAPONS[n]))
      if (best && best !== p.weapon) { this.next = best; this.play('down', w.down) }
    }
  }

  hasAmmo (w) { return w.ammo === undefined || w.ammo < 0 || this.p.ammo[w.ammo] > 0 }

  use (w, n = 1) { if (w.ammo >= 0) this.p.ammo[w.ammo] = Math.max(0, this.p.ammo[w.ammo] - n) }

  /** A QAV frame's shot (Blood's Fire* functions) */
  shoot (w, callback, alt) {
    const p = this.p, s = p.sprite, game = this.game, combat = game.combat
    const { dx, dy, dz } = combat.aim(s.ang, p.slope())
    const zw = p.zWeapon - s.z
    switch (p.weapon) {
      case 1: // FireFork: four tines
        for (let i = 0; i < 4; i++) combat.fireVector(s, 0, zw, dx + R(2000), dy + R(2000), dz + R(2000), VECTOR.tine)
        game.sound(s, 1002)
        break
      case 3: { // the sawed-off: one barrel, or both (alt)
        const barrels = alt ? 2 : 1
        const shells = Math.min(barrels, p.ammo[2])
        for (let b = 0; b < shells; b++) for (let i = 0; i < 16; i++) combat.fireVector(s, 0, zw, dx + R(4000), dy + R(4000), dz + R(4000), VECTOR.shell)
        this.use(w, shells)
        this.barrel = alt ? 0 : (this.barrel + 1) % 2
        game.sound(s, alt ? 1002 : 1001)
        game.shake(p, 0x100)
        break
      }
      case 4: // the tommy gun: a bullet a frame, spread a little (alt: a sweep)
        combat.fireVector(s, 0, zw, dx + R(alt ? 3000 : 300), dy + R(alt ? 3000 : 300), dz + R(300), VECTOR.tommyRegular)
        this.use(w, 1)
        game.sound(s, 1006 + (Math.random() < 0.5 ? 0 : 1))
        break
      case 2: // the flare pistol: a flare
        game.missiles.fire(s, 'flare', s.ang, p.slope(), zw)
        this.use(w, 1)
        game.sound(s, 420)
        break
      case 5: // napalm
        game.missiles.fire(s, 'napalm', s.ang, p.slope(), zw)
        this.use(w, 1)
        game.sound(s, 480)
        break
      case 6: // TNT: thrown (alt: dropped)
        game.missiles.throwTNT(s, alt ? 0 : 0x80000, p.slope(), zw)
        this.use(w, 1)
        break
      case 7: // the spray can: a short flame
        game.missiles.fire(s, 'spray', s.ang, p.slope(), zw)
        this.use(w, 1)
        break
    }
  }

  /** What the client draws: the QAV and how far into it */
  status () { return { qav: this.qav, at: this.game.clock - this.started, state: this.state } }
}
