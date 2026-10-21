// The monsters ("dudes") on the server, as Blood's ai.cpp and its per-kind files: each a state machine of AI states
// (the sequence it shows, a callback on the sequence's trigger frames, a time, a move function each tick, a think
// function every fourth tick, the state after), with Blood's own steering (aiChooseDirection and CanMove) and senses
// (sight by distance, periphery and line of sight; hearing). Their numbers are the original's dudeInfo (BLOOD.EXE).
import { mulscale, dmulscale, divscale, CLIPMASK0, CLIPMASK1 } from '../../common/engine.mjs'
import { moveDude, approxDist } from './physics.mjs'
import { findSector } from './fx.mjs'
import { BloodAI, START as AI_START } from './ai.mjs'
import { STAT, CMD, SPRITE } from './triggers.mjs'
import { DAMAGE, VECTOR } from './combat.mjs'

// The game's one generator (Blood's), set by the Dudes from the game
let R = null
const Chance = (c) => R.Chance(c)
const Random = (n) => R.Random(n)
const Random3 = (n) => R.Random3(n)

// A state: seq (offset from the dude's base), callback (on the seq's trigger frames), ticks (Blood's 120 Hz; 0 forever),
// move ('forward', 'turn', 'dodge', null), think ('target', 'chase', 'search', 'goto', or the kind's own), next
const S = (seq, o = {}) => Object.assign({ seq, callback: null, ticks: 0, move: null, think: null, next: null }, o)

