// Blood's bat (aibat.cpp, type 219) as BLOOD.EXE runs it: its states are the exe's own, each function they name
// ported here from its disassembly and mixed into the dude with server/game/ai.mjs (the gargoyle's turn and
// speed helpers, server/game/aigarg.mjs, serve it too).
import { approxDist } from './physics.mjs'

const getangle = (dude, dx, dy) => dude.level.trig.getangle(dx, dy)

/** The bat's states (offsets of BLOOD.EXE's AISTATEs, in its order) */
export const BAT = {
  idle: 0x18a9c, flyIdle: 0x18ab8, chase: 0x18ad4, ponder: 0x18af0, goto: 0x18b0c, bite: 0x18b28, recoil: 0x18b44,
  search: 0x18b60, swoop: 0x18b7c, fly: 0x18b98, turn: 0x18bb4, hide: 0x18bd0, dodgeUp: 0x18bec,
  dodgeUpRight: 0x18c08, dodgeUpLeft: 0x18c24, dodgeDown: 0x18c40, dodgeDownRight: 0x18c5c, dodgeDownLeft: 0x18c78
}

/** The functions the bat's states name, by address */
export const BAT_FN = {
  0x5ea64: (d) => d.batThinkTarget(),
  0x5ecf8: (d) => { d.aiChooseDirection(d.goalAng); d.batThinkTarget() }, // batThinkSearch
  0x5ed1c: (d) => d.batThinkGoto(),
  0x5ee00: (d) => d.batThinkPonder(),
  0x5f268: (d) => d.gargMoveDodge(-0x52aaa), // batMoveDodgeUp
  0x5f420: (d) => d.gargMoveDodge(0x44444), // batMoveDodgeDown
  0x5f5ec: (d) => d.batThinkChase(),
  0x5f9dc: (d) => d.batMoveForward(),
  0x5fc1c: (d) => d.batMoveSwoop(0x600, 0x44444), // batMoveSwoop
  0x5fe54: (d) => d.batMoveSwoop(0x4000, -0x2d555), // batMoveFly
  0x60074: (d) => d.batMoveToCeil()
}

/** Its bite (BiteSeqCallback, registered at 0x5e8d0) */
export const BAT_CALLBACK = { [BAT.bite]: (d) => d.batBite() }

