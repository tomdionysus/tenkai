// Blood's gargoyles (aigarg.cpp) as BLOOD.EXE runs them: the flesh gargoyle (206), the stone one (207) and their
// statues (208, 209), which wake as them. Their states are the exe's own (formats/exe.mjs reads them); each
// function they name is ported here from its disassembly (tools/disasm.mjs), keyed by its address, and mixed into
// the dude with the rest of server/game/ai.mjs.
import { dmulscale, CLIPMASK1 } from '../../common/engine.mjs'
import { approxDist } from './physics.mjs'

const getangle = (dude, dx, dy) => dude.level.trig.getangle(dx, dy)

/** The gargoyles' states (offsets of BLOOD.EXE's AISTATEs, in its order) */
export const GARG = {
  fIdle: 0x19bf0, statueIdle: 0x19c0c, fChase: 0x19c28, fGoto: 0x19c44, fSlash: 0x19c60, fThrow: 0x19c7c,
  sThrow: 0x19c98, sBlast: 0x19cb4, fRecoil: 0x19cd0, fSearch: 0x19cec, fMorph2: 0x19d08, fMorph: 0x19d24,
  sMorph2: 0x19d40, sMorph: 0x19d5c, swoop: 0x19d78, fly: 0x19d94, turn: 0x19db0, dodgeUp: 0x19dcc,
  fDodgeUpRight: 0x19de8, fDodgeUpLeft: 0x19e04, dodgeDown: 0x19e20, fDodgeDownRight: 0x19e3c, fDodgeDownLeft: 0x19e58
}

/** The functions the gargoyles' states name, by address */
export const GARG_FN = {
  0x69174: (d) => d.gargThinkTarget(),
  0x69424: (d) => { d.aiChooseDirection(d.goalAng); d.aiLookForTarget() }, // gargThinkSearch
  0x69448: (d) => d.gargThinkGoto(),
  0x6952c: (d) => d.gargMoveDodge(-0x1d555), // gargMoveDodgeUp
  0x696e4: (d) => d.gargMoveDodge(0x44444), // gargMoveDodgeDown
  0x69910: (d) => d.gargThinkChase(),
  0x6a0b0: (d) => d.gargStatueWakes(206), // entryFStatue
  0x6a0d8: (d) => d.gargStatueWakes(207), // entrySStatue
  0x6a100: (d) => d.gargMoveForward(),
  0x6a340: (d) => d.gargMoveSlow(),
  0x6a5a8: (d) => d.gargMoveSwoop(1), // gargMoveSwoop: down along its push
  0x6a804: (d) => d.gargMoveSwoop(-1) // gargMoveFly: up
}

/** Their sequences' callbacks (registered at 0x688d0: the slash, the bone thrown, the stone's bones and blast) */
export const GARG_CALLBACK = {
  [GARG.fSlash]: (d) => d.gargSlash(),
  [GARG.fThrow]: (d) => d.gargThrow(0xeeeee),
  [GARG.sThrow]: (d) => d.gargThrow(d.game.random.Chance(0x6000) ? 0x133333 : 0x111111),
  [GARG.sBlast]: (d) => d.gargBlast()
}