// What each kind does: its states (by name) and its attacks
// Seq offsets as the original shows them (fidelity/dudes.mjs: its zombies lie as ZOMB1I2, +12, and rise by ZOMB1M2, +9)
const KINDS = {
  cultist: {
    states: {
      idle: S(0, { think: 'target' }), chase: S(9, { move: 'forward', think: 'chase' }), dodge: S(9, { ticks: 90, move: 'dodge', next: 'chase' }),
      goto: S(9, { ticks: 600, move: 'forward', think: 'goto', next: 'idle' }), search: S(9, { ticks: 1800, move: 'forward', think: 'search', next: 'idle' }),
      recoil: S(5, { next: 'dodge' }), tfire: S(6, { callback: 'tommy', move: 'turn', think: 'chase', next: 'tfire' }),
      sfire: S(6, { callback: 'shotgun', ticks: 60, next: 'chase' }), throw: S(7, { callback: 'throwTNT', ticks: 120, next: 'chase' }),
      proneIdle: S(17, { think: 'target' }), proneChase: S(14, { move: 'forward', think: 'chase' })
    },
    alert: [4003, 4], search: [4000, 4], attack: { range: 0x4600, angle: 28 }
  },
  zombie: {
    states: {
      idle: S(0, { think: 'target' }), chase: S(8, { move: 'forward', think: 'chase' }), goto: S(8, { ticks: 600, move: 'forward', think: 'goto', next: 'idle' }),
      search: S(8, { ticks: 1800, move: 'forward', think: 'search', next: 'idle' }), recoil: S(5, { next: 'chase' }),
      hack: S(6, { callback: 'axe', ticks: 80, next: 'chase' }), ponder: S(0, { ticks: 120, move: 'turn', think: 'chase', next: 'chase' }),
      buried: S(12, { think: 'target' }), rise: S(9, { ticks: 0, next: 'chase', seqEnd: true }), laying: S(12, { think: 'target' })
    },
    alert: [1100, 2], search: [1100, 2], melee: 0x400
  },
  gargoyle: {
    states: {
      idle: S(0, { think: 'target' }), chase: S(0, { move: 'forward', think: 'chase' }), goto: S(0, { ticks: 600, move: 'forward', think: 'goto', next: 'idle' }),
      search: S(0, { ticks: 1800, move: 'forward', think: 'search', next: 'idle' }), recoil: S(5, { next: 'chase' }),
      slash: S(6, { callback: 'gargSlash', ticks: 120, next: 'chase' })
    },
    alert: [1400, 2], search: [1400, 2], melee: 0x480, flies: true
  },
  statue: { states: { idle: S(5, { think: 'statue' }) }, alert: [0, 0], search: [0, 0] },
  rat: {
    states: { idle: S(0, { think: 'target' }), chase: S(7, { move: 'forward', think: 'chase' }), goto: S(7, { ticks: 600, move: 'forward', think: 'goto', next: 'idle' }), search: S(7, { ticks: 1800, move: 'forward', think: 'search', next: 'idle' }), recoil: S(0, { next: 'chase' }), bite: S(6, { callback: 'ratBite', ticks: 120, next: 'chase' }) },
    alert: [2100, 1], search: [2100, 1], melee: 0x280
  },
  bat: {
    states: { idle: S(0, { think: 'target' }), chase: S(6, { move: 'forward', think: 'chase' }), goto: S(6, { ticks: 600, move: 'forward', think: 'goto', next: 'idle' }), search: S(6, { ticks: 1800, move: 'forward', think: 'search', next: 'idle' }), recoil: S(0, { next: 'chase' }), bite: S(7, { callback: 'batBite', ticks: 60, next: 'chase' }) },
    alert: [2000, 1], search: [2000, 1], melee: 0x200, flies: true
  },
  spider: {
    states: { idle: S(0, { think: 'target' }), chase: S(7, { move: 'forward', think: 'chase' }), goto: S(7, { ticks: 600, move: 'forward', think: 'goto', next: 'idle' }), search: S(7, { ticks: 1800, move: 'forward', think: 'search', next: 'idle' }), recoil: S(0, { next: 'chase' }), bite: S(6, { callback: 'spiderBite', ticks: 60, next: 'chase' }) },
    alert: [1800, 2], search: [1800, 2], melee: 0x300
  },
  hand: {
    states: { idle: S(0, { think: 'target' }), chase: S(6, { move: 'forward', think: 'chase' }), goto: S(6, { ticks: 600, move: 'forward', think: 'goto', next: 'idle' }), search: S(6, { ticks: 1800, move: 'forward', think: 'search', next: 'idle' }), recoil: S(0, { next: 'chase' }), choke: S(6, { callback: 'choke', ticks: 120, next: 'chase' }) },
    alert: [1900, 1], search: [1900, 1], melee: 0x240
  },
  eel: {
    states: { idle: S(0, { think: 'target' }), chase: S(0, { move: 'forward', think: 'chase' }), goto: S(0, { ticks: 600, move: 'forward', think: 'goto', next: 'idle' }), search: S(0, { ticks: 1800, move: 'forward', think: 'search', next: 'idle' }), recoil: S(0, { next: 'chase' }), bite: S(7, { callback: 'eelBite', ticks: 60, next: 'chase' }) },
    alert: [1700, 1], search: [1700, 1], melee: 0x300, flies: true
  }
}

const KIND_OF = { 201: 'cultist', 202: 'cultist', 203: 'zombie', 204: 'zombie', 205: 'zombie', 206: 'gargoyle', 207: 'gargoyle', 208: 'statue', 209: 'statue', 212: 'hand', 213: 'spider', 214: 'spider', 215: 'spider', 216: 'spider', 218: 'eel', 219: 'bat', 220: 'rat', 230: 'cultist', 244: 'zombie', 246: 'cultist', 247: 'cultist', 248: 'cultist', 249: 'cultist' }

class Dude {
  constructor (dudes, sprite) {
    this.dudes = dudes
    this.game = dudes.game
    this.level = dudes.level
    this.sprite = sprite
    this.x = this.level.x(sprite)
    this.info = dudes.tables.dudeInfo[sprite.type]
    this.kind = KINDS[KIND_OF[sprite.type]] || KINDS.cultist
    this.target = -1
    this.targetPos = null
    this.goalAng = sprite.ang
    this.dodgeDir = 0
    this.state = null
    this.stateName = ''
    this.stateTimer = 0
    this.height = 0
    this.slope = 0
    this.gravity = !this.kind.flies
    sprite.flags |= this.kind.flies ? 0 : 2
    this.x.health = this.info.startHealth << 4
    // The types ported from the original's own states and functions (server/game/ai.mjs)
    if (AI_START[sprite.type] !== undefined) { Object.assign(this, BloodAI); this.bloodAI = true; this.initAI(); return }
    const start = sprite.type === 205 || sprite.type === 244 ? 'buried' : sprite.type === 230 || sprite.type === 246 ? 'proneIdle' : 'idle'
    this.setState(start)
  }

