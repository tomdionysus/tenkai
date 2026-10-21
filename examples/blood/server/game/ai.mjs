// Blood's AI as the original runs it: the states are BLOOD.EXE's own (AISTATE: a sequence, a callback, ticks, enter,
// move and think functions, the next state; formats/exe.mjs reads them), and each function they name is ported here
// from its disassembly (tools/disasm.mjs), keyed by its address. A dude whose type has its functions here runs by
// these; aiNewState, aiProcessDudes' step, aiActivateDude, aiSetTarget, RecoilDude as Blood's.
import { mulscale, divscale, CLIPMASK1 } from '../../common/engine.mjs'
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
  0x721c4: (d) => { d.aiChooseDirection(d.goalAng); d.myThinkTarget() }, // myThinkSearch
  0x5bc24: (d) => d.aiMoveDodge(), // aiMoveDodge
  // --- the cultists (aicult.cpp) ---
  0x670e8: (d) => d.cultThinkChase(), // cultThinkChase
  0x66f80: (d) => d.cultThinkGoto(), // cultThinkGoto
  0x66f5c: (d) => { d.aiChooseDirection(d.goalAng); d.aiLookForTarget() } // cultThinkSearch
}

/** The zombie's states by name (offsets of BLOOD.EXE's AISTATEs, tools/aistates.mjs) */
export const ZOMBIE = {
  idle: 0x1a944, chase: 0x1a960, ponder: 0x1a97c, goto: 0x1a998, hack: 0x1a9b4, search: 0x1a9d0, recoil: 0x1a9ec,
  teslaRecoil: 0x1aa08, fall: 0x1aa24, standUp: 0x1aa40, buried: 0x1aa5c, rise2: 0x1aa78, rise: 0x1aa94,
  layingIdle: 0x1aab0, layingSearch: 0x1aacc, laying: 0x1aae8
}

/** The cultists' states (aicult.cpp's, in BLOOD.EXE's order) */
export const CULTIST = {
  idle: 0x197c8, chase: 0x19838, fanaticChase: 0x19854, dodge: 0x19870, goto: 0x1988c, proneChase: 0x198a8,
  proneDodge: 0x198c4, tThrow: 0x198e0, sThrow: 0x198fc, tsThrow: 0x19918, dThrow: 0x19934, search: 0x199dc,
  sFire: 0x199f8, tFire: 0x19a14, tsFire: 0x19a30, sProneFire: 0x19a4c, tProneFire: 0x19a68, tsProneFire: 0x19a84,
  recoil: 0x19aa0, proneRecoil: 0x19abc, teslaRecoil: 0x19ad8, swimIdle: 0x19af4, swimChase: 0x19b10,
  swimDodge: 0x19b2c, swimGoto: 0x19b48, swimSearch: 0x19b64, sSwimFire: 0x19b80, tSwimFire: 0x19b9c,
  tsSwimFire: 0x19bb8, swimRecoil: 0x19bd4
}

/** Every state's name, for the dude's stateName */
const NAMES = new Map([...Object.entries(ZOMBIE), ...Object.entries(CULTIST)].map(([k, v]) => [v, k]))

/** The sequence callbacks of states (Blood registers them at start; matched here by the state that plays them) */
export const CALLBACK = {
  [ZOMBIE.hack]: (d) => d.zombieHack(),
  [ZOMBIE.standUp]: (d) => d.game.sound(d.sprite, 1102),
  // the cultists' (Blood's nThrowClient, nShotClient, nTommyClient)
  [CULTIST.tThrow]: (d) => d.cultThrow(), [CULTIST.sThrow]: (d) => d.cultThrow(), [CULTIST.dThrow]: (d) => d.cultThrow(),
  [CULTIST.sFire]: (d) => d.cultShot(), [CULTIST.sProneFire]: (d) => d.cultShot(), [CULTIST.sSwimFire]: (d) => d.cultShot(),
  [CULTIST.tFire]: (d) => d.cultTommy(), [CULTIST.tProneFire]: (d) => d.cultTommy(), [CULTIST.tSwimFire]: (d) => d.cultTommy()
}

