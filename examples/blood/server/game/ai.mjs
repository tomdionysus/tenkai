// Blood's AI as the original runs it: the states are BLOOD.EXE's own (AISTATE: a sequence, a callback, ticks, enter,
// move and think functions, the next state; formats/exe.mjs reads them), and each function they name is ported here
// from its disassembly (tools/disasm.mjs), keyed by its address. A dude whose type has its functions here runs by
// these; aiNewState, aiProcessDudes' step, aiActivateDude, aiSetTarget, RecoilDude as Blood's.
import { mulscale } from '../../common/engine.mjs'
import { approxDist } from './physics.mjs'

const getangle = (dude, dx, dy) => dude.level.trig.getangle(dx, dy)

/** The functions the states name, by address (enter, move and think functions take the dude) */
export const FN = {
  // --- generic (ai.cpp) ---
  0x5dcb0: (d) => d.aiThinkTarget(), // aiThinkTarget: a chance to notice a player, by sight or by hearing
  0x5de9c: (d) => d.aiLookForTarget(), // aiLookForTarget: the same, for the searching states
  0x5ba80: (d) => d.aiMoveForward(), // aiMoveForward
  0x5bb84: (d) => d.aiMoveTurn(), // aiMoveTurn
  // --- the axe zombie (the buried one, the laying one) ---
  0x721f8: (d) => { d.target = -1 }, // entryAIdle
  0x721e8: (d) => { d.changeType(203); d.sprite.flags |= 1 }, // entryEZombie: risen, an axe zombie
  0x72200: (d) => { // entryEStand: its groan, and it faces where it heard
    d.game.sound(d.sprite, 1100)
    d.sprite.ang = getangle(d, d.tx - d.sprite.x, d.ty - d.sprite.y) & 2047
  },
  0x71998: (d) => { d.aiChooseDirection(d.goalAng); d.aiLookForTarget() }, // zombThinkSearch
  0x719bc: (d) => d.zombThinkGoto(),
  0x71aa0: (d) => d.zombThinkChase(false),
  0x71d44: (d) => d.zombThinkChase(true), // zombThinkPonder: the chase's test, from a stand
  0x71fe0: (d) => d.myThinkTarget(), // the laying zombie's: no chance about it
  0x721c4: (d) => { d.aiChooseDirection(d.goalAng); d.myThinkTarget() } // myThinkSearch
}

/** The zombie's states by name (offsets of BLOOD.EXE's AISTATEs, tools/aistates.mjs) */
export const ZOMBIE = {
  idle: 0x1a944, chase: 0x1a960, ponder: 0x1a97c, goto: 0x1a998, hack: 0x1a9b4, search: 0x1a9d0, recoil: 0x1a9ec,
  teslaRecoil: 0x1aa08, fall: 0x1aa24, standUp: 0x1aa40, buried: 0x1aa5c, rise2: 0x1aa78, rise: 0x1aa94,
  layingIdle: 0x1aab0, layingSearch: 0x1aacc, laying: 0x1aae8
}

/** The sequence callbacks of states (Blood registers them at start; matched here by the state that plays them) */
export const CALLBACK = {
  [ZOMBIE.hack]: (d) => d.zombieHack(),
  [ZOMBIE.standUp]: (d) => d.game.sound(d.sprite, 1102)
}

/** Each type's first state (Blood's aiInitSprite) */
export const START = { 203: ZOMBIE.idle, 205: ZOMBIE.buried, 244: ZOMBIE.laying }

