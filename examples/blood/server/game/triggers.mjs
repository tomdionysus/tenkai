// Blood's triggers: the channels objects talk on (txID to rxID), the commands they send, the events posted for
// later, and the "busy" motions that carry a sector from one state to the other (doors, lifts, sliding and rotating
// sectors). As Blood's eventq.cpp and triggers.cpp, for the sector, wall and sprite types the shareware's maps use.
//
// Times: Blood's clock runs at 120 a second and a game tick is 4 of it; busy and wait times in the maps are tenths
// of a second.
import { mulscale, dmulscale } from '../../common/engine.mjs'

export const CMD = {
  off: 0, on: 1, state: 2, toggle: 3, notState: 4, link: 5, lock: 6, unlock: 7, toggleLock: 8, stopOff: 9, stopOn: 10, stopNext: 11,
  callback: 20, repeat: 21,
  spritePush: 30, spriteImpact: 31, spritePickup: 32, spriteTouch: 33, spriteSight: 34, spriteProximity: 35, spriteExplode: 36,
  sectorPush: 40, sectorImpact: 41, sectorEnter: 42, sectorExit: 43,
  wallPush: 50, wallImpact: 51, wallTouch: 52,
  numeric: 64
}
export const WALL = 0, SPRITE = 3, SECTOR = 6
// Sector types (found from the maps: which have marked walls, which have one marker or two, which hurt; Blood's own
// numbering, two above the reconstructed source's): 612 follows a path; 613 turns by a step each time; 614 slides its
// marked walls between marker0 and marker1, 616 all its walls; 615 turns its marked walls about marker0, 617 all of
// them; 618 hurts (damageType); 619 counts
export const SECTOR_TYPE = { zMotion: 600, zMotionSprite: 602, warp: 603, teleport: 604, path: 612, rotateStep: 613, slideMarked: 614, rotateMarked: 615, slide: 616, rotate: 617, damage: 618, counter: 619 }
export const CHANNEL = { setTotalSecrets: 1, secretFound: 2, textOver: 3, levelExitNormal: 4, levelExitSecret: 5, levelStart: 7, levelStartMatch: 8, levelStartCoop: 9, levelStartTeams: 10, user: 100 }
export const STAT = { decoration: 0, fx: 1, explosion: 2, item: 3, thing: 4, projectile: 5, dude: 6, inactive: 7, respawn: 8, purge: 9, marker: 10, traps: 11, ambience: 12, spares: 13, flare: 14, debris: 15, pathMarker: 16, free: 1024 }

const BUSY = { vsprite: 1, vdoor: 2, hdoor: 3, rdoor: 4, step: 5, gen: 6 }

export default class Triggers {
  /**
   * @param {object} game The game: { level, clock (120 Hz), sound(sprite|null, id, pos), message(text), endLevel(secret), secret(),
   *   operateSprite(sprite, x, event) for the sprite types the game handles itself (dudes, items, things) }
   */
  constructor (game) {
    this.game = game
    this.level = game.level
    this.events = [] // { time, type, index, cmd, callback }
    this.busy = [] // { index, delta, busy, kind }
    this.base = { walls: this.level.walls.map((w) => ({ x: w.x, y: w.y })), sprites: this.level.sprites.map((s) => ({ x: s.x, y: s.y, z: s.z })) }
    this.byChannel = null
  }

  get trig () { return this.level.trig }
  Cos (a) { return this.trig.Cos(a) }
  Sin (a) { return this.trig.Sin(a) }

  // --- the listeners on each channel ---
  listeners (rx) {
    if (!this.byChannel) {
      this.byChannel = new Map()
      const add = (type, index, x) => {
        if (!x || !x.rxID) return
        let l = this.byChannel.get(x.rxID)
        if (!l) this.byChannel.set(x.rxID, (l = []))
        l.push({ type, index })
      }
      this.level.sectors.forEach((s, i) => add(SECTOR, i, this.level.xs(i)))
      this.level.walls.forEach((w, i) => add(WALL, i, this.level.xw(i)))
      this.level.sprites.forEach((s, i) => { if (s.statnum < STAT.free) add(SPRITE, i, this.level.x(s)) })
    }
    return this.byChannel.get(rx) || []
  }

  /** A sprite was added or freed: the channel lists are made again */
  relisten () { this.byChannel = null }

