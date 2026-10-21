// The monsters ("dudes") on the server, as Blood's ai.cpp and its per-kind files: each a state machine of AI states
// (the sequence it shows, a callback on the sequence's trigger frames, a time, a move function each tick, a think
// function every fourth tick, the state after), with Blood's own steering (aiChooseDirection and CanMove) and senses
// (sight by distance, periphery and line of sight; hearing). Their numbers are the original's dudeInfo (BLOOD.EXE).
import { mulscale, dmulscale, divscale, CLIPMASK0, CLIPMASK1 } from '../../common/engine.mjs'
import { moveDude, approxDist } from './physics.mjs'
import { STAT, CMD } from './triggers.mjs'
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
      buried: S(11, { think: 'target' }), rise: S(11, { ticks: 0, next: 'chase', seqEnd: true }), laying: S(13, { think: 'target' })
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

  tick (frame) {
    const s = this.sprite
    if (this.x.health <= 0) return
    if (this.stateTimer > 0) this.stateTimer -= 4
    const st = this.state
    if (st.move) this['move_' + st.move]()
    if (st.think && (frame & 3) === (s.index & 3)) this['think_' + st.think]()
    if (st.ticks && this.stateTimer <= 0 && st.next) this.setState(st.next)
    if (this.waitSeq && this.dudes.seqs.playing(s) < 0) { this.waitSeq = false; if (st.next) this.setState(st.next) }
    if (s.xvel || s.yvel || s.zvel || !this.kind.flies) moveDude(this.level, this)
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
  canMove (targetIndex, ang, range) {
    const s = this.sprite, level = this.level, engine = level.engine, trig = level.trig
    const { bottom } = level.extents(s)
    const cstat = s.cstat
    s.cstat &= ~257
    const hit = engine.hitscan(s.x, s.y, s.z, s.sectnum, trig.Cos(ang) >> 16, trig.Sin(ang) >> 16, 0, CLIPMASK0)
    s.cstat = cstat
    const dist = approxDist(s.x - hit.x, s.y - hit.y)
    if (dist - (s.clipdist << 2) < range) return hit.sprite >= 0 && hit.sprite === targetIndex
    const x = s.x + mulscale(range, trig.Cos(ang), 30), y = s.y + mulscale(range, trig.Sin(ang), 30)
    const n = engine.updatesectorz(x, y, s.z, s.sectnum)
    if (n < 0) return false
    if (this.kind.flies) return true
    const fz = engine.getflorzofslope(n, x, y)
    const xs = level.xs(n)
    if (xs && (xs.underwater || xs.damageType)) return false
    if (fz - bottom > 0x2000) return false
    return true
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
    else if (this.canMove(t, s.ang + (vc >> 1), vsi)) this.goalAng = s.ang + (vc >> 1)
    else if (this.canMove(t, s.ang - (vc >> 1), vsi)) this.goalAng = s.ang - (vc >> 1)
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
  activate () {
    const [base, n] = this.kind.alert
    if (base && Chance(0x8000)) this.game.sound(this.sprite, base + Random(n))
    if (this.stateName === 'buried' || this.stateName === 'laying') { this.setState('rise'); return }
    if (this.stateName === 'proneIdle') { this.setState('proneChase'); return }
    this.setState(this.target >= 0 ? 'chase' : 'goto')
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

  throwTNT () { this.game.missiles.throwTNT(this.sprite, 0x60000, this.slope, 0) }

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
  damaged (source, kind, damage) {
    const s = this.sprite, x = this.x
    x.health = Math.max(0, x.health - damage)
    if (x.health <= 0) { this.die(source, kind, damage); return damage }
    // A new target: the one that hurt it (Blood's aiDamageSprite)
    if (source && source.statnum === STAT.dude && source !== s && (this.target < 0 || Chance(0x4000))) { this.target = source.index; if (this.stateName === 'idle' || this.stateName === 'search' || this.stateName === 'goto') this.activate() }
    if (this.stateName === 'buried' || this.stateName === 'laying') { this.setState('rise'); return damage }
    // Recoil, by how hard it was hit against what it can take
    if (damage >= (this.info.hinderDamage << 4) && Chance(0x8000) && this.kind.states.recoil) this.setState('recoil')
    return damage
  }

  die (source, kind, damage) {
    const s = this.sprite, level = this.level
    const seq = kind === DAMAGE.explode && damage > 0x500 ? 2 : kind === DAMAGE.burn ? 3 : 1
    const id = this.dudes.library.get(this.info.seqStartID + seq) ? this.info.seqStartID + seq : this.info.seqStartID + 1
    this.dudes.seqs.spawn(s, id)
    s.cstat &= ~257
    s.statnum = STAT.thing
    s.xvel = s.yvel = 0
    level.touched()
    this.game.sound(s, kind === DAMAGE.explode ? 717 : ({ cultist: 1018, zombie: 1105, gargoyle: 1405, rat: 2102, bat: 2002, spider: 1803, hand: 1903, eel: 1703 }[KIND_OF[s.type]] || 1018))
    // What it carried
    if (this.x.dropMsg) this.game.drop(s, this.x.dropMsg)
    // Its own trigger: a dude's death sends its command (Blood's actKillDude: trTriggerSprite with off)
    this.game.triggers.triggerSprite(s.index, CMD.off)
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

  tick () { R = this.game.random; for (const d of this.list.slice()) d.tick(this.game.frame) }
}
