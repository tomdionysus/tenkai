// Blood's bone eel (aiboneel.cpp, type 218) as BLOOD.EXE runs it: its states are the exe's own, each function
// they name ported here from its disassembly and mixed into the dude with server/game/ai.mjs (with the
// gargoyle's turn and speed helpers, server/game/aigarg.mjs).
import { approxDist } from './physics.mjs'

const getangle = (dude, dx, dy) => dude.level.trig.getangle(dx, dy)

/** The eel's states (offsets of BLOOD.EXE's AISTATEs, in its order) */
export const EEL = {
  idle: 0x18ee0, flyIdle: 0x18efc, chase: 0x18f18, ponder: 0x18f34, goto: 0x18f50, bite: 0x18f6c, recoil: 0x18f88,
  search: 0x18fa4, swoop: 0x18fc0, fly: 0x18fdc, turn: 0x18ff8, hide: 0x19014, dodgeUp: 0x19030,
  dodgeUpRight: 0x1904c, dodgeUpLeft: 0x19068, dodgeDown: 0x19084, dodgeDownRight: 0x190a0, dodgeDownLeft: 0x190bc
}

/** The functions the eel's states name, by address */
export const EEL_FN = {
  0x61e64: (d) => d.eelThinkTarget(),
  0x62120: (d) => { d.aiChooseDirection(d.goalAng); d.eelThinkTarget() }, // eelThinkSearch
  0x62144: (d) => d.eelThinkGoto(),
  0x62228: (d) => d.eelThinkPonder(),
  0x62690: (d) => d.gargMoveDodge(-0x8000), // eelMoveDodgeUp
  0x62848: (d) => d.gargMoveDodge(0x44444), // eelMoveDodgeDown
  0x62a14: (d) => d.eelThinkChase(),
  0x62e54: (d) => d.eelMoveForward(),
  0x630a8: (d) => d.eelMoveSwoop(0x8000, 0x22222), // eelMoveSwoop
  0x632e8: (d) => d.eelMoveSwoop(0x4000, -0x8000), // eelMoveFly
  0x63528: (d) => d.eelMoveToCeil()
}

/** Its bite (BiteSeqCallback, registered at 0x61ce0) */
export const EEL_CALLBACK = { [EEL.bite]: (d) => d.eelBite() }