  // --- events ---
  sourceState (type, index) {
    const x = type === SECTOR ? this.level.xs(index) : type === WALL ? this.level.xw(index) : this.level.x(this.level.sprites[index])
    return x ? x.state : 0
  }

  /** Blood's evSend: a command on a channel, to everything listening (and the channels with meanings of their own) */
  send (index, type, rx, cmd) {
    if (cmd === CMD.state) cmd = this.sourceState(type, index) ? CMD.on : CMD.off
    else if (cmd === CMD.notState) cmd = this.sourceState(type, index) ? CMD.off : CMD.on
    switch (rx) {
      case CHANNEL.textOver: {
        if (cmd >= CMD.numeric) this.game.message(this.levelMessage(cmd - CMD.numeric))
        return
      }
      case CHANNEL.levelExitNormal: this.game.endLevel(false); return
      case CHANNEL.levelExitSecret: this.game.endLevel(true); return
      case CHANNEL.setTotalSecrets: if (cmd >= CMD.numeric) this.game.totalSecrets(cmd - CMD.numeric); return
      case CHANNEL.secretFound: this.game.secret(cmd); return
    }
    if (rx <= 0) return
    for (const l of this.listeners(rx)) this.message(l.type, l.index, { index, type, cmd })
  }

  levelMessage (n) {
    const info = this.level.info
    return info['message' + n] || ''
  }

  /** Blood's evPost: a command for an object, `delay` clock ticks (120 a second) from now */
  post (index, type, delay, cmd, callback) {
    this.events.push({ time: this.game.clock + delay, index, type, cmd, callback, seq: this.seq = (this.seq || 0) + 1 })
  }

  /** Blood's evKill: forgets the events posted for an object */
  kill (index, type) { this.events = this.events.filter((e) => !(e.index === index && e.type === type)) }

  /** Blood's evProcess: the events due by now, in the order of their times */
  processEvents () {
    for (;;) {
      let best = -1
      for (let i = 0; i < this.events.length; i++) {
        const e = this.events[i]
        if (e.time > this.game.clock) continue
        if (best < 0 || e.time < this.events[best].time || (e.time === this.events[best].time && e.seq < this.events[best].seq)) best = i
      }
      if (best < 0) return
      const e = this.events.splice(best, 1)[0]
      if (e.cmd === CMD.callback) { if (e.callback) e.callback(e.index, e.type) } else this.message(e.type, e.index, e)
    }
  }

  message (type, index, event) {
    if (type === SECTOR) this.messageSector(index, event)
    else if (type === WALL) this.messageWall(index, event)
    else if (type === SPRITE) this.messageSprite(index, event)
  }

  // --- the triggers, as objects are pushed, entered, touched, shot ---
  triggerSector (nSector, cmd) {
    const x = this.level.xs(nSector)
    if (!x || x.locked || x.isTriggered) return
    if (x.triggerOnce) x.isTriggered = 1
    if (x.decoupled) this.send(nSector, SECTOR, x.txID, x.command)
    else this.messageSector(nSector, { index: nSector, type: SECTOR, cmd })
  }

  triggerWall (nWall, cmd) {
    const x = this.level.xw(nWall)
    if (!x || x.locked || x.isTriggered) return
    if (x.triggerOnce) x.isTriggered = 1
    if (x.decoupled) this.send(nWall, WALL, x.txID, x.command)
    else this.messageWall(nWall, { index: nWall, type: WALL, cmd })
  }

  triggerSprite (nSprite, cmd) {
    const s = this.level.sprites[nSprite], x = this.level.x(s)
    if (!x || x.locked || x.isTriggered) return
    if (x.triggerOnce) x.isTriggered = 1
    if (x.decoupled) this.send(nSprite, SPRITE, x.txID, x.command)
    else this.messageSprite(nSprite, { index: nSprite, type: SPRITE, cmd })
  }

  // --- sectors ---
  messageSector (nSector, event) {
    const x = this.level.xs(nSector)
    if (!x) return
    if (x.locked && event.cmd !== CMD.unlock && event.cmd !== CMD.toggleLock) return
    if (event.cmd === CMD.link) return this.linkSector(nSector, x, event)
    this.operateSector(nSector, x, event.cmd)
  }

  linkSector (nSector, x, event) {
    // A linked sector follows its source's busy value
    const src = event.type === SECTOR ? this.level.xs(event.index) : null
    if (!src) return
    const busy = src.busy
    const kind = this.busyKind(nSector)
    if (kind) this.busyFunction(kind, nSector, busy)
    x.busy = busy
    if ((busy & 0xffff) === 0) this.setSectorState(nSector, x, busy >> 16)
  }

