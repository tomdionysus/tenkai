// The game on the server: a level, its players, and Blood's frame (30 a second): busy motions, events, the players'
// input and movement, the sprites. What the clients are told comes from here (see ../net/), and nothing of it is
// decided on a client.
import Level from './Level.mjs'
import Player, { KEY } from './Player.mjs'
import Triggers, { CMD, STAT, SECTOR_TYPE } from './triggers.mjs'
import { approxDist, linkSectors } from './physics.mjs'
import Seqs from './seq.mjs'

export const TICK_RATE = 30
export const CLOCK_PER_TICK = 4

export default class Game {
  /**
   * @param {Resources} res
   * @param {object} options { map: 'e1m1', gameType: 0 single, 1 co-op, 2 Bloodbath; difficulty 0-4 }
   */
  constructor (res, options = {}) {
    this.res = res
    this.options = Object.assign({ map: 'e1m1', gameType: 0, difficulty: 2 }, options)
    this.level = new Level(res, this.options.map)
    this.clock = 0
    this.frame = 0
    this.players = []
    this.events = [] // what happened this tick, for the clients: sounds, messages
    this.changedSectors = new Set()
    this.changedWalls = new Set()
    this.secrets = { total: 0, found: 0 }
    this.ended = null
    this.triggers = new Triggers(this)
    this.seqs = new Seqs(this.level, res.seqs)
    this.hideMarkers()
    linkSectors(this.level)
    this.takeStarts()
    this.triggers.init()
    this.started = false
  }

  /** Blood hides its markers and the sprites only the editor shows when a level loads */
  hideMarkers () {
    for (const s of this.level.sprites) {
      if (s.statnum === STAT.marker || s.statnum === STAT.pathMarker || (s.type >= 1 && s.type <= 15)) s.cstat |= 32768
    }
  }

  /** Blood keeps the start markers as zones and deletes the sprites (warpInit) */
  takeStarts () {
    const level = this.level
    this.starts = { single: [], bloodbath: [] }
    for (const s of level.sprites) {
      const x = level.x(s)
      if (s.statnum >= 1024 || !x || (s.type !== 1 && s.type !== 2)) continue
      const zone = { x: s.x, y: s.y, z: s.z, sectnum: s.sectnum, ang: s.ang, number: x.data1 }
      ;(s.type === 1 ? this.starts.single : this.starts.bloodbath).push(zone)
      level.remove(s)
    }
  }

  /** A player joins: at the start for their number (a Bloodbath start in Bloodbath) */
  addPlayer (number = this.players.length) {
    const level = this.level
    const starts = this.options.gameType === 2 ? this.starts.bloodbath : this.starts.single
    const start = starts.find((s) => s.number === number) || starts[number % Math.max(1, starts.length)]
    const s = level.spawn(start.sectnum, start.x, start.y, start.z, STAT.dude, { cstat: 385, picnum: 3870, pal: 11 + (number & 3), clipdist: 48, xrepeat: 39, yrepeat: 37, ang: start.ang, type: 231 + number, shade: -8, flags: 2 })
    const fz = level.engine.getflorzofslope(s.sectnum, s.x, s.y)
    s.z += fz - level.extents(s).bottom
    const p = new Player(level, s, number)
    p.game = this
    p.hitWall = (nWall) => this.wallBump(p, nWall)
    p.seqs = this.seqs
    this.seqs.spawn(s, p.seqBase)
    this.players[number] = p
    this.triggers.relisten()
    return p
  }

  playerOf (sprite) { return this.players.find((p) => p && p.sprite === sprite) || null }

  /** One frame of the game (Blood's ProcessFrame), with each player's input for it */
  tick () {
    if (!this.started) { this.triggers.start(this.options.gameType); this.started = true }
    this.events = []
    this.triggers.processBusy()
    this.triggers.processEvents()
    this.seqs.process(CLOCK_PER_TICK)
    for (const p of this.players) if (p) this.playerTick(p)
    this.frame++
    this.clock += CLOCK_PER_TICK
  }

  playerTick (p) {
    const before = p.sprite.sectnum
    p.changedSector = null
    p.tick(p.input)
    if (p.input.keys & KEY.action) this.action(p)
    if (p.changedSector) this.sectorChange(p.sprite, p.changedSector.from, p.changedSector.to, p)
    else if (p.sprite.sectnum !== before) this.sectorChange(p.sprite, before, p.sprite.sectnum, p)
  }