  setState (name) {
    const st = this.kind.states[name] || this.kind.states.idle
    this.state = st
    this.stateName = name
    this.stateTimer = st.ticks
    this.dudes.seqs.spawn(this.sprite, this.info.seqStartID + st.seq, st.callback ? (s) => this[st.callback] && this[st.callback]() : null)
    if (st.seqEnd) this.waitSeq = true
  }

  get targetSprite () { return this.target >= 0 ? this.level.sprites[this.target] : null }

  /** Blood's aiProcessDudes for this dude: its state's move and (every fourth frame) think, its state's time, recoil */
  think (frame) {
    if (this.bloodAI) { this.aiProcess(frame); return }
    const s = this.sprite
    if (this.x.health <= 0) { this.cumulDamage = 0; return }
    if (this.stateTimer > 0) this.stateTimer -= 4
    const st = this.state
    if (st.move) this['move_' + st.move]()
    if (st.think && (frame & 3) === (s.index & 3)) this['think_' + st.think]()
    if (st.ticks && this.stateTimer <= 0 && st.next) this.setState(st.next)
    if (this.waitSeq && this.dudes.seqs.playing(s) < 0) { this.waitSeq = false; if (st.next) this.setState(st.next) }
    // Hurt enough this frame (all its damage together, against what it can take): Blood's RecoilDude, a draw first
    if (this.x.health > 0 && this.cumulDamage >= (this.info.hinderDamage << 4)) {
      Chance(0x8000)
      if (this.kind.states.recoil && this.stateName !== 'buried' && this.stateName !== 'rise') this.setState('recoil')
    }
    this.cumulDamage = 0
  }

  /** The dude's move for the frame (Blood's MoveDude, in actProcessSprites' dudes before their minds) */
  move () {
    const s = this.sprite
    if (this.x.health <= 0) return
    // Blood's actProcessSprites moves a dude only when it falls (kPhysFalling: in the air, or a frame of its sequence
    // changed its height) or anything moves it, its own speed or its floor's or ceiling's
    if ((s.flags & 4) || s.xvel || s.yvel || s.zvel || this.level.velFloor[s.sectnum] || this.level.velCeil[s.sectnum]) moveDude(this.level, this)
    if (this.kind.flies) { s.xvel -= mulscale(s.xvel, 0x2000, 16); s.yvel -= mulscale(s.yvel, 0x2000, 16); s.zvel -= mulscale(s.zvel, 0x2000, 16) }
  }

  // --- moving ---
  turn () {
    const s = this.sprite
    const delta = ((this.goalAng + 1024 - s.ang) & 2047) - 1024
    const range = (this.info.angSpeed << 2) >> 4
    s.ang = (s.ang + Math.max(-range, Math.min(range, delta))) & 2047
    return delta
  }

  move_turn () { this.turn() }

  move_forward () {
    const s = this.sprite, trig = this.level.trig
    const delta = this.turn()
    if (Math.abs(delta) > 341) return
    s.xvel += mulscale(this.info.frontSpeed, trig.Cos(s.ang), 30)
    s.yvel += mulscale(this.info.frontSpeed, trig.Sin(s.ang), 30)
    if (this.kind.flies && this.targetSprite) {
      // Flyers keep to the target's height
      const dz = this.targetSprite.z - 0x2000 - s.z
      s.zvel += Math.sign(dz) * Math.min(Math.abs(dz) << 2, 0x8000)
    }
  }

  move_dodge () {
    const s = this.sprite, trig = this.level.trig
    this.turn()
    if (!this.dodgeDir) return
    const sideSpeed = this.info.sideSpeed * this.dodgeDir
    s.xvel += mulscale(sideSpeed, trig.Sin(s.ang), 30)
    s.yvel -= mulscale(sideSpeed, trig.Cos(s.ang), 30)
  }