  busyKind (nSector) {
    switch (this.level.sectors[nSector].type) {
      case SECTOR_TYPE.zMotionSprite: return BUSY.vsprite
      case SECTOR_TYPE.zMotion: return BUSY.vdoor
      case SECTOR_TYPE.slideMarked: case SECTOR_TYPE.slide: return BUSY.hdoor
      case SECTOR_TYPE.rotateMarked: case SECTOR_TYPE.rotate: return BUSY.rdoor
      case SECTOR_TYPE.rotateStep: return BUSY.step
      default: return BUSY.gen
    }
  }

  operateSector (nSector, x, cmd) {
    switch (cmd) {
      case CMD.lock: x.locked = 1; return
      case CMD.unlock: x.locked = 0; return
      case CMD.toggleLock: x.locked ^= 1; return
      case CMD.stopOff: x.stopOn = 0; x.stopOff = 1; return
      case CMD.stopOn: x.stopOn = 1; x.stopOff = 0; return
      case CMD.stopNext: x.stopOn = 1; x.stopOff = 1; return
    }
    const type = this.level.sectors[nSector].type
    switch (type) {
      case SECTOR_TYPE.zMotionSprite: return this.operateDoor(nSector, x, cmd, BUSY.vsprite)
      case SECTOR_TYPE.zMotion: return this.operateDoor(nSector, x, cmd, BUSY.vdoor)
      case SECTOR_TYPE.slideMarked: case SECTOR_TYPE.slide: return this.operateDoor(nSector, x, cmd, BUSY.hdoor)
      case SECTOR_TYPE.rotateMarked: case SECTOR_TYPE.rotate: return this.operateDoor(nSector, x, cmd, BUSY.rdoor)
      case SECTOR_TYPE.rotateStep: return this.operateDoor(nSector, x, cmd, BUSY.step)
      case SECTOR_TYPE.teleport: return this.operateTeleport(nSector, x)
      default:
        if (!x.busyTimeA && !x.busyTimeB) {
          if (cmd === CMD.off) this.setSectorState(nSector, x, 0)
          else if (cmd === CMD.on) this.setSectorState(nSector, x, 1)
          else this.setSectorState(nSector, x, x.state ^ 1)
        } else this.operateDoor(nSector, x, cmd, BUSY.gen)
    }
  }

  operateDoor (nSector, x, cmd, kind) {
    const timeA = Math.max(Math.trunc(x.busyTimeA * 120 / 10), 1), timeB = Math.max(Math.trunc(x.busyTimeB * 120 / 10), 1)
    if (cmd === CMD.off) {
      if (!x.busy) return
      this.addBusy(nSector, kind, -Math.trunc(65536 / timeB))
      this.game.sectorSound(nSector, 1)
    } else if (cmd === CMD.on) {
      if (x.busy === 0x10000) return
      this.addBusy(nSector, kind, Math.trunc(65536 / timeA))
      this.game.sectorSound(nSector, 0)
    } else {
      if (x.busy & 0xffff) {
        if (x.interruptable) {
          this.reverseBusy(nSector, kind)
          x.state = x.state ? 0 : 1
        }
      } else {
        const t = !x.state
        this.addBusy(nSector, kind, t ? Math.trunc(65536 / timeA) : -Math.trunc(65536 / timeB))
        this.game.sectorSound(nSector, x.state)
      }
    }
  }

  addBusy (index, kind, delta) {
    const b = this.busy.find((b) => b.index === index && b.kind === kind)
    if (b) { b.delta = delta; return }
    const x = kind === BUSY.gen || kind <= BUSY.rdoor ? this.level.xs(index) : null
    this.busy.push({ index, kind, delta, busy: x ? x.busy : 0 })
  }

  reverseBusy (index, kind) {
    const b = this.busy.find((b) => b.index === index && b.kind === kind)
    if (b) b.delta = -b.delta
  }

  /** Blood's trProcessBusy: each busy motion a step further, by 4 clock ticks */
  processBusy () {
    this.level.velFloor.fill(0)
    this.level.velCeil.fill(0)
    for (let i = this.busy.length - 1; i >= 0; i--) {
      const b = this.busy[i]
      const old = b.busy
      b.busy = Math.max(0, Math.min(65536, old + b.delta * 4))
      const status = this.busyFunction(b.kind, b.index, b.busy)
      if (status === 1) b.busy = old
      else if (status === 2) { b.busy = old; b.delta = -b.delta } else if (status === 3) this.busy.splice(i, 1)
    }
  }

