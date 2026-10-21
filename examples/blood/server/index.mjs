// Blood's server: the game (server/game, no Tenkai) run at Blood's 30 ticks a second, its players joined over
// WebSockets at /game, each told the state that concerns them every tick as a patch on the last (the protocol of
// Tenkai's GameClient: join, input, command, act in; welcome, tick, refused out). It also serves the client's page,
// bundle and data/, so one process is the whole game for a browser.
//   node server/index.mjs [--port 8053] [--map e1m1] [--mode coop|bloodbath] [--difficulty 2]
import http from 'http'
import fs from 'fs'
import path from 'path'
import { WebSocketServer } from 'ws'
import { Resources } from './game/Level.mjs'
import Game, { TICK_RATE } from './game/Game.mjs'
import { Snapshots } from './net/snapshot.mjs'
import { diff } from './net/diff.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const args = process.argv.slice(2)
const opt = (name, d) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : d }
const PORT = Number(opt('port', process.env.PORT || 8053))
const MODE = { single: 0, coop: 1, bloodbath: 2 }[opt('mode', 'coop')] ?? 1
const MAX_PLAYERS = 8
const CHEATS = args.includes('--cheats')

const res = new Resources()
let game = null, snaps = null
const clients = new Set()
// A connection's player, by number (a respawn or a new level makes a new Player; the number stays)
const playerOf = (c) => c.number >= 0 && game ? game.players[c.number] || null : null

const MONSTERS = opt('monsters', MODE === 2 ? 'off' : 'on') !== 'off'
function newGame (map) {
  for (const c of clients) c.carried = playerOf(c)
  game = new Game(res, { map, gameType: MODE, difficulty: Number(opt('difficulty', 2)), monsters: MONSTERS })
  snaps = new Snapshots(game)
  for (const c of clients) {
    const old = c.carried
    if (!old) continue
    const p = game.addPlayer(c.number)
    // Into the next level with what they carried (Blood keeps the weapons and ammo; the keys stay behind)
    Object.assign(p, { name: old.name, frags: old.frags, deaths: old.deaths, ammo: old.ammo, weapons: old.weapons, armor: old.armor, pack: old.pack })
    if (old.health > 0) p.health = old.health
  }
  console.log('level', map, '"' + (game.level.info.title || '') + '"')
}
newGame(opt('map', 'e1m1'))

// --- the page, its bundle and data ---
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.css': 'text/css' }
const server = http.createServer((req, res2) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  let file = path.normalize(path.join(ROOT, url === '/' ? 'index.html' : url))
  if (!file.startsWith(ROOT) || /\/(original|server|fidelity|tools|formats|TODO|node_modules)\//.test(file.slice(ROOT.length) + '/')) { res2.writeHead(404); return res2.end() }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res2.writeHead(404); return res2.end('not found') }
    res2.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
    fs.createReadStream(file).pipe(res2)
  })
})