  /** Blood's CanMove: whether the dude can go `range` along `ang` (nothing in the way, no fall it would not take) */
  /**
   * Blood's CanMove (BLOOD.EXE 0x5b1d8): a probe along `ang`; blocked within `range` (and its size) unless by its
   * target; then where it would be: no sector there fails, and each type's own rule for crushing floors (sector
   * type 618 or an xsector's damage), deep water (an xsector's depth, or a water link above or below), being under
   * water, and a drop of more than 0x2000
   */
  canMove (targetIndex, ang, range) {
    const s = this.sprite, level = this.level, engine = level.engine, trig = level.trig
    const { bottom } = level.extents(s)
    const cstat = s.cstat
    s.cstat &= ~256
    // Blood's HitScan with a range: Build's goal range << 4 along the sprite's own facing (not the probe's): past
    // it nothing is hit, so a dude barely moving finds every way shut (zombie 232 in BLOOD000 at tick 713)
    const goal = range ? { x: s.x + mulscale(range << 4, trig.Cos(s.ang & 2047), 30), y: s.y + mulscale(range << 4, trig.Sin(s.ang & 2047), 30) } : null
    const hit = engine.hitscan(s.x, s.y, s.z, s.sectnum, trig.Cos(ang & 2047) >> 16, trig.Sin(ang & 2047) >> 16, 0, CLIPMASK0, goal)
    s.cstat = cstat
    const dist = approxDist(s.x - hit.x, s.y - hit.y)
    if (dist - (s.clipdist << 2) < range) return hit.sprite >= 0 && hit.sprite === targetIndex
    const x = s.x + mulscale(range, trig.Cos(ang), 30), y = s.y + mulscale(range, trig.Sin(ang), 30)
    const n = findSector(level, x, y, s.z, s.sectnum)
    if (n < 0) return false
    const floorZ = engine.getflorzofslope(n, x, y)
    const xs = level.xs(n)
    const underwater = !!(xs && xs.underwater)
    let depth = !!(xs && xs.depth), water = false
    const crusher = level.sectors[n].lotag === 618 || !!(xs && xs.damageType > 0)
    if (level.upperLink) {
      const up = level.upperLink[n], low = level.lowerLink[n]
      if (up >= 0 && (level.sprites[up].type === 9 || level.sprites[up].type === 13)) water = depth = true
      if (low >= 0 && (level.sprites[low].type === 10 || level.sprites[low].type === 14)) depth = true
    }
    const drop = floorZ - bottom <= 0x2000
    switch (s.type) {
      case 206: case 207: case 219: // gargoyles and bats: room for their size, and no deep water
        if (s.clipdist > dist) return false
        return !depth
      case 218: // the bone eel: in water, not at its surface
        return !water && underwater
      case 204: case 211: case 213: case 214: case 215: case 216: case 220: case 227: case 245:
        if (crusher || depth || underwater) return false
        return drop
      default:
        if (crusher) return false
        if (underwater || (xs && xs.depth)) return true
        return drop
    }
  }

  /** Blood's aiChooseDirection */
  chooseDirection (ang) {
    const s = this.sprite, trig = this.level.trig
    const vc = ((ang + 1024 - s.ang) & 2047) - 1024
    const t1 = dmulscale(s.xvel, trig.Cos(s.ang), s.yvel, trig.Sin(s.ang), 30)
    const vsi = Math.trunc(((t1 * 15) >> 12) / 2)
    const v8 = vc < 0 ? -341 : 341
    const t = this.target
    if (this.canMove(t, s.ang + vc, vsi)) this.goalAng = s.ang + vc
    else if (this.canMove(t, s.ang + Math.trunc(vc / 2), vsi)) this.goalAng = s.ang + Math.trunc(vc / 2)
    else if (this.canMove(t, s.ang - Math.trunc(vc / 2), vsi)) this.goalAng = s.ang - Math.trunc(vc / 2)
    else if (this.canMove(t, s.ang + v8, vsi)) this.goalAng = s.ang + v8
    else if (this.canMove(t, s.ang, vsi)) this.goalAng = s.ang
    else if (this.canMove(t, s.ang - v8, vsi)) this.goalAng = s.ang - v8
    else this.goalAng = s.ang + 341
    this.goalAng &= 2047
    this.dodgeDir = Chance(0x8000) ? 1 : -1
    if (!this.canMove(t, s.ang + this.dodgeDir * 512, 512)) {
      this.dodgeDir = -this.dodgeDir
      if (!this.canMove(t, s.ang + this.dodgeDir * 512, 512)) this.dodgeDir = 0
    }
  }