  busyFunction (kind, nSector, busy) {
    const x = this.level.xs(nSector)
    switch (kind) {
      case BUSY.vsprite: return this.vspriteBusy(nSector, x, busy)
      case BUSY.vdoor: return this.vdoorBusy(nSector, x, busy)
      case BUSY.hdoor: return this.hdoorBusy(nSector, x, busy)
      case BUSY.rdoor: return this.rdoorBusy(nSector, x, busy)
      case BUSY.step: return this.stepRotateBusy(nSector, x, busy)
      default: return this.genSectorBusy(nSector, x, busy)
    }
  }

  wave (a, b) {
    switch (b) {
      case 0: return 0x8000 - (this.Cos((a << 10) >> 16) >> 15)
      case 1: return a
      case 2: return 0x10000 - (this.Cos((a << 9) >> 16) >> 14)
      case 3: return this.Sin((a << 9) >> 16) >> 14
    }
    return a
  }

  finishBusy (nSector, x, busy) {
    x.busy = busy
    if (x.command === CMD.link && x.txID) this.send(nSector, SECTOR, x.txID, CMD.link)
    if ((busy & 0xffff) === 0) {
      this.setSectorState(nSector, x, busy >> 16)
      this.game.sectorSound(nSector, busy >> 16, true)
      return 3
    }
    return 0
  }

  vdoorBusy (nSector, x, busy) {
    const wave = x.busy < busy ? x.busyWaveA : x.busyWaveB
    if (!this.crushCheck(nSector, x, busy, wave)) return 1
    this.zTranslate(nSector, x, busy, wave)
    return this.finishBusy(nSector, x, busy)
  }

  vspriteBusy (nSector, x, busy) {
    const wave = x.busy < busy ? x.busyWaveA : x.busyWaveB
    this.zTranslate(nSector, x, busy, wave)
    // Sprites marked to move with the floor (cstat 8192) or the ceiling (16384) go up and down with it
    const dz = mulscale(x.onFloorZ - x.offFloorZ, this.wave(busy, wave), 16) - mulscale(x.onFloorZ - x.offFloorZ, this.wave(x.busy, wave), 16)
    if (dz) for (const i of this.level.engine.spritesIn(nSector)) { const s = this.level.sprites[i]; if (s.cstat & 8192) s.z += dz }
    const dc = mulscale(x.onCeilZ - x.offCeilZ, this.wave(busy, wave), 16) - mulscale(x.onCeilZ - x.offCeilZ, this.wave(x.busy, wave), 16)
    if (dc) for (const i of this.level.engine.spritesIn(nSector)) { const s = this.level.sprites[i]; if (s.cstat & 16384) s.z += dc }
    return this.finishBusy(nSector, x, busy)
  }

  /** Whether a door may move: a door that would crush a dude stops (Blood checks the dudes in it) */
  crushCheck (nSector, x, busy, wave) {
    if (x.crush) return true
    const sec = this.level.sectors[nSector]
    const dc = x.onCeilZ - x.offCeilZ, df = x.onFloorZ - x.offFloorZ
    const cz = dc ? x.offCeilZ + mulscale(dc, this.wave(busy, wave), 16) : sec.ceilingz
    const fz = df ? x.offFloorZ + mulscale(df, this.wave(busy, wave), 16) : sec.floorz
    if (cz <= sec.ceilingz && fz >= sec.floorz) return true
    for (const i of this.level.engine.spritesIn(nSector)) {
      const s = this.level.sprites[i]
      if (s.statnum !== STAT.dude) continue
      const { top, bottom } = this.level.extents(s)
      if (cz > sec.ceilingz && top < cz) return false
      if (fz < sec.floorz && bottom > fz) return false
    }
    return true
  }

  hdoorBusy (nSector, x, busy) {
    const wave = x.busy < busy ? x.busyWaveA : x.busyWaveB
    const m0 = this.level.sprites[x.marker0], m1 = this.level.sprites[x.marker1]
    if (!m0 || !m1) return this.finishBusy(nSector, x, busy)
    this.translateSector(nSector, this.wave(x.busy, wave), this.wave(busy, wave), m0.x, m0.y, m0.x, m0.y, m0.ang, m1.x, m1.y, m1.ang, this.level.sectors[nSector].type === SECTOR_TYPE.slide)
    this.zTranslate(nSector, x, busy, wave)
    return this.finishBusy(nSector, x, busy)
  }

