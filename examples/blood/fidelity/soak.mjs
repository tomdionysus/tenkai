// Every map run by the server with a random player (moving, turning, jumping, firing every weapon, opening) for a
// while, to find what throws: the game's own Monte-Carlo, no original needed.
//   node fidelity/soak.mjs [ticks] [maps...]
import { Resources } from '../server/game/Level.mjs'
import Game from '../server/game/Game.mjs'

const [ticksArg = '1800', ...mapsArg] = process.argv.slice(2)
const res = new Resources()
const maps = mapsArg.length ? mapsArg : ['e1m1', 'e1m2', 'e1m3', 'e1m4', 'e1m5', 'e1m6', 'e1m7', 'e1m8']
let seed = 12345
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000 }
let failures = 0
for (const map of maps) {
  for (const difficulty of [2, 4]) {
    const game = new Game(res, { map, difficulty, gameType: 0, seed: 7 })
    const p = game.addPlayer(0)
    for (let w = 1; w <= 7; w++) p.weapons[w] = true
    p.ammo = p.ammo.map((_, i) => (i ? 200 : 0))
    let input = {}
    const t0 = Date.now()
    try {
      for (let t = 0; t < Number(ticksArg); t++) {
        if (t % 20 === 0) input = { run: 1, forward: [2048, 1024, 0, -1024][Math.floor(rnd() * 4)], strafe: [0, 2048, -2048][Math.floor(rnd() * 3)], turn: Math.floor(rnd() * 200 - 100), buttons: (rnd() < 0.5 ? 4 : 0) | (rnd() < 0.1 ? 1 : 0) | (rnd() < 0.1 ? 8 : 0), keys: rnd() < 0.2 ? 1 : 0, newWeapon: rnd() < 0.1 ? 1 + Math.floor(rnd() * 7) : 0 }
        p.input = input
        game.tick()
        if (game.players[0] !== p && game.players[0]) { /* respawned */ }
      }
      const ms = Date.now() - t0
      console.log(map, 'skill', difficulty, 'ok:', ticksArg, 'ticks in', ms + 'ms (' + (ms / Number(ticksArg)).toFixed(2) + ' ms a tick); monsters left', game.dudes.list.length + '/' + game.dudes.total, 'kills', game.kills, 'player health', p.health >> 4)
    } catch (e) {
      failures++
      console.log(map, 'skill', difficulty, 'FAILED:', e.stack.split('\n').slice(0, 4).join(' | '))
    }
  }
}
process.exit(failures ? 1 : 0)