  // --- senses ---
  eyeZ () { return this.sprite.z - ((this.info.eyeHeight * this.sprite.yrepeat) << 2) }

  sees (t) {
    const s = this.sprite
    return this.level.engine.cansee(t.x, t.y, t.z, t.sectnum, s.x, s.y, this.eyeZ(), s.sectnum)
  }

  /** Blood's aiThinkTarget: a player seen within the dude's sight and periphery, or heard */
  think_target () {
    if (!Chance(this.info.alertChance)) return
    const s = this.sprite, trig = this.level.trig
    for (const p of this.game.players) {
      if (!p || p.health <= 0 || p.powerups[113]) continue
      const t = p.sprite
      const dx = t.x - s.x, dy = t.y - s.y
      const dist = approxDist(dx, dy)
      if (dist > this.info.seeDist && dist > this.info.hearDist) continue
      if (!this.sees(t)) continue
      const delta = ((trig.getangle(dx, dy) + 1024 - s.ang) & 2047) - 1024
      if (dist < this.info.seeDist && Math.abs(delta) <= this.info.periphery) { this.target = t.index; this.activate(); return }
      if (dist < this.info.hearDist) { this.target = -1; this.targetPos = { x: t.x, y: t.y, z: t.z }; this.activate(); return }
    }
  }

  /** Blood's aiActivateDude: alerted, it says so and goes after what it saw or heard */
  /**
   * Blood's aiActivateDude: woken for the first time (its xsprite's state off), it picks a way toward its target
   * (aiChooseDirection, a draw); then each type's own cry (a draw or two, as aiActivateDude's), and the hunt
   */
  activate () {
    const s = this.sprite, x = this.x, trig = this.level.trig
    const t = this.target >= 0 ? this.level.sprites[this.target] : null
    const pos = t || this.targetPos || s
    if (!x.state) { this.chooseDirection(trig.getangle(pos.x - s.x, pos.y - s.y)); x.state = 1 }
    if (this.stateName === 'buried' || this.stateName === 'laying') { this.setState('rise'); return }
    const hunting = this.target >= 0
    const cry = (id) => this.game.sound(s, id)
    switch (s.type) {
      case 201: case 202: case 246: case 247: case 248: case 249: case 230: { // cultists
        const tommy = s.type === 201 || s.type === 230
        if (!hunting) { if (Chance(0x8000)) cry((tommy ? 4008 : 1008) + Random(5)) } else if (Chance(0x8000)) cry((tommy ? 4003 : 1003) + Random(4))
        break
      }
      case 203: // the axe zombie
        if (hunting && Chance(0xa000)) cry([1103, 1104, 1105][Random(3)] || 1103)
        break
      case 204: if (hunting && Chance(0x4000)) cry(1201); break // the butcher
      case 206: case 207: if (hunting) cry(Chance(0x4000) ? 1401 : 1400); break // gargoyles
      case 218: if (hunting) cry(Chance(0x8000) ? 1501 : 1500); break // the bone eel
      case 219: if (hunting && Chance(0xa000)) cry(2000); break // the bat
      case 212: if (hunting) cry(1900); break // the hand
      case 220: if (hunting) cry(2100); break // the rat
      case 213: case 214: case 215: case 216: if (hunting) cry(1800); break // spiders
    }
    if (this.stateName === 'proneIdle') { this.setState('proneChase'); return }
    this.setState(hunting ? 'chase' : 'goto')
  }

  think_buried () {
    // A buried zombie rises when a player comes near (Blood: within its hearing)
    const s = this.sprite
    for (const p of this.game.players) {
      if (!p || p.health <= 0) continue
      if (approxDist(p.sprite.x - s.x, p.sprite.y - s.y) < 0x1000 && this.sees(p.sprite)) { this.target = p.sprite.index; this.activate(); return }
    }
  }