// --- the players ---
const wss = new WebSocketServer({ server, path: '/game' })
wss.on('connection', (socket) => {
  const client = { socket, number: -1, last: null, name: '', get player () { return playerOf(this) } }
  clients.add(client)
  socket.on('message', (data) => {
    let m
    try { m = JSON.parse(data) } catch (e) { return }
    if (m.type === 'join') {
      const taken = new Set([...clients].filter((c) => c.number >= 0).map((c) => c.number))
      let number = 0
      while (taken.has(number)) number++
      if (number >= MAX_PLAYERS) return send(client, { type: 'refused', reason: 'The game is full.' })
      client.name = String(m.name || 'Caleb').slice(0, 16)
      client.number = number
      game.addPlayer(number).name = client.name
      game.message(null, client.name + ' has joined')
      const state = snaps.forPlayer(snaps.world(), client.player)
      client.last = state
      send(client, { type: 'welcome', player: { number, name: client.name }, state, tick: game.frame })
      console.log(client.name, 'joined as player', number + 1)
    } else if (m.type === 'input' && client.player) {
      const p = client.player
      const input = sanitize(m.input)
      // A press is kept until a tick has seen it: a tap of fire, jump or open between two ticks is not lost
      p.latched = p.latched || { buttons: 0, keys: 0, use: 0, newWeapon: 0 }
      p.latched.buttons |= input.buttons
      p.latched.keys |= input.keys
      p.latched.use |= input.use
      if (input.newWeapon) p.latched.newWeapon = input.newWeapon
      p.held = input
      // The client numbers its inputs; each tick says the last one the game has taken (for prediction on the client)
      client.player.inputSeq = Math.trunc(Number(m.input && m.input.seq) || 0)
    } else if (m.type === 'act' && client.player && CHEATS) {
      // Testing only (--cheats): put the player somewhere, give them everything
      const a = m.action || {}
      const p = client.player, sp = p.sprite
      if (a.warp) {
        const sect = game.level.engine.updatesector(a.warp.x, a.warp.y, sp.sectnum)
        if (sect >= 0) {
          sp.x = a.warp.x; sp.y = a.warp.y; sp.sectnum = sect; sp.xvel = sp.yvel = sp.zvel = 0
          sp.z = game.level.engine.getflorzofslope(sect, sp.x, sp.y) - (game.level.extents(sp).bottom - sp.z)
          if (a.warp.ang !== undefined) p.ang = sp.ang = a.warp.ang
          p.teleported(p.ang)
          game.level.touched()
        }
      }
      if (a.give) { for (let w = 1; w <= 7; w++) p.weapons[w] = true; p.ammo = p.ammo.map((_, i) => i ? 99 : 0); p.armor = [100, 100, 100] }
      if (a.god !== undefined) p.godMode = !!a.god
    } else if (m.type === 'leave' && client.player) {
      game.removePlayer(client.number)
      client.number = -1
    }
  })
  socket.on('close', () => {
    clients.delete(client)
    if (client.player) { game.removePlayer(client.number); console.log(client.name, 'left') }
  })
})

/** A client's input, kept to what the game reads, in its ranges */
function sanitize (i = {}) {
  const n = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.trunc(Number(v) || 0)))
  return {
    run: i.run ? 1 : 0, forward: n(i.forward, -2048, 2048), strafe: n(i.strafe, -2048, 2048), turn: n(i.turn, -1024, 1024),
    ang: i.ang === undefined ? undefined : n(i.ang, 0, 2047), horiz: i.horiz === undefined ? undefined : n(i.horiz, 0, 200),
    buttons: n(i.buttons, 0, 0xffff), keys: n(i.keys, 0, 0xffff), use: n(i.use, 0, 0xff), newWeapon: n(i.newWeapon, 0, 13), mlook: 0
  }
}

function send (client, message) {
  if (client.socket.readyState === 1) client.socket.send(JSON.stringify(message))
}

// --- the clock: Blood's 30 ticks a second, kept to wall time ---
const STEP = 1000 / TICK_RATE
let next = Date.now()
function loop () {
  const now = Date.now()
  let steps = 0
  // The level waits for its first player (Blood starts a level when the player enters it)
  if (![...clients].some((c) => c.number >= 0)) next = now
  while (now >= next && steps < 5) {
    game.tick()
    broadcast()
    // The end of a level: its tally held for five seconds, then the next level (or the first again)
    if (game.ended && game.frame - game.ended.frame > 5 * TICK_RATE) newGame(game.nextMap() || 'e1m1')
    next += STEP
    steps++
  }
  if (now - next > 1000) next = now
  setTimeout(loop, Math.max(0, next - Date.now()))
}

function broadcast () {
  const world = snaps.world()
  for (const c of clients) {
    if (!c.player) continue
    const state = snaps.forPlayer(world, c.player)
    const events = game.events.filter((e) => e.player === undefined || e.player === -1 || e.player === c.player.number)
    const delta = diff(c.last, state)
    c.last = state
    send(c, { type: 'tick', tick: game.frame, delta, events })
  }
}

server.listen(PORT, () => {
  console.log('Blood server on http://127.0.0.1:' + PORT + '/ (game at ws://.../game), mode', ['single', 'coop', 'bloodbath'][MODE])
  loop()
})