/** Mixed into an eel */
export const EelAI = {
  /** eelThinkTarget (0x61e64): the gargoyle's, its count of looks started over when it turns back */
  eelThinkTarget () {
    if (this.active && this.thinkTime < 10) this.thinkTime++
    else if (this.thinkTime >= 10 && this.active) {
      this.thinkTime = 0
      this.goalAng = (this.goalAng + 256) & 2047
      this.aiSetTargetPlace(this.base.x, this.base.y, this.base.z)
      this.aiNewState(EEL.turn)
      return
    }
    if (this.game.random.Chance(this.info.alertChance)) this.noticePlayers()
  },

  /** eelThinkGoto (0x62144): toward the place; near (512) and facing it, search; and look (its own look) */
  eelThinkGoto () {
    const s = this.sprite
    const dx = this.tx - s.x, dy = this.ty - s.y
    const ang = getangle(this, dx, dy)
    const dist = approxDist(dx, dy)
    this.aiChooseDirection(ang)
    if (dist < 512 && Math.abs(s.ang - ang) < this.info.periphery) this.aiNewState(EEL.search)
    this.eelThinkTarget()
  },

  /** eelThinkPonder (0x62228): after a bite, by how far its target is above or below it: dodge up or down */
  eelThinkPonder () {
    const s = this.sprite, info = this.info, engine = this.level.engine, game = this.game
    if (this.target === -1) { this.aiNewState(EEL.search); return }
    const t = this.level.sprites[this.target]
    const dx = t.x - s.x, dy = t.y - s.y
    this.aiChooseDirection(getangle(this, dx, dy))
    const tp = game.playerOf(t), tx = this.level.x(t)
    const health = tp ? tp.health : tx ? tx.health : 0
    if (!(health > 0)) { this.aiNewState(EEL.search); return }
    const dist = approxDist(dx, dy)
    if (dist <= info.seeDist) {
      const ad = Math.abs(((getangle(this, dx, dy) + 1024 - s.ang) & 2047) - 1024)
      const height = (info.eyeHeight * s.yrepeat) << 2
      const ti = this.dudes.tables.dudeInfo[t.type] || { eyeHeight: 0 }
      const dh = ((ti.eyeHeight * t.yrepeat) << 2) - height
      if (engine.cansee(t.x, t.y, t.z, t.sectnum, s.x, s.y, s.z - height, s.sectnum)) {
        this.aiSetTargetSprite(this.target)
        if (dh < -0x2000 && dist < 0x1800 && dist > 0xc00 && ad < 85) this.aiNewState(EEL.dodgeUp)
        else if (dh > 0xccc && dist < 0x1800 && dist > 0xc00 && ad < 85) this.aiNewState(EEL.dodgeDown)
        else if (dh < 0xccc && dist < 0x399 && ad < 85) this.aiNewState(EEL.dodgeUp)
        else if (dh > 0xccc && dist < 0x1400 && dist > 0x800 && ad < 85) this.aiNewState(EEL.dodgeDown)
        else if (dh < -0x2000 && dist < 0x1400 && dist > 0x800 && ad < 85) this.aiNewState(EEL.dodgeUp)
        else if (dh < -0x2000 && ad < 85 && dist > 0x1400) this.aiNewState(EEL.dodgeUp)
        else if (dh > 0xccc) this.aiNewState(EEL.dodgeDown)
        else this.aiNewState(EEL.dodgeUp)
        return
      }
    }
    this.aiNewState(EEL.goto)
    this.target = -1
  },

  /**
   * eelThinkChase (0x62a14): after its target; dead or cloaked, search; too far, search afresh; in sight and
   * view: close, a swoop on one whose top is below its own, else a bite; further, a swoop on one whose bottom is
   * below its top, a flight up to one above it
   */
  eelThinkChase () {
    const s = this.sprite, info = this.info, engine = this.level.engine, game = this.game, level = this.level
    if (this.target === -1) { this.aiNewState(EEL.goto); return }
    const t = level.sprites[this.target]
    const dx = t.x - s.x, dy = t.y - s.y
    this.aiChooseDirection(getangle(this, dx, dy))
    const tp = game.playerOf(t), tx = level.x(t)
    const health = tp ? tp.health : tx ? tx.health : 0
    if (!(health > 0)) { this.aiNewState(EEL.search); return }
    if (tp && tp.powerups && tp.powerups[13] > 0) { this.aiNewState(EEL.search); return }
    const dist = approxDist(dx, dy)
    if (dist > info.seeDist) { this.target = -1; this.aiNewState(EEL.search); return }
    const delta = ((getangle(this, dx, dy) + 1024 - s.ang) & 2047) - 1024
    const height = (info.eyeHeight * s.yrepeat) << 2
    const { top } = level.extents(s)
    const { top: top2, bottom: bottom2 } = level.extents(t)
    if (!engine.cansee(t.x, t.y, t.z, t.sectnum, s.x, s.y, s.z - height, s.sectnum)) return
    if (dist >= info.seeDist || Math.abs(delta) > info.periphery) return
    this.aiSetTargetSprite(this.target)
    const ad = Math.abs(delta)
    if (dist < 0x399 && top2 > top && ad < 85) this.aiNewState(EEL.swoop)
    else if (dist <= 0x399 && ad < 85) this.aiNewState(EEL.bite)
    else if (bottom2 > top && ad < 85) this.aiNewState(EEL.swoop)
    else if (top2 < top && ad < 85) this.aiNewState(EEL.fly)
  },

  /** Its push: its front speed less a skill's share ((4 - skill) << 26, by 120 twice), times four */
  eelAccel () {
    return (this.info.frontSpeed - Math.trunc(Math.trunc(((4 - this.game.options.difficulty) << 26) / 120) / 120)) << 2
  },

  /** eelMoveForward (0x62e54): turn; facing its goal and not yet within 0x399 of it, on (the gargoyle's push) */
  eelMoveForward () {
    const s = this.sprite
    const delta = this.gargTurn()
    const accel = this.eelAccel()
    if (Math.abs(delta) > 341) return
    if (this.target === -1) s.ang = (s.ang + 256) & 2047
    if (approxDist(this.tx - s.x, this.ty - s.y) <= 0x399) return
    const a = this.gargAxes()
    this.gargSetAxes(a, a.t1 + (this.target === -1 ? accel : accel >> 1), a.t2)
  },

  /**
   * eelMoveSwoop and eelMoveFly (0x630a8, 0x632e8): facing its goal, on by half its push (but on a chance near
   * its place), and down (the swoop) or up (the flight)
   */
  eelMoveSwoop (chance, zvel) {
    const s = this.sprite
    const delta = this.gargTurn()
    const accel = this.eelAccel()
    if (Math.abs(delta) > 341) return
    const dist = approxDist(this.tx - s.x, this.ty - s.y)
    if (this.game.random.Chance(chance) && dist <= 0x399) return
    const a = this.gargAxes()
    this.gargSetAxes(a, a.t1 + (accel >> 1), a.t2)
    s.zvel = zvel
  },

  /** eelMoveToCeil (0x63528): up to its sector's ceiling; there, asleep (idle, no flags) */
  eelMoveToCeil () {
    const s = this.sprite
    if (s.z - this.tz < 0x1000) {
      this.active = false
      s.flags = 0
      this.aiNewState(EEL.idle)
    } else this.aiSetTargetPlace(s.x, s.y, this.level.sectors[s.sectnum].ceilingz)
  },

  /** BiteSeqCallback (0x61cf8): a bite (vector 7) along its facing, at the target's eye height against its own */
  eelBite () {
    const s = this.sprite, trig = this.level.trig
    const t = this.level.sprites[this.target]
    if (!t || this.target < 0) return
    const ti = this.dudes.tables.dudeInfo[t.type] || { eyeHeight: 0 }
    const dz = ((t.yrepeat * ti.eyeHeight) << 2) - ((s.yrepeat * this.info.eyeHeight) << 2)
    this.game.combat.fireVector(s, 0, 0, trig.Cos(s.ang) >> 16, trig.Sin(s.ang) >> 16, dz, 7)
  }
}