  think_statue () {}

  think_goto () {
    const s = this.sprite, trig = this.level.trig
    const pos = this.targetPos || { x: s.x, y: s.y }
    const dx = pos.x - s.x, dy = pos.y - s.y
    this.chooseDirection(trig.getangle(dx, dy))
    if (approxDist(dx, dy) < 512) this.setState('search')
    this.think_target()
  }

  think_search () {
    this.chooseDirection(this.goalAng)
    this.think_target()
  }

  /** Blood's think chase: after the target; within reach and facing it, an attack */
  think_chase () {
    const s = this.sprite, level = this.level, trig = level.trig
    const t = this.targetSprite
    if (!t || t.statnum >= 1024) { this.target = -1; this.setState('goto'); return }
    const tp = this.game.playerOf(t)
    const dx = t.x - s.x, dy = t.y - s.y
    this.chooseDirection(trig.getangle(dx, dy))
    if ((tp && tp.health <= 0) || (!tp && level.x(t) && level.x(t).health <= 0)) {
      const [base, n] = this.kind.search
      if (base) this.game.sound(s, base + Random(n))
      this.target = -1
      this.setState('search')
      return
    }
    const dist = approxDist(dx, dy)
    if (dist > 0 && dist <= this.info.seeDist) {
      const delta = ((trig.getangle(dx, dy) + 1024 - s.ang) & 2047) - 1024
      if (this.sees(t) && Math.abs(delta) <= this.info.periphery) {
        this.slope = divscale(t.z - s.z, dist, 10)
        this.attack(t, dist, delta)
        return
      }
    }
    this.targetPos = { x: t.x, y: t.y, z: t.z }
    this.setState('goto')
  }

  attack (t, dist, delta) {
    const type = this.sprite.type
    if (this.kind === KINDS.cultist) {
      const shotgun = type === 202 || type === 246
      if (dist < (shotgun ? 0x3200 : 0x4600) && Math.abs(delta) < 28 && this.clearShot(t)) this.setState(shotgun ? 'sfire' : 'tfire')
      return
    }
    const melee = this.kind.melee || 0x400
    if (dist < melee && Math.abs(delta) < 85) {
      const attack = { zombie: 'hack', gargoyle: 'slash', rat: 'bite', bat: 'bite', spider: 'bite', hand: 'choke', eel: 'bite' }[KIND_OF[type]]
      if (attack) this.setState(attack)
    }
  }

  /** Whether a shot along the dude's facing would reach the target (not a fellow cultist) */
  clearShot (t) {
    const s = this.sprite, trig = this.level.trig
    const cstat = s.cstat
    s.cstat &= ~256
    const hit = this.level.engine.hitscan(s.x, s.y, s.z, s.sectnum, trig.Cos(s.ang) >> 16, trig.Sin(s.ang) >> 16, 0, CLIPMASK1)
    s.cstat = cstat
    if (hit.sprite < 0) return hit.wall < 0 || approxDist(hit.x - s.x, hit.y - s.y) > approxDist(t.x - s.x, t.y - s.y)
    const h = this.level.sprites[hit.sprite]
    return !(h.type === 201 || h.type === 202)
  }

  // --- attacks (the sequences' trigger frames) ---
  aimVector (spread) {
    const s = this.sprite, trig = this.level.trig
    const d = this.game.options.difficulty
    return { dx: (trig.Cos(s.ang) >> 16) + Random3(spread * (5 - d)), dy: (trig.Sin(s.ang) >> 16) + Random3(spread * (5 - d)), dz: this.slope + Random3(500) }
  }

  tommy () {
    const v = this.aimVector(1000)
    this.game.combat.fireVector(this.sprite, 0, 0, v.dx, v.dy, v.dz, VECTOR.bullet)
    this.game.sound(this.sprite, 4001)
  }

  shotgun () {
    for (let i = 0; i < 8; i++) { const v = this.aimVector(1000); this.game.combat.fireVector(this.sprite, 0, 0, v.dx, v.dy, v.dz, VECTOR.shell) }
    this.game.sound(this.sprite, 1002)
  }