/** Each type's first state (Blood's aiInitSprite) */
export const START = { 201: CULTIST.idle, 202: CULTIST.idle, 203: ZOMBIE.idle, 205: ZOMBIE.buried, 244: ZOMBIE.laying }

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
    this.stateName = NAMES.get(at) || at.toString(16)
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

  /** Blood's RecoilDude (0x5d4f8): a chance first (the cultists' prone fall), then each type's */
  recoilDude () {
    const v = this.game.random.Chance(0x8000)
    if (this.sprite.statnum !== 6) return
    if (this.sprite.type === 201 || this.sprite.type === 202) { this.cultRecoil(v); return }
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
      case 201: case 202: {
        // the cultists: no target, they search (and may say so); else a cry, and the chase (the tommy cultist's
        // turns to fire as it goes: Blood's fanaticChase)
        const tommy = s.type === 201, medium = this.x.medium
        if (this.target === -1) {
          if (medium === 0) {
            this.aiNewState(CULTIST.search)
            if (R.Chance(0x8000)) this.game.sound(s, (tommy ? 4008 : 1008) + R.Random(5))
          } else if (medium <= 2) this.aiNewState(CULTIST.swimSearch)
          return
        }
        if (R.Chance(0x8000)) this.game.sound(s, (tommy ? 4003 : 1003) + R.Random(4))
        if (medium === 0) this.aiNewState(tommy ? CULTIST.fanaticChase : CULTIST.chase)
        else if (medium <= 2) this.aiNewState(CULTIST.swimChase)
        return
      }
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
  aiDamaged (source, damage, kind) {
    const s = this.sprite
    if (!source || source === s) return
    if (this.target === -1 || (source.index !== this.target && this.game.random.Chance(damage * (source.type === s.type ? this.info.changeTargetKinChance : this.info.changeTargetChance)))) {
      this.aiSetTargetSprite(source.index)
      this.aiActivateDude()
    }
    // Then each type's (BLOOD.EXE 0x5cfa6): a cultist hurt by anything but fire dodges (standing, prone or swimming)
    if ((s.type === 201 || s.type === 202) && kind !== 1) this.dodgeBy()
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
  ,

  /** Blood's aiMoveDodge (0x5bc24): turn toward the goal, and step aside by its side speed, the dodge's way */
  aiMoveDodge () {
    const s = this.sprite, trig = this.level.trig, info = this.info
    const range = (info.angSpeed << 2) >> 4
    const delta = ((this.goalAng + 1024 - s.ang) & 2047) - 1024
    s.ang = (s.ang + Math.max(-range, Math.min(range, delta))) & 2047
    if (!this.dodgeDir) return
    const cos = trig.Cos(s.ang), sin = trig.Sin(s.ang)
    const t1 = Math.floor((s.xvel * cos + s.yvel * sin) / 2 ** 30)
    let t2 = Math.floor((s.xvel * sin - s.yvel * cos) / 2 ** 30)
    t2 += this.dodgeDir > 0 ? info.sideSpeed : -info.sideSpeed
    s.xvel = Math.floor((t1 * cos + t2 * sin) / 2 ** 30)
    s.yvel = Math.floor((t1 * sin - t2 * cos) / 2 ** 30)
  },

  /** Blood's dudeIsPlayingSeq: the dude plays its type's sequence `n` (14 prone, 13 swimming) */
  playingSeq (n) { return this.dudes.seqs.playing(this.sprite) === this.info.seqStartID + n },

  /**
   * Blood's HitScan (0x220fc) from the dude along (dx, dy, dz), itself let through: 3 a sprite, 0 a wall, 4 a masked
   * wall within its opening, 1 a ceiling, 2 a floor, -1 nothing; this.hitInfo keeps what it hit
   */
  hitScan (z, dx, dy, dz, clipmask) {
    const s = this.sprite, cstat = s.cstat
    s.cstat &= ~256
    const hit = this.level.engine.hitscan(s.x, s.y, z, s.sectnum, dx, dy, dz << 4, clipmask)
    s.cstat = cstat
    this.hitInfo = hit
    return this.game.combat.hitType(hit, z)
  },

  /** Blood's TargetNearExplosion (0x66f00): a lit TNT stick or an explosion in the target's sector */
  targetNearExplosion (t) {
    if (this.game.things.explosions.some((e) => e.sectnum === t.sectnum && e.time > 0)) return true
    return this.level.engine.spritesIn(t.sectnum).some((i) => this.level.sprites[i].type === 418)
  },

  /** A medium's states: on land (0), else in water (1, 2), else none */
  byMedium (land, water) {
    const m = this.x.medium
    if (m === 0) { if (land) this.aiNewState(land) } else if (m <= 2) { if (water) this.aiNewState(water) }
  },

  /** cultThinkGoto (0x66f80): toward the place; near and facing it, search; and look */
  cultThinkGoto () {
    const s = this.sprite
    const dx = this.tx - s.x, dy = this.ty - s.y
    const ang = getangle(this, dx, dy)
    const dist = approxDist(dx, dy)
    this.aiChooseDirection(ang)
    if (dist < 0x1400 && Math.abs(s.ang - ang) < this.info.periphery) this.byMedium(CULTIST.search, CULTIST.swimSearch)
    this.aiThinkTarget()
  },

  /**
   * cultThinkChase (0x670e8): after its target. Gone, dead (a cry) or cloaked: search; out of sight: go where it was.
   * In sight: the slope to it kept (gDudeSlope), then the cultist's attack: the tommy cultist throws TNT at a
   * running player at middle range (the hardest skills), the shotgun cultist at a walking one; else each fires when
   * close and facing, or dodges a fellow cultist in the way; prone (sequence 14) or swimming, its own state
   */
  cultThinkChase () {
    const s = this.sprite, info = this.info, engine = this.level.engine, game = this.game
    if (this.target === -1) { this.byMedium(CULTIST.goto, CULTIST.swimGoto); return }
    const t = this.level.sprites[this.target]
    const dx = t.x - s.x, dy = t.y - s.y
    this.aiChooseDirection(getangle(this, dx, dy))
    const tp = game.playerOf(t), tx = this.level.x(t)
    const health = tp ? tp.health : tx ? tx.health : 0
    if (!(health > 0)) {
      if (this.x.medium === 0) {
        this.aiNewState(CULTIST.search)
        game.sound(s, (s.type === 201 ? 4021 : 1021) + game.random.Random(4))
      } else if (this.x.medium <= 2) this.aiNewState(CULTIST.swimSearch)
      return
    }
    if (tp && tp.powerups && tp.powerups[13] > 0) { this.byMedium(CULTIST.search, CULTIST.swimSearch); return }
    const dist = approxDist(dx, dy)
    if (dist <= info.seeDist) {
      const delta = ((getangle(this, dx, dy) + 1024 - s.ang) & 2047) - 1024
      const eye = s.z - ((info.eyeHeight * s.yrepeat) << 2)
      if (engine.cansee(t.x, t.y, t.z, t.sectnum, s.x, s.y, eye, s.sectnum) && dist < info.seeDist && Math.abs(delta) <= info.periphery) {
        this.aiSetTargetSprite(this.target)
        this.dudeSlope = dist ? divscale(t.z - s.z, dist, 10) : 0
        if (s.type === 201) this.tommyChase(t, tp, dx, dy, dist, delta)
        else if (s.type === 202) this.shotgunChase(t, tp, dx, dy, dist, delta)
        return
      }
    }
    this.byMedium(CULTIST.goto, CULTIST.swimGoto)
    this.target = -1
  },

  /** The tests both cultists make before a throw: the target not near an explosion, falling-capable, a player */
  canThrowAt (t, tp) {
    return !this.targetNearExplosion(t) && (t.flags & 2) && tp
  },

  /** A throw's state, by what a hitscan toward the target meets (Blood's jump table at 0x67088 and 0x670a0) */
  throwBy (hit, state, fellow) {
    const water = this.x.medium === 1 || this.x.medium === 2
    if (hit === -1) { if (!water) this.aiNewState(state) } else if (hit === 1 || hit === 2) this.aiNewState(state)
    else if (hit === 3) {
      const h = this.level.sprites[this.hitInfo.sprite]
      if (h.type === this.sprite.type || h.type === fellow) return
      if (!water) this.aiNewState(state)
    }
  },

  /** A fire's state: standing, prone (sequence 14) or swimming (`swimSeq`: whether sequence 13 must play) */
  fireBy (stand, prone, swim, swimSeq) {
    const m = this.x.medium
    if (!this.playingSeq(14) && m === 0) this.aiNewState(stand)
    else if (this.playingSeq(14) && m === 0) this.aiNewState(prone)
    else if ((!swimSeq || this.playingSeq(13)) && (m === 1 || m === 2)) this.aiNewState(swim)
  },

  /** The dodge from a fellow in the line of fire */
  dodgeBy () { this.fireBy(CULTIST.dodge, CULTIST.proneDodge, CULTIST.swimDodge, false) },

  tommyChase (t, tp, dx, dy, dist, delta) {
    const s = this.sprite, game = this.game
    if (dist < 0x1e00 && dist > 0xe00 && Math.abs(delta) < 0x55 && this.canThrowAt(t, tp) && game.options.difficulty > 2 && tp.input && tp.input.run && game.random.Chance(0x8000)) {
      this.throwBy(this.hitScan(s.z, dx, dy, 0, CLIPMASK1), CULTIST.tThrow, 202)
      return
    }
    if (dist < 0x4600 && Math.abs(delta) < 0x1c) {
      const hit = this.hitScan(s.z, dx, dy, 0, CLIPMASK1)
      if (hit === -1) this.fireBy(CULTIST.tFire, CULTIST.tProneFire, CULTIST.tSwimFire, true)
      else if (hit === 3) {
        const h = this.level.sprites[this.hitInfo.sprite]
        if (h.type === s.type || h.type === 202) this.dodgeBy()
        else this.fireBy(CULTIST.tFire, CULTIST.tProneFire, CULTIST.tSwimFire, false)
      } else this.fireBy(CULTIST.tFire, CULTIST.tProneFire, CULTIST.tSwimFire, false)
    }
  },

  shotgunChase (t, tp, dx, dy, dist, delta) {
    const s = this.sprite, game = this.game
    if (dist < 0x2c00 && dist > 0x1400 && this.canThrowAt(t, tp) && game.options.difficulty >= 2 && !(tp.input && tp.input.run) && game.random.Chance(0x8000)) {
      this.throwBy(this.hitScan(s.z, dx, dy, 0, CLIPMASK1), CULTIST.sThrow, 202)
      return
    }
    if (dist < 0x3200 && Math.abs(delta) < 0x1c) {
      const hit = this.hitScan(s.z, dx, dy, 0, CLIPMASK1)
      if (hit === 3) {
        const h = this.level.sprites[this.hitInfo.sprite]
        if (h.type === s.type || h.type === 201) { this.dodgeBy(); return }
      }
      this.fireBy(CULTIST.sFire, CULTIST.sProneFire, CULTIST.sSwimFire, false)
    }
  },

  /** Blood's RecoilDude, the cultists' case: a cry; on the chance, prone (above the easiest skill) */
  cultRecoil (v) {
    const s = this.sprite, game = this.game, m = this.x.medium
    game.sound(s, (s.type === 201 ? 4013 : 1013) + game.random.Random(2))
    if (!v && m === 0) this.aiNewState(this.teslaRecoil ? CULTIST.teslaRecoil : CULTIST.recoil)
    else if (v && m === 0) {
      if (this.teslaRecoil) this.aiNewState(CULTIST.teslaRecoil)
      else if (game.options.difficulty > 0) this.aiNewState(CULTIST.proneRecoil)
      else this.aiNewState(CULTIST.recoil)
    } else if (m === 1 || m === 2) this.aiNewState(CULTIST.swimRecoil)
    else this.aiNewState(this.teslaRecoil ? CULTIST.teslaRecoil : CULTIST.recoil)
    this.teslaRecoil = false
  },

  /** Its aim: its facing and the slope to its target */
  aim () {
    const trig = this.level.trig, s = this.sprite
    return { dx: trig.Cos(s.ang) >> 16, dy: trig.Sin(s.ang) >> 16, dz: this.dudeSlope || 0 }
  },

  /** TommySeqCallback (0x66668): a bullet, spread by the skill (Random3 in x, y, then z), and its sound */
  cultTommy () {
    const R = this.game.random, d = this.game.options.difficulty, a = this.aim()
    const k = 5000 - 1000 * d, kz = 2500 - 500 * d
    a.dx += R.Random3(k)
    a.dy += R.Random3(k)
    a.dz += R.Random3(kz)
    this.game.combat.fireVector(this.sprite, 0, 0, a.dx, a.dy, a.dz, 2)
    this.game.sound(this.sprite, 4001)
  },

  /** ShotSeqCallback (0x6693c): the aim spread once (Random2), then eight pellets each spread (z, y, x) */
  cultShot () {
    const R = this.game.random, d = this.game.options.difficulty, a = this.aim()
    const k = 4500 - 1000 * d, kz = 2500 - 500 * d
    a.dx += R.Random2(k)
    a.dy += R.Random2(k)
    a.dz += R.Random2(kz)
    for (let i = 0; i < 8; i++) {
      const z = a.dz + R.Random3(500)
      const y = a.dy + R.Random3(1000)
      const x = a.dx + R.Random3(1000)
      this.game.combat.fireVector(this.sprite, 0, 0, x, y, z, 1)
    }
    this.game.sound(this.sprite, R.Chance(0x8000) ? 1001 : 1002)
  },

  /**
   * ThrowSeqCallback (0x66b14): a TNT stick (a bundle above skill 2) thrown at the target's distance; on a chance
   * (and near enough) it goes off on what it hits, else on a fuse of one or two seconds
   */
  cultThrow () {
    const s = this.sprite, game = this.game, R = game.random
    const type = game.options.difficulty > 2 ? 419 : 418
    let impact = R.Chance(0x6000)
    game.sound(s, 455)
    const t = this.level.sprites[this.target]
    if (!t) return
    const dx = t.x - s.x, dy = t.y - s.y, dz = t.z - s.z
    const dist = approxDist(dx, dy)
    const v = Math.trunc(dist / 540)
    if (dist > 0x1e00) impact = false
    const thing = game.things.fire(s, type, 0, Math.trunc(dz / 128) - 14500, Math.trunc((v << 23) / 120), impact ? { impact: true } : {})
    // (else Blood's evPost of an "on" to it, one or two seconds on: it goes off when the queue gets there)
    if (!impact) game.things.fuseEvent(thing, 120 * (1 + R.Random(2)))
  }
}