/** Mixed into a bat */
export const BatAI = {
  /** batThinkTarget (0x5ea64): the gargoyle's: ten looks awake without a sight, back toward where it started */
  batThinkTarget () {
    if (this.active && this.thinkTime < 10) this.thinkTime++
    else if (this.thinkTime >= 10 && this.active) {
      this.goalAng = (this.goalAng + 256) & 2047
      this.aiSetTargetPlace(this.base.x, this.base.y, this.base.z)
      this.aiNewState(BAT.turn)
      return
    }
    if (this.game.random.Chance(this.info.alertChance)) this.noticePlayers()
  },

  /** batThinkGoto (0x5ed1c): toward the place; near (512) and facing it, search; and look (its own look) */
  batThinkGoto () {
    const s = this.sprite
    const dx = this.tx - s.x, dy = this.ty - s.y
    const ang = getangle(this, dx, dy)
    const dist = approxDist(dx, dy)
    this.aiChooseDirection(ang)
    if (dist < 512 && Math.abs(s.ang - ang) < this.info.periphery) this.aiNewState(BAT.search)
    this.batThinkTarget()
  },

  /**
   * batThinkPonder (0x5ee00): after a bite, by how far its target is below it: dodge up or down; dead, search;
   * out of sight or range, go where it was
   */
  batThinkPonder () {
    const s = this.sprite, info = this.info, engine = this.level.engine, game = this.game
    if (this.target === -1) { this.aiNewState(BAT.search); return }
    const t = this.level.sprites[this.target]
    const dx = t.x - s.x, dy = t.y - s.y
    this.aiChooseDirection(getangle(this, dx, dy))
    const tp = game.playerOf(t), tx = this.level.x(t)
    const health = tp ? tp.health : tx ? tx.health : 0
    if (!(health > 0)) { this.aiNewState(BAT.search); return }
    const dist = approxDist(dx, dy)
    if (dist <= info.seeDist) {
      const ad = Math.abs(((getangle(this, dx, dy) + 1024 - s.ang) & 2047) - 1024)
      const height = (info.eyeHeight * s.yrepeat) << 2
      const ti = this.dudes.tables.dudeInfo[t.type] || { eyeHeight: 0 }
      const dh = ((ti.eyeHeight * t.yrepeat) << 2) - height
      if (engine.cansee(t.x, t.y, t.z, t.sectnum, s.x, s.y, s.z - height, s.sectnum)) {
        this.aiSetTargetSprite(this.target)
        if (dh < 0x3000 && dist < 0x1800 && dist > 0xc00 && ad < 85) this.aiNewState(BAT.dodgeUp)
        else if (dh > 0x5000 && dist < 0x1800 && dist > 0xc00 && ad < 85) this.aiNewState(BAT.dodgeDown)
        else if (dh < 0x2000 && dist < 0x200 && ad < 85) this.aiNewState(BAT.dodgeUp)
        else if (dh > 0x6000 && dist < 0x1400 && dist > 0x800 && ad < 85) this.aiNewState(BAT.dodgeDown)
        else if (dh < 0x2000 && dist < 0x1400 && dist > 0x800 && ad < 85) this.aiNewState(BAT.dodgeUp)
        else if (dh < 0x2000 && ad < 85 && dist > 0x1400) this.aiNewState(BAT.dodgeUp)
        else if (dh > 0x4000) this.aiNewState(BAT.dodgeDown)
        else this.aiNewState(BAT.dodgeUp)
        return
      }
    }
    this.aiNewState(BAT.goto)
    this.target = -1
  },

  /**
   * batThinkChase (0x5f5ec): after its target; dead or cloaked, search; out of sight, fly; in sight and view: a
   * bite when close and level, a swoop on one well below, a flight on one near its height; else gone: it hides on
   * the ceiling. (Its own eye height for the target's, as Blood)
   */
  batThinkChase () {
    const s = this.sprite, info = this.info, engine = this.level.engine, game = this.game
    if (this.target === -1) { this.aiNewState(BAT.goto); return }
    const t = this.level.sprites[this.target]
    const dx = t.x - s.x, dy = t.y - s.y
    this.aiChooseDirection(getangle(this, dx, dy))
    const tp = game.playerOf(t), tx = this.level.x(t)
    const health = tp ? tp.health : tx ? tx.health : 0
    if (!(health > 0)) { this.aiNewState(BAT.search); return }
    if (tp && tp.powerups && tp.powerups[113] > 0) { this.aiNewState(BAT.search); return }
    const dist = approxDist(dx, dy)
    if (dist <= info.seeDist) {
      const delta = ((getangle(this, dx, dy) + 1024 - s.ang) & 2047) - 1024
      const height = (info.eyeHeight * s.yrepeat) << 2
      const dh = ((info.eyeHeight * t.yrepeat) << 2) - height
      const { bottom } = this.level.extents(s)
      if (!engine.cansee(t.x, t.y, t.z, t.sectnum, s.x, s.y, s.z - height, s.sectnum)) { this.aiNewState(BAT.fly); return }
      if (dist < info.seeDist && Math.abs(delta) <= info.periphery) {
        this.aiSetTargetSprite(this.target)
        const fb = engine.getflorzofslope(s.sectnum, s.x, s.y) - bottom
        const ad = Math.abs(delta)
        if (dh < 0x2000 && dist < 0x200 && ad < 85) this.aiNewState(BAT.bite)
        else if ((dh > 0x5000 || fb > 0x5000) && dist < 0x1400 && dist > 0x800 && ad < 85) this.aiNewState(BAT.swoop)
        else if ((dh < 0x3000 || fb < 0x3000) && ad < 85) this.aiNewState(BAT.fly)
        return
      }
    }
    this.target = -1
    this.aiNewState(BAT.hide)
  },

  /** batMoveForward (0x5f9dc): the gargoyle's forward move, stopping half the time within 0x200 of its place */
  batMoveForward () {
    const s = this.sprite
    const delta = this.gargTurn()
    const accel = this.info.frontSpeed << 2
    if (Math.abs(delta) > 341) return
    if (this.target === -1) s.ang = (s.ang + 256) & 2047
    const dist = approxDist(this.tx - s.x, this.ty - s.y)
    if (this.game.random.Random(64) < 32 && dist <= 0x200) return
    const a = this.gargAxes()
    this.gargSetAxes(a, a.t1 + (this.target === -1 ? accel : accel >> 1), a.t2)
  },

  /**
   * batMoveSwoop and batMoveFly (0x5fc1c, 0x5fe54): not facing, a quarter turn more to its goal; else on (but
   * on a chance near its place), pushed by half its push, and down (the swoop) or up (the flight)
   */
  batMoveSwoop (chance, zvel) {
    const s = this.sprite
    const delta = this.gargTurn()
    const accel = this.info.frontSpeed << 2
    if (Math.abs(delta) > 341) { this.goalAng = (s.ang + 512) & 2047; return }
    const dist = approxDist(this.tx - s.x, this.ty - s.y)
    if (this.game.random.Chance(chance) && dist <= 0x200) return
    const a = this.gargAxes()
    this.gargSetAxes(a, a.t1 + (accel >> 1), a.t2)
    s.zvel = zvel
  },

  /** batMoveToCeil (0x60074): up to its sector's ceiling; there, asleep (idle, no flags) */
  batMoveToCeil () {
    const s = this.sprite
    if (s.z - this.tz < 0x1000) {
      this.active = false
      s.flags = 0
      this.aiNewState(BAT.idle)
    } else this.aiSetTargetPlace(s.x, s.y, this.level.sectors[s.sectnum].ceilingz)
  },

  /** BiteSeqCallback (0x5e908): a bite (vector 6) along its facing, at the target's eye height against its own */
  batBite () {
    const s = this.sprite, trig = this.level.trig
    const t = this.level.sprites[this.target]
    if (!t || this.target < 0) return
    const ti = this.dudes.tables.dudeInfo[t.type] || { eyeHeight: 0 }
    const dz = ((t.yrepeat * ti.eyeHeight) << 2) - ((s.yrepeat * this.info.eyeHeight) << 2)
    this.game.combat.fireVector(s, 0, 0, trig.Cos(s.ang) >> 16, trig.Sin(s.ang) >> 16, dz, 6)
  }
}