/** Mixed into a gargoyle */
export const GargAI = {
  /**
   * gargThinkTarget (0x69174): awake (activated) and ten looks without a sight of anyone, it turns back toward
   * where it started; else on its alert chance it looks for a player (aiThinkTarget's look)
   */
  gargThinkTarget () {
    if (this.active && this.thinkTime < 10) this.thinkTime++
    else if (this.thinkTime >= 10 && this.active) {
      this.goalAng = (this.goalAng + 256) & 2047
      this.aiSetTargetPlace(this.base.x, this.base.y, this.base.z)
      this.aiNewState(GARG.turn)
      return
    }
    if (this.game.random.Chance(this.info.alertChance)) this.noticePlayers()
  },

  /** gargThinkGoto (0x69448): toward the place; near (512) and facing it, search; and look (aiThinkTarget) */
  gargThinkGoto () {
    const s = this.sprite
    const dx = this.tx - s.x, dy = this.ty - s.y
    const ang = getangle(this, dx, dy)
    const dist = approxDist(dx, dy)
    this.aiChooseDirection(ang)
    if (dist < 512 && Math.abs(s.ang - ang) < this.info.periphery) this.aiNewState(GARG.fSearch)
    this.aiThinkTarget()
  },

  /**
   * gargThinkChase (0x69910): after its target; gone or dead or cloaked, search; out of sight, fly; in sight and
   * view: the flesh one throws a bone at middle range or slashes when close (a cry each, a hitscan's clear line
   * first), swoops on one below it or cries; the stone one blasts, slashes, swoops the same. (Blood compares its
   * own eye height scaled by the target's repeat, not the target's: kept)
   */
  gargThinkChase () {
    const s = this.sprite, info = this.info, engine = this.level.engine, game = this.game
    if (this.target === -1) { this.aiNewState(GARG.fGoto); return }
    const t = this.level.sprites[this.target]
    const dx = t.x - s.x, dy = t.y - s.y
    this.aiChooseDirection(getangle(this, dx, dy))
    const tp = game.playerOf(t), tx = this.level.x(t)
    const health = tp ? tp.health : tx ? tx.health : 0
    if (!(health > 0)) { this.aiNewState(GARG.fSearch); return }
    if (tp && tp.powerups && tp.powerups[113] > 0) { this.aiNewState(GARG.fSearch); return }
    const dist = approxDist(dx, dy)
    if (dist > info.seeDist) { this.aiNewState(GARG.fGoto); this.target = -1; return }
    const delta = ((getangle(this, dx, dy) + 1024 - s.ang) & 2047) - 1024
    const height = (info.eyeHeight * s.yrepeat) << 2
    const height2 = (info.eyeHeight * t.yrepeat) << 2
    const { bottom } = this.level.extents(s)
    if (!engine.cansee(t.x, t.y, t.z, t.sectnum, s.x, s.y, s.z - height, s.sectnum)) { this.aiNewState(GARG.fly); return }
    if (dist >= info.seeDist || Math.abs(delta) > info.periphery) return
    this.aiSetTargetSprite(this.target)
    const floorZ = engine.getflorzofslope(s.sectnum, s.x, s.y)
    const flesh = s.type === 206
    if (!flesh && s.type !== 207) return
    // (a hitscan's: -1 nothing, 1 a ceiling, 2 a floor go on; 0 a wall, 4 a masked wall stop; 3 a sprite goes on
    // unless it is a gargoyle of its own type or the other kind)
    const clear = () => {
      const hit = this.hitScan(s.z, dx, dy, 0, CLIPMASK1)
      if (hit === 0 || hit === 4) return false
      if (hit === 3) { const h = this.level.sprites[this.hitInfo.sprite]; return h.type !== s.type && h.type !== (flesh ? 207 : 206) }
      return true
    }
    const ad = Math.abs(delta)
    if (dist < 0x1800 && dist > 0xc00 && ad < 85) {
      if (clear()) {
        if (flesh) { game.sound(s, 1408); this.aiNewState(GARG.fThrow) } else { game.sound(s, 1457); this.aiNewState(GARG.sBlast) }
      }
    } else if (dist < 0x400 && ad < 85) {
      if (clear()) { if (flesh) game.sound(s, 1406); this.aiNewState(GARG.fSlash) }
    } else if ((height2 - height > 0x2000 || floorZ - bottom > 0x2000) && dist < 0x1400 && dist > (flesh ? 0xa00 : 0x800)) {
      game.sound(s, flesh ? 1400 : 1450)
      this.aiNewState(GARG.swoop)
    } else if (flesh ? (height2 - height < 0x2000 || floorZ - bottom < 0x2000) && ad < 85 : (height2 - height < 0x2000 || floorZ - bottom > 0x2000) && ad < 85) {
      game.sound(s, flesh ? 1400 : 1450)
    }
  },

  /** The turn toward its goal by its type's turn speed (each move's first): the angle it had left to turn */
  gargTurn () {
    const s = this.sprite
    const range = (this.info.angSpeed << 2) >> 4
    const delta = ((this.goalAng + 1024 - s.ang) & 2047) - 1024
    s.ang = (s.ang + Math.max(-range, Math.min(range, delta))) & 2047
    return delta
  },

  /** Its speed split along its facing (t1) and across it (t2), and set back from them */
  gargAxes () {
    const s = this.sprite, trig = this.level.trig
    const cos = trig.Cos(s.ang), sin = trig.Sin(s.ang)
    return { cos, sin, t1: dmulscale(s.xvel, cos, s.yvel, sin, 30), t2: dmulscale(s.xvel, sin, -s.yvel, cos, 30) }
  },
  gargSetAxes ({ cos, sin }, t1, t2) {
    const s = this.sprite
    s.xvel = dmulscale(t1, cos, t2, sin, 30)
    s.yvel = dmulscale(t1, sin, -t2, cos, 30)
  },

  /** gargMoveDodgeUp and gargMoveDodgeDown (0x6952c, 0x696e4): turn, step aside the dodge's way, up or down */
  gargMoveDodge (zvel) {
    this.gargTurn()
    const a = this.gargAxes()
    const t2 = a.t2 + (this.dodgeDir > 0 ? this.info.sideSpeed : -this.info.sideSpeed)
    this.gargSetAxes(a, a.t1, t2)
    this.sprite.zvel = zvel
  },

  /**
   * gargMoveForward (0x6a100): turn; facing its goal, on (without a target it veers a quarter turn, and pushes
   * twice as hard), unless half the time when near the place it goes to
   */
  gargMoveForward () {
    const s = this.sprite
    const delta = this.gargTurn()
    const accel = this.info.frontSpeed << 2
    if (Math.abs(delta) > 341) return
    if (this.target === -1) s.ang = (s.ang + 256) & 2047
    const dist = approxDist(this.tx - s.x, this.ty - s.y)
    if (this.game.random.Random(64) < 32 && dist <= 0x400) return
    const a = this.gargAxes()
    this.gargSetAxes(a, a.t1 + (this.target === -1 ? accel : accel >> 1), a.t2)
  },

  /** gargMoveSlow (0x6a340): the blast's: not facing, a quarter turn more to its goal; else slowly on, and down */
  gargMoveSlow () {
    const s = this.sprite
    const delta = this.gargTurn()
    const accel = this.info.frontSpeed << 2
    if (Math.abs(delta) > 341) { this.goalAng = (s.ang + 512) & 2047; return }
    const dist = approxDist(this.tx - s.x, this.ty - s.y)
    if (this.game.random.Chance(0x600) && dist <= 0x400) return
    const a = this.gargAxes()
    this.gargSetAxes(a, accel >> 1, a.t2 >> 1)
    if (s.type === 206) s.zvel = 0x44444
    else if (s.type === 207) s.zvel = 0x35555
  },

  /**
   * gargMoveSwoop (0x6a5a8) and gargMoveFly (0x6a804): as the slow move, but pushed on by half its push, and down
   * (the swoop) or up (the flight) as fast as it goes on
   */
  gargMoveSwoop (dir) {
    const s = this.sprite
    const delta = this.gargTurn()
    const accel = this.info.frontSpeed << 2
    if (Math.abs(delta) > 341) { this.goalAng = (s.ang + 512) & 2047; return }
    const dist = approxDist(this.tx - s.x, this.ty - s.y)
    if (this.game.random.Chance(dir > 0 ? 0x600 : 0x4000) && dist <= 0x400) return
    const a = this.gargAxes()
    const t1 = a.t1 + (accel >> 1)
    this.gargSetAxes(a, t1, a.t2)
    if (s.type === 206 || s.type === 207) s.zvel = dir > 0 ? t1 : -t1
  },

  /** entryFStatue and entrySStatue (0x6a0b0, 0x6a0d8): healed to the gargoyle's health, and one from now on */
  gargStatueWakes (type) {
    const start = this.dudes.tables.dudeInfo[type].startHealth << 4
    if (this.x.health < start) this.x.health = Math.min(this.x.health + start, start)
    this.changeType(type)
  },

  /**
   * SlashFSeqCallback (0x68938): three slashes (vector 13) along its facing at the target's eye height, two of
   * them spread by 50 either way
   */
  gargSlash () {
    const s = this.sprite, trig = this.level.trig, R = this.game.random, combat = this.game.combat
    const t = this.level.sprites[this.target]
    if (!t || this.target < 0) return
    const ti = this.dudes.tables.dudeInfo[t.type] || { eyeHeight: 0 }
    const dz = ((s.yrepeat * this.info.eyeHeight) << 2) - ((t.yrepeat * ti.eyeHeight) << 2)
    const dx = trig.Cos(s.ang) >> 16, dy = trig.Sin(s.ang) >> 16
    combat.fireVector(s, 0, 0, dx, dy, dz, 13)
    let r1 = R.Random(50), r2 = R.Random(50)
    combat.fireVector(s, 0, 0, dx + r2, dy - r1, dz, 13)
    r1 = R.Random(50); r2 = R.Random(50)
    combat.fireVector(s, 0, 0, dx - r2, dy + r1, dz, 13)
  },

  /** ThrowFSeqCallback and ThrowSSeqCallback (0x68ac8, 0x690fc): a bone (thing 421) up its slope, at a speed */
  gargThrow (speed) {
    this.game.things.fire(this.sprite, 421, 0, (this.dudeSlope || 0) - 7500, speed)
  },

  /** BlastSSeqCallback (0x68b24): the stone gargoyle's two arcs (to port: E1M7's) */
  gargBlast () {}
}