  /** Blood's sector exit and enter triggers, as a dude crosses into another sector */
  sectorChange (s, from, to, player) {
    const level = this.level
    const xf = from >= 0 ? level.xs(from) : null
    if (xf && xf.exit && (player || !xf.dudeLockout)) this.triggers.triggerSector(from, CMD.sectorExit)
    const xt = to >= 0 ? level.xs(to) : null
    if (xt && xt.enter && (player || !xt.dudeLockout)) {
      if (level.sectors[to].type === SECTOR_TYPE.teleport) xt.data = player ? s.index : -1
      this.triggers.triggerSector(to, CMD.sectorEnter)
    }
  }

  /**
   * A player ran into a wall: a sector beyond it that opens by being pushed against (wallPush, as E1M1's gate) is
   * triggered, unless it needs a key or is moving (found from the original: its gate turns two ticks after the
   * player first meets it, and the player's further bumps do not turn it back)
   */
  wallBump (p, nWall) {
    const w = this.level.walls[nWall]
    if (w.nextsector < 0) return
    const x = this.level.xs(w.nextsector)
    if (x && x.wallPush && !x.key && !(x.busy & 0xffff)) this.triggers.triggerSector(w.nextsector, CMD.sectorPush)
  }

  /** The action key: the sector, wall or sprite the player faces, pushed (Blood: a hitscan of 64 units ahead) */
  action (p) {
    const level = this.level, s = p.sprite
    const near = level.engine.neartag(s.x, s.y, p.zView, s.sectnum, s.ang, 64 << 4, 3, (o, kind, i) => {
      const x = kind === 'sector' ? level.xs(i) : kind === 'wall' ? level.xw(i) : level.x(o)
      return x && (kind === 'sector' ? x.push : kind === 'wall' ? x.push : x.push)
    })
    if (near.sprite >= 0) return this.push(p, 'sprite', near.sprite)
    if (near.wall >= 0) return this.push(p, 'wall', near.wall)
    if (near.sector >= 0) return this.push(p, 'sector', near.sector)
    // The sector the player stands in, if it takes a push
    const xs = level.xs(s.sectnum)
    if (xs && xs.push) return this.push(p, 'sector', s.sectnum)
  }

  push (p, kind, i) {
    const level = this.level
    const x = kind === 'sector' ? level.xs(i) : kind === 'wall' ? level.xw(i) : level.x(level.sprites[i])
    if (x.key && !p.keys[x.key]) {
      this.message(p, 'That requires a key.')
      this.sound(p.sprite, 3062)
      return
    }
    if (x.locked) { this.sound(p.sprite, 3062); return }
    if (kind === 'sector') this.triggers.triggerSector(i, CMD.sectorPush)
    else if (kind === 'wall') this.triggers.triggerWall(i, CMD.wallPush)
    else this.triggers.triggerSprite(i, CMD.spritePush)
  }

  // --- what the triggers call back ---
  changedSector (n) { this.changedSectors.add(n) }
  changedSprite (s) {}
  sound (sprite, id, at) { if (id > 0) this.events.push({ type: 'sound', id, sprite: sprite ? sprite.index : -1, x: sprite ? sprite.x : at && at.x, y: sprite ? sprite.y : at && at.y, z: sprite ? sprite.z : at && at.z }) }
  sectorSound (nSector, state, ending) {
    // A sector's sounds come from the sound sprites in it (type 709: data1 opening, data2 closing, data3 and data4 at the end)
    for (const i of this.level.engine.spritesIn(nSector)) {
      const s = this.level.sprites[i], x = this.level.x(s)
      if (s.type !== 709 || !x) continue
      const id = ending ? (state ? x.data3 : x.data4) : (state ? x.data2 : x.data1)
      this.sound(s, id)
    }
  }

  message (player, text) { if (text) this.events.push({ type: 'message', text, player: player === null ? -1 : (player && player.number) }) }
  endLevel (secret) { if (!this.ended) this.ended = { secret, frame: this.frame } }
  totalSecrets (n) { this.secrets.total = n }
  secret (cmd) { this.secrets.found++; this.message(null, 'A secret is revealed.') }
  breakWall (nWall) {
    const w = this.level.walls[nWall]
    w.cstat &= ~(1 | 16 | 64 | 256)
    if (w.nextwall >= 0) this.level.walls[w.nextwall].cstat &= ~(1 | 16 | 64 | 256)
    this.changedWalls.add(nWall)
    this.sound(null, 1104, { x: w.x, y: w.y, z: this.level.sectors[this.sectorOfWall(nWall)].floorz })
  }

  sectorOfWall (nWall) { return this.level.sectors.findIndex((s) => nWall >= s.wallptr && nWall < s.wallptr + s.wallnum) }
  distance (a, b) { return approxDist(a.x - b.x, a.y - b.y) }
}