  throwTNT () { this.game.missiles.throwTNT(this.sprite, 0x80000, this.slope, 0) }

  melee (vector, sound) {
    const s = this.sprite, trig = this.level.trig
    this.game.combat.fireVector(s, 0, 0, trig.Cos(s.ang) >> 16, trig.Sin(s.ang) >> 16, this.slope, vector)
    if (sound) this.game.sound(s, sound)
  }

  axe () { this.melee(VECTOR.axe, 1101) }
  gargSlash () { this.melee(VECTOR.gargSlash, 1406) }
  ratBite () { this.melee(VECTOR.ratBite, 2101) }
  batBite () { this.melee(VECTOR.batBite, 2001) }
  spiderBite () { this.melee(VECTOR.spiderBite, 1802) }
  eelBite () { this.melee(VECTOR.eelBite, 1701) }
  choke () { this.melee(VECTOR.ratBite, 1902) }

  // --- hurt and killed ---
  /** Blood's MoveDude, landing: the fall's damage past 100 << 4 of the force squared */
  onLand (force) {
    const damage = Math.floor(force * force / 2 ** 30) - (100 << 4)
    if (damage > 0) this.game.combat.damage(this.sprite, this.sprite, 0, damage)
  }

  damaged (source, kind, damage) {
    const s = this.sprite, x = this.x
    x.health = Math.max(0, x.health - damage)
    // (Blood's actDamageSprite: a blast that kills with less than 10 << 4 kills as a fall does: no gibs)
    if (x.health <= 0) { this.die(source, kind === DAMAGE.explode && damage < (10 << 4) ? DAMAGE.fall : kind, damage); return damage }
    // A new target: the one that hurt it (Blood's aiDamageSprite)
    // (a roll only for another than its target: damage by its type's change-target chance, its kin's for its kind)
    if (this.bloodAI) { if (source && source.statnum === STAT.dude) this.aiDamaged(source, damage); this.cumulDamage = (this.cumulDamage || 0) + damage; return damage }
    if (source && source.statnum === STAT.dude && source !== s && (this.target < 0 || (source.index !== this.target && Chance(damage * (source.type === s.type ? this.info.changeTargetKinChance : this.info.changeTargetChance))))) { this.target = source.index; if (this.stateName === 'idle' || this.stateName === 'search' || this.stateName === 'goto') this.activate() }
    if (this.stateName === 'buried' || this.stateName === 'laying') { this.setState('rise'); return damage }
    // Recoil comes in the frame's minds, from all of the frame's damage (Blood's cumulDamage)
    this.cumulDamage = (this.cumulDamage || 0) + damage
    return damage
  }

