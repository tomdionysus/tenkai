// The game on the server: a level, its players, and Blood's frame (30 a second): busy motions, events, the players'
// input and movement, the sprites. What the clients are told comes from here (see ../net/), and nothing of it is
// decided on a client.
import Level from './Level.mjs'
import Player, { KEY } from './Player.mjs'
import Triggers, { CMD, STAT, SECTOR_TYPE } from './triggers.mjs'
import { approxDist, linkSectors } from './physics.mjs'
import Seqs from './seq.mjs'
import Combat from './combat.mjs'
import Pickups from './pickups.mjs'
import Weapons from './weapons.mjs'
import Missiles from './missiles.mjs'
import Dudes from './dudes.mjs'
import Random from './random.mjs'
import Things from './things.mjs'
import Effects from './fx.mjs'

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
    this.random = new Random(this.options.seed || ((Date.now() * 2654435761) >>> 0))
    this.clock = 0
    // Blood's gFrame: monsters think when (gFrame & 3) matches their sprite's (& 3); the original's ran 2 ahead of
    // its demo's tick count (fidelity/random.mjs)
    this.frame = this.options.frame || 0
    this.players = []
    this.events = [] // what happened this tick, for the clients: sounds, messages
    this.changedSectors = new Set()
    this.changedWalls = new Set()
    this.secrets = { total: 0, found: 0 }
    this.ended = null
    this.triggers = new Triggers(this)
    this.seqs = new Seqs(this.level, res.seqs)
    this.filterSprites()
    if (this.options.monsters === false) for (const sp of this.level.sprites) if (sp.statnum === STAT.dude && sp.type >= 201 && sp.type < 300 && !(sp.type >= 231 && sp.type <= 238)) this.level.remove(sp)
    this.hideMarkers()
    linkSectors(this.level)
    this.takeStarts()
    this.triggers.init()
    this.combat = new Combat(this)
    this.pickups = new Pickups(this)
    this.missiles = new Missiles(this)
    this.things = new Things(this)
    this.fx = new Effects(this)
    this.kills = 0
    this.burning = []
    this.respawns = []
    this.dudes = new Dudes(this)
    this.initGenerators()
    this.startSeqs()
    this.started = false
  }

  /**
   * The sprites this game has (Blood's dbInit): each extra says at which skills and in which kinds of game it is
   * left out (lSkill a bit a skill; lS single, lB Bloodbath, lC co-op)
   */
  filterSprites () {
    const level = this.level, skill = this.options.difficulty, type = this.options.gameType
    for (const s of level.sprites) {
      const x = level.x(s)
      if (!x || s.statnum >= 1024) continue
      if ((x.lSkill & (1 << skill)) || (x.lS && type === 0) || (x.lB && type === 2) || (x.lC && type === 1)) level.remove(s)
    }
  }

  /**
   * Blood's generators (types 700-708): on, they repeat every busyTime tenths of a second, give or take a random
   * data1 (Random2), sending their command and doing their thing: a drip of water or blood falls, a sound plays.
   * Started at load when their state is not their rest state (InitGenerator)
   */
  initGenerators () {
    const level = this.level
    for (const s of level.sprites) {
      if (s.statnum >= 1024 || s.type < 700 || s.type > 708) continue
      const x = level.x(s)
      if (!x) continue
      if (s.type === 700) s.cstat = (s.cstat & ~1) | 32768
      if (x.state !== x.restState && x.busyTime > 0) this.triggers.post(s.index, 3, Math.trunc(120 * (x.busyTime + this.random.Random2(x.data1)) / 10), 21)
    }
  }

  /** The sprite types the game itself handles when a channel or an event reaches them (Blood's OperateSprite) */
  operateSprite (s, x, event) {
    // Gib objects (Blood's OperateSprite: the map's objects that break, the bits, the bodies, the head): off, on or
    // a toggle breaks them (actActivateGibObject), if their state changes
    if (s.type === 416 || s.type === 417 || s.type === 425 || s.type === 426 || s.type === 427) {
      const state = event.cmd === CMD.off ? 0 : event.cmd === CMD.on ? 1 : x.state ^ 1
      if (this.triggers.setSpriteState(s, x, state)) this.things.activateGibObject(s, x)
      return true
    }
    if (s.type >= 700 && s.type <= 708) {
      if (event.cmd === 0) { this.triggers.setSpriteState(s, x, 0); return true }
      if (event.cmd === 21) { // kCmdRepeat
        if (s.type !== 700) this.generate(s, x)
        if (x.txID) this.triggers.send(s.index, 3, x.txID, x.command)
        if (x.busyTime > 0) this.triggers.post(s.index, 3, Math.trunc(120 * (this.random.Random2(x.data1) + x.busyTime) / 10), 21)
        return true
      }
      if (!x.state) { this.triggers.setSpriteState(s, x, 1); this.triggers.post(s.index, 3, 0, 21) }
      return true
    }
    // A monster told to wake (on) or to die (off: Blood kills it)
    if (s.statnum === STAT.dude && this.dudes && this.dudes.of(s)) {
      const d = this.dudes.of(s)
      if (event.cmd === 1 && (d.stateName === 'idle' || d.stateName === 'buried' || d.stateName === 'laying')) { d.activate(); return true }
      if (event.cmd === 0) { d.damaged(null, 0, 1 << 15); return true }
      return true
    }
    return false
  }

  /** Blood's ActivateGenerator */
  generate (s, x) {
    if (s.type === 701 || s.type === 702) {
      const { bottom } = this.level.extents(s)
      this.missiles.drip(s, bottom, s.type === 702)
    } else if (s.type === 706 || s.type === 707) {
      // Bubbles (Blood's ActivateGenerator: an effect, one or a cluster, at the sprite's top)
      const { top } = this.level.extents(s)
      this.fx.spawn(s.type === 706 ? 23 : 26, s.sectnum, s.x, s.y, top, 0)
    } else if (s.type === 708) this.sound(s, x.data2)
  }

  /** Sprites that show a sequence from the start (Blood's seqSpawn at load for things that animate by sequence) */
  startSeqs () {}

  /** Blood hides its markers and the sprites only the editor shows when a level loads */
  hideMarkers () {
    for (const s of this.level.sprites) {
      if (s.statnum === STAT.marker || s.statnum === STAT.pathMarker || (s.type >= 1 && s.type <= 15)) s.cstat |= 32768
      // The exploder trap (459) is unseen until it goes off (Blood's actInit)
      if (s.type === 459) { s.cstat |= 32768; s.cstat &= ~1 }
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
    let start = starts.find((s) => s.number === number) || starts[number % Math.max(1, starts.length)]
    // In Bloodbath a random start, away from the others if one is (Blood's playerStart picks at random)
    if (this.options.gameType === 2 && starts.length) {
      const clear = starts.filter((z) => !this.players.some((p) => p && p.health > 0 && approxDist(p.sprite.x - z.x, p.sprite.y - z.y) < 1024))
      const from = clear.length ? clear : starts
      start = from[this.random.Random(from.length)]
    }
    const s = level.spawn(start.sectnum, start.x, start.y, start.z, STAT.dude, { cstat: 385, picnum: 3870, pal: 11 + (number & 3), clipdist: 48, xrepeat: 39, yrepeat: 37, ang: start.ang, type: 231 + number, shade: -8, flags: 2 })
    const fz = level.engine.getflorzofslope(s.sectnum, s.x, s.y)
    s.z += fz - level.extents(s).bottom
    const p = new Player(level, s, number)
    p.game = this
    p.hitWall = (nWall) => this.wallBump(p, nWall)
    p.weaponState = new Weapons(this, p)
    p.start = start
    p.seqs = this.seqs
    this.seqs.spawn(s, p.seqBase)
    this.players[number] = p
    this.triggers.relisten()
    return p
  }

  /** A player leaves: their body goes */
  removePlayer (number) {
    const p = this.players[number]
    if (!p) return
    this.seqs.kill(p.sprite)
    this.level.remove(p.sprite)
    this.players[number] = null
  }

  /** The level after this one, by BLOOD.INI's EndingA (normal) and EndingB (secret), in the same episode */
  nextMap () {
    const info = this.level.info
    const n = Number(this.ended && this.ended.secret ? info.endingb : info.endinga)
    const episode = this.level.name.match(/^e(\d+)m/)
    if (!n || !episode) return null
    const name = 'e' + episode[1] + 'm' + n
    return this.res.ini[name] ? name : null
  }

  playerOf (sprite) { return this.players.find((p) => p && p.sprite === sprite) || null }

  /** One frame of the game (Blood's ProcessFrame), with each player's input for it */
  tick () {
    if (!this.started) { this.triggers.start(this.options.gameType); this.started = true }
    this.events = []
    // Blood's CalcGameChecksum every eight frames (the network's sync check), whose first word is a draw of the
    // game's rand(): the original's draws match the remake's only with it (fidelity/randlog.mjs)
    if ((this.frame & 7) === 0) this.random.rand()
    // Blood's ProcessFrame: the players' input and weapons first, then the busy sectors, the events, the sequences,
    // then the sprites (actProcessSprites): things, missiles, explosions, the dudes' moves (the players' among them),
    // the dudes' minds (aiProcessDudes), the effects
    for (const p of this.players) if (p) this.playerTick(p)
    this.triggers.processBusy()
    this.triggers.processEvents()
    this.seqs.process(CLOCK_PER_TICK)
    this.things.tick()
    this.missiles.tick()
    this.things.explosionsTick()
    for (const p of this.players) if (p) this.playerMove(p)
    for (const p of this.players) if (p && p.health > 0) this.pickups.check(p)
    this.dudes.move()
    this.dudes.think()
    this.fx.process()
    this.burn()
    this.respawnItems()
    this.frame++
    this.clock += CLOCK_PER_TICK
  }

  playerTick (p) {
    // The input a client holds, with the presses it made since the last tick (server/index.mjs latches them)
    if (p.held) {
      const l = p.latched || {}
      p.input = Object.assign({}, p.held, { buttons: p.held.buttons | (l.buttons || 0), keys: p.held.keys | (l.keys || 0), use: p.held.use | (l.use || 0), newWeapon: p.held.newWeapon || l.newWeapon || 0 })
      p.latched = { buttons: 0, keys: 0, use: 0, newWeapon: 0 }
    }
    p.tick(p.input)
    if (p.input.keys & KEY.action) this.action(p)
  }

  /** A player's move for the tick, and the sectors it leaves and enters */
  playerMove (p) {
    const before = p.sprite.sectnum
    p.changedSector = null
    p.move()
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

  /** A player back after dying: at a start, with the pitchfork */
  respawn (p) {
    const number = p.number
    this.removePlayer(number)
    const np = this.addPlayer(number)
    np.name = p.name
    np.deaths = p.deaths
    np.frags = p.frags
    np.kills = p.kills
    np.input = p.input
    return np
  }

  // --- burning, drops, items coming back ---
  burn (target, source, ticks) {
    if (target) {
      const b = this.burning.find((b) => b.sprite === target)
      if (b) b.ticks = Math.max(b.ticks, ticks)
      else this.burning.push({ sprite: target, source, ticks })
      return
    }
    for (const b of this.burning.slice()) {
      if (--b.ticks <= 0 || b.sprite.statnum >= 1024) { this.burning.splice(this.burning.indexOf(b), 1); continue }
      if (this.frame % 8 === 0) this.combat.damage(b.source, b.sprite, 1, 2 << 4)
    }
  }

  /** A dude's drop (its xsprite's dropMsg: an item type) where it fell */
  drop (s, type) {
    const tables = this.res.tables
    const t = tables.weaponItems[type] || tables.ammoItems[type] || tables.items[type]
    if (!t || t.picnum <= 0) return
    const item = this.level.spawn(s.sectnum, s.x, s.y, s.z, STAT.item, { picnum: t.picnum, xrepeat: t.xrepeat, yrepeat: t.yrepeat, shade: t.shade, pal: t.pal, type, cstat: 0 })
    const fz = this.level.engine.getflorzofslope(item.sectnum, item.x, item.y)
    item.z = fz - (this.level.extents(item).bottom - item.z)
  }

  respawnLater (item, seconds) {
    const keep = Object.assign({}, item)
    this.level.remove(item)
    this.respawns.push({ at: this.frame + seconds * 30, keep })
  }

  respawnItems () {
    for (const r of this.respawns.slice()) {
      if (r.at > this.frame) continue
      const k = r.keep
      this.level.spawn(k.sectnum, k.x, k.y, k.z, STAT.item, { picnum: k.picnum, xrepeat: k.xrepeat, yrepeat: k.yrepeat, shade: k.shade, pal: k.pal, type: k.type, cstat: k.cstat, extra: k.extra })
      this.respawns.splice(this.respawns.indexOf(r), 1)
    }
  }

  effect (e) {
    const at = { x: e.x, y: e.y, z: e.z, sectnum: e.sectnum }
    if (at.sectnum >= 0) this.missiles.effect(at, e.type === 'blood' ? 59 : 44)
  }

  shake (p, amount) { p.shakeAmount = Math.max(p.shakeAmount, amount) }
  shakeNear (s, amount) {
    for (const p of this.players) if (p && approxDist(p.sprite.x - s.x, p.sprite.y - s.y) < 0x2000) this.shake(p, amount)
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
  endLevel (secret) {
    if (this.ended) return
    this.ended = { secret, frame: this.frame }
    this.message(null, secret ? 'Secret level!' : 'Level complete')
    this.sound(null, 3008)
  }
  totalSecrets (n) { this.secrets.total = n }
  /** Blood's CSecretMgr::Found: counted, and in single player one of two messages, chosen by a draw */
  secret (cmd) {
    this.secrets.found++
    if ((this.options.gameType || 0) === 0) this.message(null, this.random.Random(2) ? 'You found a secret.' : 'A secret is revealed.')
  }
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
