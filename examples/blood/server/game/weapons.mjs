// The weapon in a player's hand (Blood's WeaponProcess): raising, holding, firing and lowering, each a QAV animation
// from BLOOD.RFF played on the server's clock; a shot goes off at the frames the QAV marks (its callbacks), so the
// weapon fires when the original's does. The client is told which QAV is playing and from when, and draws it.
import { VECTOR } from './combat.mjs'
import { mulscale, divscale, ksqrt } from '../../common/engine.mjs'
import { approxDist } from './physics.mjs'
import { STAT } from './triggers.mjs'

// The TNT bundle's QAVs: lit and held (its last callback: gone off in the hand), thrown, dropped, blown up
const BUNDLE = { fuse: 21, drop: 22, throw: 23, blown: 24 }


// Each weapon: its QAVs (by id), its ammo, and how it fires
export const WEAPONS = {
  1: { name: 'pitchfork', up: 0, idle: 1, fire: [2], down: 3, ammo: -1 },
  2: { name: 'flare pistol', up: 41, idle: 42, fire: [43], alt: [43], down: 44, ammo: 1, per: 1 },
  3: { name: 'sawed-off', up: 50, idle: 51, fire: [54, 55], alt: [56], reload: 57, down: 58, ammo: 2, per: 1 },
  4: { name: 'tommy gun', up: 64, idle: 65, fire: [66], alt: [67], down: 68, ammo: 3, per: 1, repeat: true },
  5: { name: 'napalm launcher', up: 89, idle: 90, fire: [91], down: 92, ammo: 4, per: 1 },
  6: { name: 'TNT', up: 16, idle: 20, fire: [21], alt: [22], down: 17, ammo: 5, per: 1 },
  7: { name: 'spray can', up: 8, idle: 9, fire: [10], down: 11, ammo: 6, per: 1, repeat: true }
}

/**
 * Blood's gWeaponTrack (BLOOD.EXE d:0x164fc), by weapon: how fast the aim follows a target across and up (16.16),
 * how far off the facing a dude (and a thing) may be to be aimed at, and a seeker's speed (its target's move led)
 */
const TRACK = [
  [0, 0, 0, 0, 0], [24576, 24576, 113, 85, 1118481], [32768, 32768, 113, 85, 2796202], [65536, 65536, 56, 28, 0],
  [24576, 32768, 56, 28, 0], [24576, 24576, 56, 28, 2796202], [24576, 24576, 113, 85, 0], [24576, 24576, 113, 56, 0],
  [32768, 65536, 113, 85, 2446677], [65536, 65536, 113, 0, 0], [65536, 65536, 170, 0, 0], [24576, 24576, 113, 85, 0],
  [24576, 24576, 113, 85, 0], [24576, 24576, 113, 85, 0]
].map(([aimSpeedHorz, aimSpeedVert, angleRange, thingAngle, seeker]) => ({ aimSpeedHorz, aimSpeedVert, angleRange, thingAngle, seeker }))