  /**
   * Blood's actKillDude (BLOOD.EXE 0x2af..): its trigger (off), what it carried (its key, its drop), a cultist's gun
   * on a roll; the death's sequence by the damage (+1, blown up +2, burnt +3, the spirit's 14 or 11) and each type's
   * own: a cultist's cry, the axe zombie's (and on a chance its head off, spurting); a blast's gibs and blood; then
   * a body, a thing (426)
   */
  die (source, kind, damage) {
    const s = this.sprite, level = this.level, game = this.game, R = game.random, x = this.x, info = this.info
    if (s.type !== 249) game.triggers.triggerSprite(s.index, CMD.off)
    s.flags |= 7
    if (x.key) game.drop(s, 99 + x.key)
    if (x.dropMsg) game.drop(s, x.dropMsg)
    if (s.type === 201) { const r = R.Random(100); if (r < 10) game.drop(s, 42); else if (r < 50) game.drop(s, 69) }
    else if (s.type === 202) { const r = R.Random(100); if (r <= 10) game.drop(s, 41); else if (r <= 50) game.drop(s, 67) }
    let nSeq = 1
    if (kind === DAMAGE.explode) {
      nSeq = 2
      if ([201, 202, 230, 239, 240, 245, 246, 247, 248, 249, 250, 252].includes(s.type)) game.sound(s, 717)
    } else if (kind === DAMAGE.burn) { game.sound(s, 351); nSeq = 3 } else if (kind === DAMAGE.spirit) nSeq = s.type === 204 ? 11 : s.type === 203 || s.type === 205 ? 14 : 1
    const lib = this.dudes.library, seqs = this.dudes.seqs, base = info.seqStartID
    // The death sequence's callback (Blood's DudeToGibCallback1, or 2 for a burnt death, BLOOD.EXE 0x38528): at its
    // trigger frame the body becomes a gib object, unlocked, of the body's own little health (30): a hard landing
    // breaks it (BLOOD000's body 232 at tick 820)
    const toGib = (data1) => () => game.things.bodyToGib(s, data1)
    const play = (n, cb = toGib(8)) => { if (lib.get(base + n)) seqs.spawn(s, base + n, cb) }
    if (!lib.get(base + nSeq)) play(1)
    else if (s.type === 201 || s.type === 202 || s.type === 247 || s.type === 248) {
      game.sound(s, 1018 + R.Random(2))
      play(nSeq, nSeq === 3 ? toGib(3) : toGib(8))
    } else if (s.type === 203) {
      game.sound(s, 1107 + R.Random(2))
      const head = (vz) => {
        const { top } = level.extents(s)
        game.fx.gibSprite(s, 27, { x: s.x, y: s.y, z: top }, { x: s.xvel >> 1, y: s.yvel >> 1, z: vz })
      }
      if (nSeq === 2) { play(2); head(-0xccccc) }
      else if (nSeq === 1 && R.Chance(0x4000)) {
        play(7)
        game.triggers.post(s.index, SPRITE, 0, CMD.callback, () => game.fx.zombieSpurt(s))
        game.sound(s, 362)
        x.data1 = 35; x.data2 = 5
        head(-0x111111)
      } else if (nSeq === 14) play(14, null)
      else if (nSeq === 3) play(13, toGib(3))
      else play(nSeq)
    } else {
      // (the other types' deaths have no callback in Blood's table: their bodies stay whole)
      play(nSeq, null)
      if (kind !== DAMAGE.explode) game.sound(s, ({ zombie: 1105, gargoyle: 1405, rat: 2102, bat: 2002, spider: 1803, hand: 1903, eel: 1703 }[KIND_OF[s.type]] || 1018))
    }
    // Blown apart: its gib types' pieces fly (GibSprite), and four spurts of blood
    if (kind === DAMAGE.explode) {
      for (const g of info.gibType) if (g >= 0) game.fx.gibSprite(s, g)
      for (let i = 0; i < 4; i++) game.fx.spawnBlood(s)
    }
    this.dudeType = s.type
    s.type = 426
    // (its status is posted, Blood's actPostSprite: the frame's lists of things, the explosions' among them, see it
    // from the next frame)
    this.game.postSprite(() => {
      if (s.statnum !== STAT.dude || s.type !== 426) return
      s.statnum = STAT.thing
      s.flags |= 2
      this.game.things.body(s)
      level.touched()
    })
    this.game.kills++
    if (source && this.game.playerOf(source)) this.game.playerOf(source).kills++
    this.dudes.remove(this)
  }
}

export default class Dudes {
  constructor (game) {
    this.game = game
    this.level = game.level
    this.tables = game.res.tables
    this.seqs = game.seqs
    this.library = game.res.seqs
    this.list = []
    this.bySprite = new Map()
    R = game.random
    for (const s of this.level.sprites) {
      if (s.statnum !== STAT.dude || s.type < 201 || (s.type >= 231 && s.type <= 238) || !this.level.x(s)) continue
      if (!this.tables.dudeInfo[s.type]) continue
      // Blood's actInit: a dude's size is its type's (the map's clipdist is not kept)
      s.clipdist = this.tables.dudeInfo[s.type].clipdist
      this.add(s)
    }
    this.total = this.list.length
  }

  add (s) {
    const d = new Dude(this, s)
    this.list.push(d)
    this.bySprite.set(s, d)
    return d
  }

  remove (d) {
    this.list = this.list.filter((e) => e !== d)
    this.bySprite.delete(d.sprite)
  }

  of (s) { return this.bySprite.get(s) || null }

  move () { for (const d of this.list.slice()) d.move() }
  think () { R = this.game.random; for (const d of this.list.slice()) d.think(this.game.frame) }
}