  rdoorBusy (nSector, x, busy) {
    const wave = x.busy < busy ? x.busyWaveA : x.busyWaveB
    const m0 = this.level.sprites[x.marker0]
    if (!m0) return this.finishBusy(nSector, x, busy)
    this.translateSector(nSector, this.wave(x.busy, wave), this.wave(busy, wave), m0.x, m0.y, m0.x, m0.y, 0, m0.x, m0.y, m0.ang, this.level.sectors[nSector].type === SECTOR_TYPE.rotate)
    this.zTranslate(nSector, x, busy, wave)
    return this.finishBusy(nSector, x, busy)
  }

  /** Blood's StepRotateBusy: turns the sector by its marker's angle each time, keeping where it got to in data */
  stepRotateBusy (nSector, x, busy) {
    const m = this.level.sprites[x.marker0]
    if (!m) return this.finishBusy(nSector, x, busy)
    let to
    if (x.busy < busy) {
      to = x.data + m.ang
      this.translateSector(nSector, this.wave(x.busy, x.busyWaveA), this.wave(busy, x.busyWaveA), m.x, m.y, m.x, m.y, x.data, m.x, m.y, to, true)
    } else {
      to = x.data - m.ang
      this.translateSector(nSector, this.wave(x.busy, x.busyWaveB), this.wave(busy, x.busyWaveB), m.x, m.y, m.x, m.y, to, m.x, m.y, x.data, true)
    }
    x.busy = busy
    if (x.command === CMD.link && x.txID) this.send(nSector, SECTOR, x.txID, CMD.link)
    if ((busy & 0xffff) === 0) {
      this.setSectorState(nSector, x, busy >> 16)
      this.game.sectorSound(nSector, busy >> 16, true)
      x.data = to & 2047
      return 3
    }
    return 0
  }

  genSectorBusy (nSector, x, busy) {
    const wave = x.busy < busy ? x.busyWaveA : x.busyWaveB
    this.zTranslate(nSector, x, busy, wave)
    return this.finishBusy(nSector, x, busy)
  }

  /** Blood's ZTranslateSector: the floor and ceiling between their off and on heights, carrying what stands on them */
  zTranslate (nSector, x, busy, wave) {
    const sec = this.level.sectors[nSector], level = this.level
    let dz = x.onFloorZ - x.offFloorZ
    if (dz) {
      const old = sec.floorz
      sec.floorz = x.offFloorZ + mulscale(dz, this.wave(busy, wave), 16)
      level.velFloor[nSector] += (sec.floorz - old) << 8
      for (const i of level.engine.spritesIn(nSector)) {
        const s = level.sprites[i]
        if (s.statnum === STAT.marker || s.statnum === STAT.pathMarker) continue
        const { bottom } = level.extents(s)
        if (s.cstat & 8192) s.z += sec.floorz - old
        else if (s.flags & 2) s.flags |= 4
        else if (old <= bottom && !(s.cstat & 48)) s.z += sec.floorz - old
      }
      this.game.changedSector(nSector)
    }
    dz = x.onCeilZ - x.offCeilZ
    if (dz) {
      const old = sec.ceilingz
      sec.ceilingz = x.offCeilZ + mulscale(dz, this.wave(busy, wave), 16)
      level.velCeil[nSector] += (sec.ceilingz - old) << 8
      for (const i of level.engine.spritesIn(nSector)) {
        const s = level.sprites[i]
        if (s.statnum === STAT.marker || s.statnum === STAT.pathMarker) continue
        if (s.cstat & 16384) s.z += sec.ceilingz - old
      }
      this.game.changedSector(nSector)
    }
  }

  rotatePoint (p, ang, ox, oy) {
    const dx = p.x - ox, dy = p.y - oy
    const c = this.Cos(ang), s = this.Sin(ang)
    p.x = ox + Math.floor((dx * c - dy * s + 2 ** 29) / 2 ** 30)
    p.y = oy + Math.floor((dx * s + dy * c + 2 ** 29) / 2 ** 30)
  }