/** Mixed into a dude whose type runs by the exe's states */
export const BloodAI = {
  initAI () {
    this.states = this.game.res.tables.aiStates
    this.tx = 0; this.ty = 0; this.tz = 0
    this.target = -1
    this.aiNewState(START[this.sprite.type])
    this.stateTimer = 0
    this.sprite.flags = 15
  },

  /** Blood's aiNewState */
  aiNewState (at) {
    const st = this.states.get(at)
    this.aiState = at
    this.state = st
    this.stateName = Object.keys(ZOMBIE).find((k) => ZOMBIE[k] === at) || at.toString(16)
    this.stateTimer = st.ticks
    if (st.seq >= 0) {
      const cb = CALLBACK[at]
      this.dudes.seqs.spawn(this.sprite, this.info.seqStartID + st.seq, cb ? () => cb(this) : null)
    }
    if (st.enter && FN[st.enter]) FN[st.enter](this)
  },

  /** A type change (entryEZombie): its dudeInfo is the new type's from now on */
  changeType (type) {
    this.sprite.type = type
    this.info = this.dudes.tables.dudeInfo[type]
  },

  /** Blood's aiProcessDudes for this dude */
  aiProcess (frame) {
    const s = this.sprite
    if (this.x.health <= 0) { this.cumulDamage = 0; return }
    this.stateTimer = Math.max(this.stateTimer - 4, 0)
    let st = this.state
    if (st.move && FN[st.move]) FN[st.move](this)
    st = this.state
    if (st.think && FN[st.think] && (frame & 3) === (s.index & 3)) FN[st.think](this)
    st = this.state
    if (this.stateTimer === 0 && st.next) {
      if (st.ticks > 0) this.aiNewState(st.next)
      else if (this.dudes.seqs.playing(s) < 0) this.aiNewState(st.next)
    }
    if (this.x.health > 0 && this.cumulDamage >= (this.info.hinderDamage << 4)) {
      this.data3 = this.cumulDamage
      this.recoilDude()
    }
    this.cumulDamage = 0
  },

  /** Blood's RecoilDude (0x5d4f8), the zombies' case */
  recoilDude () {
    this.game.random.Chance(0x8000)
    if (this.sprite.statnum !== 6) return
    const third = Math.trunc(this.info.startHealth / 3)
    this.game.sound(this.sprite, 1106)
    if (this.teslaRecoil && this.data3 > third) this.aiNewState(ZOMBIE.teslaRecoil)
    else if (this.data3 > third) this.aiNewState(ZOMBIE.fall)
    else this.aiNewState(ZOMBIE.recoil)
    this.teslaRecoil = false
  },

  /** Blood's aiSetTarget, at a sprite (a dude: its eyes) or a place */
  aiSetTargetSprite (index) {
    const t = this.level.sprites[index]
    if (!t || t.type < 200 || t.type >= 256) return
    const ti = this.dudes.tables.dudeInfo[t.type]
    this.target = index
    this.tx = t.x; this.ty = t.y
    this.tz = t.z - (((ti ? ti.eyeHeight : 0) * t.yrepeat) << 2)
  },
  aiSetTargetPlace (x, y, z) { this.target = -1; this.tx = x; this.ty = y; this.tz = z },

  /** Blood's aiActivateDude (0x5be9c), the zombies' cases */
  aiActivateDude () {
    const s = this.sprite, R = this.game.random
    if (!this.x.state) { this.aiChooseDirection(getangle(this, this.tx - s.x, this.ty - s.y)); this.x.state = 1 }
    switch (s.type) {
      case 203:
        if (this.target === -1) { this.aiNewState(ZOMBIE.search); return }
        if (R.Chance(0xa000)) this.game.sound(s, [1103, 1104, 1105][R.Random(3)] || 1103)
        this.aiNewState(ZOMBIE.chase)
        return
      case 205: if (this.aiState === ZOMBIE.buried) this.aiNewState(ZOMBIE.rise); return
      case 244: if (this.aiState === ZOMBIE.laying) this.aiNewState(0x1ab04); return
    }
  },

  /** The players this dude could notice: Blood's loop over them, skipping its owner, the dead and the cloaked */
  players () {
    return this.game.players.filter((p) => p && p.health > 0 && !(p.powerups && p.powerups[13]))
  },

  /** Blood's aiThinkTarget (0x5dcb0), and aiLookForTarget (0x5de9c) for the searching: the same, by a chance */
  aiThinkTarget () { if (this.game.random.Chance(this.info.alertChance)) this.noticePlayers() },
  aiLookForTarget () { if (this.game.random.Chance(this.info.alertChance)) this.noticePlayers() },

  /** The laying zombie's (myThinkTarget, 0x71fe0): the same look, always */
  myThinkTarget () { this.noticePlayers() },

  /** Seen in its sight and view: hunted; else heard: gone to; then woken (aiActivateDude) */
  noticePlayers () {
    const s = this.sprite, info = this.info, engine = this.level.engine
    for (const p of this.players()) {
      const t = p.sprite
      const dx = t.x - s.x, dy = t.y - s.y
      const dist = approxDist(dx, dy)
      if (dist > info.seeDist && dist > info.hearDist) continue
      const eye = s.z - ((info.eyeHeight * s.yrepeat) << 2)
      if (!engine.cansee(t.x, t.y, t.z, t.sectnum, s.x, s.y, eye, s.sectnum)) continue
      const delta = ((getangle(this, dx, dy) + 1024 - s.ang) & 2047) - 1024
      if (dist < info.seeDist && Math.abs(delta) <= info.periphery) this.aiSetTargetSprite(t.index)
      else if (dist < info.hearDist) this.aiSetTargetPlace(t.x, t.y, t.z)
      else continue
      this.aiActivateDude()
      return
    }
  },

  /** Blood's aiMoveForward (0x5ba80): turn toward the goal, and on within 341 of it */
  aiMoveForward () {
    const s = this.sprite, trig = this.level.trig
    const range = (this.info.angSpeed << 2) >> 4
    const delta = ((this.goalAng + 1024 - s.ang) & 2047) - 1024
    s.ang = (s.ang + Math.max(-range, Math.min(range, delta))) & 2047
    if (Math.abs(delta) > 341) return
    s.xvel += mulscale(this.info.frontSpeed, trig.Cos(s.ang), 30)
    s.yvel += mulscale(this.info.frontSpeed, trig.Sin(s.ang), 30)
  },

  /** Blood's aiMoveTurn (0x5bb84) */
  aiMoveTurn () {
    const s = this.sprite
    const range = (this.info.angSpeed << 2) >> 4
    const delta = ((this.goalAng + 1024 - s.ang) & 2047) - 1024
    s.ang = (s.ang + Math.max(-range, Math.min(range, delta))) & 2047
  },

  aiChooseDirection (ang) { this.chooseDirection(ang) },

  /** Woken from outside (a channel's on): as Blood's OperateSprite, aiActivateDude */
  activate () { this.aiActivateDude() },

  /**
   * Blood's aiDamageSprite, the target's part: hurt by another (not itself), a dude with no target, or one hurt by
   * another than its target on a chance of the damage times its type's (or kin's) change-target chance, takes the
   * attacker for its target and is woken
   */
  aiDamaged (source, damage) {
    const s = this.sprite
    if (!source || source === s) return
    if (this.target === -1 || (source.index !== this.target && this.game.random.Chance(damage * (source.type === s.type ? this.info.changeTargetKinChance : this.info.changeTargetChance)))) {
      this.aiSetTargetSprite(source.index)
      this.aiActivateDude()
    }
  },

  /** The zombie's HackSeqCallback (0x71800...): its axe at where its target is, from its eyes to the target's */
  zombieHack () {
    const s = this.sprite, t = this.level.sprites[this.target], trig = this.level.trig
    if (!t || this.target < 0) return
    const ti = this.dudes.tables.dudeInfo[t.type] || { eyeHeight: 0 }
    const ang = getangle(this, this.tx - s.x, this.ty - s.y)
    const dz = ((s.yrepeat * this.info.eyeHeight) << 2) - ((t.yrepeat * ti.eyeHeight) << 2)
    this.game.sound(s, 1101)
    this.game.combat.fireVector(s, 0, 0, trig.Cos(ang) >> 16, trig.Sin(ang) >> 16, dz, 10)
  },

  /** zombThinkGoto (0x719bc): toward the place; there and facing it, search; and look */
  zombThinkGoto () {
    const s = this.sprite
    const dx = this.tx - s.x, dy = this.ty - s.y
    const ang = getangle(this, dx, dy)
    const dist = approxDist(dx, dy)
    this.aiChooseDirection(ang)
    if (dist < 921 && Math.abs(s.ang - ang) < this.info.periphery) this.aiNewState(ZOMBIE.search)
    this.aiThinkTarget()
  },

  /**
   * zombThinkChase (0x71aa0) and zombThinkPonder (0x71d44): after its target; gone or dead, search; a player
   * cloaked or masked, go to where it was; in its sight and view: hacks when close and facing (the ponder groans
   * first, and turns while it is not facing); else, the chase lost, go to where it was last seen
   */
  zombThinkChase (ponder) {
    const s = this.sprite, info = this.info, engine = this.level.engine
    if (this.target === -1) { this.aiNewState(ZOMBIE.search); return }
    const t = this.level.sprites[this.target]
    const dx = t.x - s.x, dy = t.y - s.y
    this.aiChooseDirection(getangle(this, dx, dy))
    const tp = this.game.playerOf(t)
    const tx = this.level.x(t)
    const alive = tp ? tp.health > 0 : tx && tx.health > 0
    if (!alive) { this.aiNewState(ZOMBIE.search); return }
    if (tp && tp.powerups && (tp.powerups[13] || tp.powerups[31])) { this.aiNewState(ZOMBIE.goto); return }
    const dist = approxDist(dx, dy)
    if (dist <= info.seeDist) {
      const delta = ((getangle(this, dx, dy) + 1024 - s.ang) & 2047) - 1024
      const eye = s.z - ((info.eyeHeight * s.yrepeat) << 2)
      if (engine.cansee(t.x, t.y, t.z, t.sectnum, s.x, s.y, eye, s.sectnum) && Math.abs(delta) <= info.periphery) {
        this.aiSetTargetSprite(this.target)
        if (dist < 0x400 && Math.abs(delta) < 85) {
          if (ponder) this.game.sound(s, 1101)
          this.aiNewState(ZOMBIE.hack)
          return
        }
        if (ponder) { if (dist < 0x400) return; this.aiNewState(ZOMBIE.chase) }
        return
      }
    }
    if (ponder) { this.aiNewState(ZOMBIE.chase); return }
    this.aiNewState(ZOMBIE.goto)
    this.target = -1
  }
}