/** Blood's RotateVector (BLOOD.EXE 0xa6c50): turned by an angle, rounded */
function rotateVector (trig, x, y, ang) {
  const c = trig.Cos(ang), s = trig.Sin(ang)
  return { dx: Math.floor((x * c - y * s + 2 ** 29) / 2 ** 30), dy: Math.floor((x * s + y * c + 2 ** 29) / 2 ** 30) }
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
    // the sawed-off's loaded barrels (Blood's weaponState for it: two when raised with the shells for them)
    this.loaded = 2
  }

  playing () { return this.qavs[this.qav] }

  play (state, qav) {
    this.state = state
    this.qav = qav
    this.started = this.game.clock
    this.callbacksDone = -1
  }

  /** The callbacks (shots) and sounds of the frames the playing QAV has reached since last time */
  frames (w) {
    const p = this.p, game = this.game, q = this.playing()
    const elapsed = game.clock - this.started
    if (q && (this.state === 'fire' || this.state === 'alt')) {
      const frame = Math.min(q.frames.length - 1, Math.floor(elapsed / q.ticksPerFrame))
      for (let f = this.callbacksDone + 1; f <= frame; f++) if (q.frames[f].callback > 0) this.shoot(w, q.frames[f].callback, this.state === 'alt')
      this.callbacksDone = frame
    } else if (q && this.state === 'reload') {
      // the sawed-off's reload: its frame's callback throws the spent shells (Blood's EjectShell, BLOOD.EXE 0x4d104)
      const frame = Math.min(q.frames.length - 1, Math.floor(elapsed / q.ticksPerFrame))
      for (let f = this.callbacksDone + 1; f <= frame; f++) if (q.frames[f].callback > 0 && p.weapon === 3) { this.shellEject(25, 35); this.shellEject(48, 35) }
      this.callbacksDone = frame
    }
    if (q && q.frames.some((f) => f.sound.id > 0)) {
      const frame = Math.min(q.frames.length - 1, Math.floor(elapsed / q.ticksPerFrame))
      for (let f = (this.soundsDone ?? -1) + 1; f <= frame; f++) if (q.frames[f].sound.id > 0) game.sound(p.sprite, q.frames[f].sound.id)
      this.soundsDone = frame
    }
  }

  /**
   * A shot's QAV begun: its first frame at once (Blood's StartQAV plays it as it starts, WeaponPlay from -4 to 0:
   * the sawed-off's barrels go off on the press, BLOOD001 at tick 1149)
   */
  fire (state, qav, w) {
    this.play(state, qav)
    this.soundsDone = -1
    this.frames(w)
  }

  /** Each tick (Blood's WeaponProcess) */
  tick (input) {
    const p = this.p, game = this.game
    if (p.health <= 0) return
    const w = WEAPONS[p.weapon] || WEAPONS[1]
    const q = this.playing()
    const elapsed = game.clock - this.started
    this.frames(w)
    // (Blood's WeaponProcess: the QAV's frames, then the aim, then what the buttons do)
    this.updateAim()
    // (Blood's StartQAV takes its first 4 off the weapon's timer as it starts: a QAV is over a tick before its length)
    const done = !q || elapsed + 4 >= q.duration
    if (p.weapon === 6 && this.bundle(input, q, elapsed, done)) return
    const want = input.newWeapon || p.weapons.want
    switch (this.state) {
      case 'down':
        if (done) { p.weapon = this.next; this.play('up', WEAPONS[p.weapon].up); this.soundsDone = -1 }
        return
      case 'up':
        if (done) { if (p.weapon === 3) this.loaded = Math.min(2, p.ammo[2]); this.play('idle', w.idle) }
        return
      case 'fire': case 'alt':
        if (!done) return
        if (w.repeat && (input.buttons & (this.state === 'alt' ? 8 : 4)) && this.hasAmmo(w)) { this.fire(this.state, this.state === 'alt' ? w.alt[0] : w.fire[0], w); return }
        // (done: on to the buttons in the same frame, as Blood's WeaponProcess once the weapon's timer is out)
        this.play('idle', w.idle)
        break
      case 'reload':
        if (!done) return
        this.loaded = Math.min(2, p.ammo[2])
        this.play('idle', w.idle)
        break
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
    const loaded = p.weapon !== 3 || this.loaded > 0
    if ((input.buttons & 4) && this.hasAmmo(w) && loaded) {
      const qav = w.fire[p.weapon === 3 ? 2 - this.loaded : 0]
      this.fire('fire', qav, w)
    } else if ((input.buttons & 8) && w.alt && this.hasAmmo(w) && loaded) {
      this.fire('alt', w.alt[0], w)
    } else if (!this.hasAmmo(w) && p.weapon !== 1) {
      // Out of ammo: the best weapon there is ammo for
      const best = [4, 3, 5, 2, 6, 7, 1].find((n) => p.weapons[n] && this.hasAmmo(WEAPONS[n]))
      if (best && best !== p.weapon) { this.next = best; this.play('down', w.down) }
    } else if (w.reload && p.weapon === 3 && this.loaded === 0 && this.hasAmmo(w) && this.state === 'idle') {
      // nothing pressed: the sawed-off empty is reloaded (Blood's WeaponUpdateState, at WeaponProcess's end)
      this.play('reload', w.reload)
    }
  }

  /**
   * The TNT bundle (Blood's WeaponProcess for it): fire lights the fuse and the bundle is held (BUNFUSE) until fire
   * is let go; then it is thrown (BUNTHRO), harder the longer it was held (Blood's throwPower: the hold over 240
   * clocks, at most 1), and goes off on what it hits. Held to BUNFUSE's end it goes off in the
   * hand. Alt lights it to be dropped, its fuse burning from the light. Returns whether it dealt with the tick
   */
  bundle (input, q, elapsed, done) {
    const p = this.p, game = this.game, w = WEAPONS[6]
    const callbacks = (fn) => {
      if (!q) return
      const frame = Math.min(q.frames.length - 1, Math.floor(elapsed / q.ticksPerFrame))
      for (let f = this.callbacksDone + 1; f <= frame; f++) if (q.frames[f].callback > 0) fn()
      this.callbacksDone = frame
    }
    const next = () => {
      if (this.hasAmmo(w)) { this.play('up', w.up); this.soundsDone = -1; return }
      const best = [4, 3, 5, 2, 7, 1].find((n) => p.weapons[n] && this.hasAmmo(WEAPONS[n])) || 1
      this.next = best
      p.weapon = best
      this.play('up', WEAPONS[best].up)
      this.soundsDone = -1
    }
    switch (this.state) {
      case 'lit':
        callbacks(() => {
          // Held too long: it goes off where the player is
          game.things.fire(p.sprite, 419, p.zWeapon - p.sprite.z, 0, 0, { fuse: 1 })
          this.use(w, 1)
          this.play('blown', BUNDLE.blown)
        })
        if (this.state !== 'lit') return true
        if (this.timed) {
          if (!(input.buttons & 8)) { this.fuse = q.duration - elapsed; this.play('drop', BUNDLE.drop) }
          return true
        }
        if (!(input.buttons & 4)) {
          this.fuse = q.duration - elapsed
          // Blood's throwPower: the hold over 240 clock ticks (BLOOD000's throw, let go at 16, and BLOOD002's, at
          // 24, fly as the original's to the unit)
          this.power = Math.min(0x10000, divscale(game.clock - this.throwTime, 240, 16))
          this.play('throw', BUNDLE.throw)
          this.soundsDone = -1
        }
        return true
      case 'throw': case 'drop': {
        const thrown = this.state === 'throw'
        callbacks(() => {
          // Thrown, it goes off on whatever it hits (Blood's Impact); dropped, when its fuse is out
          const speed = thrown ? mulscale(this.power, 0x177777, 16) + 0x66666 : 0
          game.things.fire(p.sprite, 419, p.zWeapon - p.sprite.z, thrown ? p.slope() - 9460 : 0, speed, thrown ? { impact: true } : { fuse: Math.max(1, Math.ceil(this.fuse / 4)) })
          this.use(w, 1)
        })
        if (done) next()
        return true
      }
      case 'blown':
        if (done) next()
        return true
      case 'idle':
        // Fire: lit, to be thrown when let go; alt: lit, to be dropped when let go with the fuse burning
        if ((input.buttons & 12) && this.hasAmmo(w)) {
          this.timed = !(input.buttons & 4)
          this.throwTime = game.clock
          this.play('lit', BUNDLE.fuse)
          this.soundsDone = -1
          return true
        }
    }
    return false
  }

  hasAmmo (w) { return w.ammo === undefined || w.ammo < 0 || this.p.ammo[w.ammo] > 0 }

  use (w, n = 1) { if (w.ammo >= 0) this.p.ammo[w.ammo] = Math.max(0, this.p.ammo[w.ammo] - n) }

  /**
   * Blood's SpawnShellEject (0x4abf4) and fxSpawnEjectingShell (0x73578): the eye's height set again; a shell
   * (effect 40-42) from beside the gun, a quarter of the way from the weapon's height to the eye's, thrown aside
   * at the speed asked give or take a quarter, a turn give or take 56, and up
   */
  shellEject (side, speed) {
    const p = this.p, s = p.sprite, game = this.game, R = game.random, trig = game.level.trig
    p.zView = s.z - p.posture_().eyeAboveZ
    const t = p.zWeapon - p.zView
    const z = p.zWeapon - t + (t >> 2)
    let x = s.x + mulscale(s.clipdist - 4, trig.Cos(s.ang), 28), y = s.y + mulscale(s.clipdist - 4, trig.Sin(s.ang), 28)
    x += mulscale(side, trig.Cos((s.ang + 512) & 2047), 30)
    y += mulscale(side, trig.Sin((s.ang + 512) & 2047), 30)
    const f = game.fx.spawn(40 + R.Random(3), s.sectnum, x, y, z, 0)
    if (!f) return
    const v = R.Random2(Math.trunc((Math.trunc(speed / 4) << 18) / 120))
    const ang = (s.ang + R.Random2(56) + 512) & 2047
    const vel = v + Math.trunc((speed << 18) / 120)
    f.xvel = mulscale(vel, trig.Cos(ang), 30)
    f.yvel = mulscale(vel, trig.Sin(ang), 30)
    f.zvel = s.zvel - 0x20000 - Math.trunc((R.Random2(20) << 18) / 120)
  }

  /**
   * Blood's UpdateAimVector (BLOOD.EXE 0x4ae18): with auto-aim the nearest dude (then thing, for the weapons that
   * take things) within the weapon's angle, in sight and at a height the view's slope could reach, by how close it
   * is to the line of sight; its middle (its type's aim height) aimed at, a seeker's target led by its speed. The
   * aim, taken relative to the facing, follows by the weapon's speeds (p.relAim), and is p.aim
   */
  updateAim () {
    const p = this.p, s = p.sprite, game = this.game, level = game.level, trig = level.trig, engine = level.engine
    const im = Math.imul
    const x = s.x, y = s.y, z = p.zWeapon, slope = p.slope()
    let aim = { dx: trig.Cos(s.ang) >> 16, dy: trig.Sin(s.ang) >> 16, dz: slope }
    const track = TRACK[p.weapon] || TRACK[0]
    let target = -1
    p.aimTargets = []
    if (p.autoAim !== false || p.weapon === 9 || p.weapon === 10) {
      let closest = 0x7fffffff
      const consider = (d, range, thing) => {
        if (d === s || d.statnum >= 1024) return
        if (!thing && (d.flags & 32)) return
        if (!(d.flags & 8)) return
        let x2 = d.x, y2 = d.y, z2 = d.z
        const dist = approxDist(x2 - x, y2 - y)
        if (dist === 0 || dist > 51200) return
        if (!thing && track.seeker) {
          const t = divscale(dist, track.seeker, 12)
          x2 += im(d.xvel, t) >> 12
          y2 += im(d.yvel, t) >> 12
          z2 += im(d.zvel, t) >> 8
        }
        const lx = x + mulscale(trig.Cos(s.ang), dist, 30), ly = y + mulscale(trig.Sin(s.ang), dist, 30)
        const lz = z + mulscale(slope, dist, 10), zRange = mulscale(9460, dist, 10)
        const { top, bottom } = level.extents(d)
        if (lz - zRange > bottom || lz + zRange < top) return
        const angle = trig.getangle(x2 - x, y2 - y)
        if (Math.abs(((angle - s.ang + 1024) & 2047) - 1024) > range) return
        if (p.aimTargets.length < 16 && engine.cansee(x, y, z, s.sectnum, x2, y2, z2, d.sectnum)) p.aimTargets.push(d.index)
        const dz = (lz - z2) >> 8, dy = (ly - y2) >> 4, dx = (lx - x2) >> 4
        const dist2 = ksqrt((im(dx, dx) + im(dy, dy) + im(dz, dz)) | 0)
        if (dist2 >= closest) return
        let dzc = z2 - z
        if (!thing) {
          const info = game.res.tables.dudeInfo[d.type] || { aimHeight: 0 }
          dzc = (z2 - ((d.yrepeat * info.aimHeight) << 2)) - z
        }
        if (engine.cansee(x, y, z, s.sectnum, x2, y2, z2, d.sectnum)) {
          closest = dist2
          aim = { dx: trig.Cos(angle) >> 16, dy: trig.Sin(angle) >> 16, dz: divscale(dzc, dist, 10) }
          target = d.index
        }
      }
      // (in the status lists' order: the dudes, the players among them, then the things)
      for (const d of game.dudes.list) consider(d.sprite, track.angleRange, false)
      for (const q of game.players) if (q) consider(q.sprite, track.angleRange, false)
      if (track.thingAngle > 0) for (const t of level.sprites) if (t && t.statnum === STAT.thing) consider(t, track.thingAngle, true)
    }
    const rel = rotateVector(trig, aim.dx, aim.dy, -s.ang)
    const lerp = (a, b, k) => a + mulscale(b - a, k, 16)
    if (!p.relAim) p.relAim = { dx: 0x4000, dy: 0, dz: 0 }
    p.relAim = { dx: lerp(p.relAim.dx, rel.dx, track.aimSpeedHorz), dy: lerp(p.relAim.dy, rel.dy, track.aimSpeedHorz), dz: lerp(p.relAim.dz, aim.dz - slope, track.aimSpeedVert) }
    const back = rotateVector(trig, p.relAim.dx, p.relAim.dy, s.ang)
    p.aim = { dx: back.dx, dy: back.dy, dz: p.relAim.dz + slope }
    p.aimTarget = target
  }

  /** A QAV frame's shot (Blood's Fire* functions) */
  shoot (w, callback, alt) {
    const p = this.p, s = p.sprite, game = this.game, combat = game.combat
    const R = (n) => game.random.Random3(n)
    const { dx, dy, dz } = p.aim || combat.aim(s.ang, p.slope())
    const zw = p.zWeapon - s.z
    switch (p.weapon) {
      case 1: // FireFork: four tines
        for (let i = 0; i < 4; i++) combat.fireVector(s, 0, zw, dx + R(2000), dy + R(2000), dz + R(2000), VECTOR.tine)
        game.sound(s, 1002)
        break
      case 3: { // the sawed-off: one barrel, or both (alt)
        // (Blood's FireShotgun, BLOOD.EXE 0x4cf44: its sound first, 411 for a barrel, 412 for both; sixteen pellets a
        // barrel, each spread by Random3 in x, y (2500) and z (1500))
        const barrels = alt ? Math.max(1, this.loaded) : 1
        const shells = Math.min(barrels, p.ammo[2])
        this.loaded = Math.max(0, this.loaded - shells)
        game.sound(s, shells === 1 ? 411 : 412)
        for (let i = 0; i < shells * 16; i++) {
          const x = dx + R(2500), y = dy + R(2500), z = dz + R(1500)
          // (v1.11 fires vector 4, the table's fifth: 6 of damage, BLOOD.EXE 0x4d036)
          combat.fireVector(s, 0, zw, x, y, z, VECTOR.shellAP)
        }
        this.use(w, shells)
        this.barrel = alt ? 0 : (this.barrel + 1) % 2
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
      case 7: // the spray can: a short flame
        game.missiles.fire(s, 'spray', s.ang, p.slope(), zw)
        this.use(w, 1)
        break
    }
  }

  /** What the client draws: the QAV and how far into it */
  status () { return { qav: this.qav, at: this.game.clock - this.started, state: this.state } }
}