  /** Blood's TranslateSector: moves (and turns) a sector's walls from their places at load, and what is in it */
  translateSector (nSector, w0, w1, px, py, ax, ay, aang, bx, by, bang, allWalls) {
    const level = this.level, sec = level.sectors[nSector], walls = level.walls
    const ip = (a, b, t) => a + mulscale(b - a, t, 16)
    const x0 = ip(ax, bx, w0), x1 = ip(ax, bx, w1), dx = x1 - x0
    const y0 = ip(ay, by, w0), y1 = ip(ay, by, w1), dy = y1 - y0
    const a0 = ip(aang, bang, w0), a1 = ip(aang, bang, w1), dang = a1 - a0
    const place = (n, sign) => {
      const p = { x: this.base.walls[n].x, y: this.base.walls[n].y }
      if (a1) this.rotatePoint(p, sign * a1, px, py)
      this.dragPoint(n, p.x + sign * (x1 - px), p.y + sign * (y1 - py))
    }
    for (let i = 0, n = sec.wallptr; i < sec.wallnum; i++, n++) {
      const w = walls[n], p2 = w.point2
      if (allWalls) { place(n, 1); continue }
      if (w.cstat & 16384) { place(n, 1); if ((walls[p2].cstat & 49152) === 0) place(p2, 1); continue }
      if (w.cstat & 32768) { place(n, -1); if ((walls[p2].cstat & 49152) === 0) place(p2, -1) }
    }
    const x = level.xs(nSector)
    for (const i of level.engine.spritesIn(nSector)) {
      const s = level.sprites[i]
      if (s.statnum === STAT.marker || s.statnum === STAT.pathMarker) continue
      const base = this.base.sprites[i]
      if (!base) continue
      if (s.cstat & 8192) {
        const p = { x: base.x, y: base.y }
        if (a1) this.rotatePoint(p, a1, px, py)
        s.ang = (s.ang + dang) & 2047
        s.x = p.x + x1 - px; s.y = p.y + y1 - py
      } else if (s.cstat & 16384) {
        const p = { x: base.x, y: base.y }
        if (a1) this.rotatePoint(p, -a1, px, py)
        s.ang = (s.ang - dang) & 2047
        s.x = p.x - (x1 - px); s.y = p.y - (y1 - py)
      } else if (x && x.drag) {
        const { bottom } = level.extents(s)
        const fz = level.engine.getflorzofslope(nSector, s.x, s.y)
        if (!(s.cstat & 48) && fz <= bottom) {
          if (dang) { const p = { x: s.x, y: s.y }; this.rotatePoint(p, dang, x0, y0); s.x = p.x; s.y = p.y }
          s.ang = (s.ang + dang) & 2047
          s.x += dx; s.y += dy
        }
      }
    }
    this.game.changedSector(nSector, true)
  }

  lastWall (n) {
    const walls = this.level.walls
    if (n > 0 && walls[n - 1].point2 === n) return n - 1
    for (let i = n; ; i++) if (walls[i].point2 === n) return i
  }

  /** Build's dragpoint: a vertex moved, with the vertices of the walls that share it */
  dragPoint (n, x, y) {
    const walls = this.level.walls
    walls[n].x = x; walls[n].y = y
    let cnt = walls.length, t = n
    do {
      if (walls[t].nextwall >= 0) {
        t = walls[walls[t].nextwall].point2
        walls[t].x = x; walls[t].y = y
      } else {
        t = n
        do {
          const lw = this.lastWall(t)
          if (walls[lw].nextwall >= 0) {
            t = walls[lw].nextwall
            walls[t].x = x; walls[t].y = y
          } else break
          cnt--
        } while (t !== n && cnt > 0)
        break
      }
      cnt--
    } while (t !== n && cnt > 0)
  }

  setSectorState (nSector, x, state) {
    if ((x.busy & 0xffff) === 0 && x.state === state) return
    x.busy = state << 16
    x.state = state
    this.kill(nSector, SECTOR)
    if (state === 1) {
      if (x.command !== CMD.link && x.triggerOn && x.txID) this.send(nSector, SECTOR, x.txID, x.command)
      if (x.stopOn) { x.stopOn = 0; x.stopOff = 0 } else if (x.reTriggerA) this.post(nSector, SECTOR, Math.trunc(x.waitTimeA * 120 / 10), CMD.off)
    } else {
      if (x.command !== CMD.link && x.triggerOff && x.txID) this.send(nSector, SECTOR, x.txID, x.command)
      if (x.stopOff) { x.stopOn = 0; x.stopOff = 0 } else if (x.reTriggerB) this.post(nSector, SECTOR, Math.trunc(x.waitTimeB * 120 / 10), CMD.on)
    }
    this.game.changedSector(nSector)
  }

  /** Blood's OperateTeleport: every dude in the sector to the marker (a player always; a monster if no dude is there) */
  operateTeleport (nSector, x) {
    const level = this.level
    const dest = level.sprites[x.marker0]
    if (!dest) return
    for (const i of level.engine.spritesIn(nSector).slice()) {
      const s = level.sprites[i]
      if (s.statnum !== STAT.dude) continue
      const player = this.game.playerOf(s)
      if (!player && this.sectorHasDudes(dest.sectnum)) continue
      s.x = dest.x; s.y = dest.y
      s.z += level.sectors[dest.sectnum].floorz - level.sectors[nSector].floorz
      s.ang = dest.ang
      s.sectnum = dest.sectnum
      level.touched()
      s.xvel = s.yvel = s.zvel = 0
      this.game.sound(dest, 201)
      if (player) player.teleported(dest.ang)
    }
  }

  sectorHasDudes (nSector) {
    return this.level.engine.spritesIn(nSector).some((i) => this.level.sprites[i].statnum === STAT.dude)
  }

  // --- walls ---
  messageWall (nWall, event) {
    const x = this.level.xw(nWall)
    if (!x) return
    if (x.locked && event.cmd !== CMD.unlock && event.cmd !== CMD.toggleLock) return
    switch (event.cmd) {
      case CMD.lock: x.locked = 1; return
      case CMD.unlock: x.locked = 0; return
      case CMD.toggleLock: x.locked ^= 1; return
    }
    const w = this.level.walls[nWall]
    if (w.lotag === 511) {
      // Glass that breaks: once on, it no longer blocks or shows
      let changed
      if (event.cmd === CMD.on || event.cmd === CMD.wallImpact) changed = this.setWallState(nWall, x, 1)
      else if (event.cmd === CMD.off) changed = this.setWallState(nWall, x, 0)
      else changed = this.setWallState(nWall, x, x.state ^ 1)
      if (changed && x.state) this.game.breakWall(nWall)
      return
    }
    if (event.cmd === CMD.off) this.setWallState(nWall, x, 0)
    else if (event.cmd === CMD.on) this.setWallState(nWall, x, 1)
    else this.setWallState(nWall, x, x.state ^ 1)
  }

  setWallState (nWall, x, state) {
    if ((x.busy & 0xffff) === 0 && x.state === state) return false
    x.busy = state << 16
    x.state = state
    this.kill(nWall, WALL)
    if (x.restState !== state && x.waitTime > 0) this.post(nWall, WALL, Math.trunc(x.waitTime * 120 / 10), x.restState ? CMD.on : CMD.off)
    if (x.txID) {
      if (x.command !== CMD.link && x.triggerOn && x.state) this.send(nWall, WALL, x.txID, x.command)
      if (x.command !== CMD.link && x.triggerOff && !x.state) this.send(nWall, WALL, x.txID, x.command)
    }
    return true
  }

  // --- sprites ---
  messageSprite (nSprite, event) {
    const s = this.level.sprites[nSprite]
    if (!s || s.statnum === STAT.free) return
    const x = this.level.x(s)
    if (!x) return
    if (x.locked && event.cmd !== CMD.unlock && event.cmd !== CMD.toggleLock) return
    switch (event.cmd) {
      case CMD.lock: x.locked = 1; return
      case CMD.unlock: x.locked = 0; return
      case CMD.toggleLock: x.locked ^= 1; return
    }
    if (this.game.operateSprite && this.game.operateSprite(s, x, event)) return
    switch (s.type) {
      case 20: // toggle switch
        if (event.cmd === CMD.off) { if (this.setSpriteState(s, x, 0)) this.game.sound(s, x.data1) } else if (event.cmd === CMD.on) { if (this.setSpriteState(s, x, 1)) this.game.sound(s, x.data2) } else if (this.setSpriteState(s, x, x.state ^ 1)) this.game.sound(s, x.state ? x.data2 : x.data1)
        return
      case 21: // one-way switch
        if (event.cmd === CMD.off) { if (this.setSpriteState(s, x, 0)) this.game.sound(s, x.data1) } else if (event.cmd === CMD.on) { if (this.setSpriteState(s, x, 1)) this.game.sound(s, x.data2) } else if (this.setSpriteState(s, x, x.restState ^ 1)) this.game.sound(s, x.state ? x.data2 : x.data1)
        return
      case 22: { // combination switch: steps through data1 up to data3, on at data2
        if (event.cmd === CMD.on || event.cmd === CMD.toggle || event.cmd === CMD.spritePush) {
          x.data1 = x.data1 + 1
          if (x.data1 > x.data3) x.data1 = 0
          this.game.sound(s, x.data4 || 0)
          this.setSpriteState(s, x, x.data1 === x.data2 ? 1 : 0)
        }
        return
      }
      default:
        if (event.cmd === CMD.off) this.setSpriteState(s, x, 0)
        else if (event.cmd === CMD.on) this.setSpriteState(s, x, 1)
        else this.setSpriteState(s, x, x.state ^ 1)
    }
  }

  setSpriteState (s, x, state) {
    if ((x.busy & 0xffff) === 0 && x.state === state) return false
    x.busy = state << 16
    x.state = state
    this.kill(s.index, SPRITE)
    if (x.restState !== state && x.waitTime > 0) this.post(s.index, SPRITE, Math.trunc(x.waitTime * 120 / 10), x.restState ? CMD.on : CMD.off)
    if (x.txID) {
      if (x.command !== CMD.link && x.triggerOn && x.state) this.send(s.index, SPRITE, x.txID, x.command)
      if (x.command !== CMD.link && x.triggerOff && !x.state) this.send(s.index, SPRITE, x.txID, x.command)
    }
    this.game.changedSprite(s)
    return true
  }

  // --- the level's start (Blood's trInit) ---
  init () {
    const level = this.level
    for (const x of level.xsectors) x.busy = x.state << 16
    for (const x of level.xwalls) x.busy = x.state << 16
    for (const x of level.xsprites) x.busy = x.state << 16
    level.sectors.forEach((sec, i) => {
      const x = level.xs(i)
      if (!x) return
      switch (sec.type) {
        case SECTOR_TYPE.zMotionSprite: case SECTOR_TYPE.zMotion:
          this.zTranslate(i, x, x.busy, 1)
          break
        case SECTOR_TYPE.slideMarked: case SECTOR_TYPE.slide: {
          const m0 = level.sprites[x.marker0], m1 = level.sprites[x.marker1]
          if (!m0 || !m1) break
          const all = sec.type === SECTOR_TYPE.slide
          this.translateSector(i, 0, -65536, m0.x, m0.y, m0.x, m0.y, m0.ang, m1.x, m1.y, m1.ang, all)
          this.rebase(i)
          this.translateSector(i, 0, x.busy, m0.x, m0.y, m0.x, m0.y, m0.ang, m1.x, m1.y, m1.ang, all)
          this.zTranslate(i, x, x.busy, 1)
          break
        }
        case SECTOR_TYPE.rotateMarked: case SECTOR_TYPE.rotate: {
          const m0 = level.sprites[x.marker0]
          if (!m0) break
          const all = sec.type === SECTOR_TYPE.rotate
          this.translateSector(i, 0, -65536, m0.x, m0.y, m0.x, m0.y, 0, m0.x, m0.y, m0.ang, all)
          this.rebase(i)
          this.translateSector(i, 0, x.busy, m0.x, m0.y, m0.x, m0.y, 0, m0.x, m0.y, m0.ang, all)
          this.zTranslate(i, x, x.busy, 1)
          break
        }
        default:
          if (x.busyTimeA || x.busyTimeB) this.zTranslate(i, x, x.busy, 1)
      }
    })
    level.touched()
  }

  rebase (nSector) {
    const level = this.level, sec = level.sectors[nSector]
    for (let n = sec.wallptr; n < sec.wallptr + sec.wallnum; n++) this.base.walls[n] = { x: level.walls[n].x, y: level.walls[n].y }
    for (const i of level.engine.spritesIn(nSector)) this.base.sprites[i] = { x: level.sprites[i].x, y: level.sprites[i].y, z: level.sprites[i].z }
  }

  /** The events of the level's start: channel 7 to all, then the game type's own */
  start (gameType = 0) {
    this.send(0, 0, CHANNEL.levelStart, CMD.on)
    if (gameType === 1) this.send(0, 0, CHANNEL.levelStartCoop, CMD.on)
    else if (gameType === 2) this.send(0, 0, CHANNEL.levelStartMatch, CMD.on)
  }
}

export { dmulscale }
