// Compares the random draws of the remake with the original's, tick by tick: the trace holds the original's generator
// state (Blood uses Watcom's rand()); the remake, seeded with the original's state at tick 0, counts its own draws.
// Equal counts each tick mean the game asks for chance where the original did.
//   node fidelity/random.mjs <trace.json> [ticks]
import fs from 'fs'
import path from 'path'
import Demo from '../formats/dem.mjs'
import { Resources } from '../server/game/Level.mjs'
import Game from '../server/game/Game.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const step = (v) => (Math.imul(v, 1103515245) + 12345) >>> 0
const [file, ticksArg = '200'] = process.argv.slice(2)
const trace = JSON.parse(fs.readFileSync(file))
const first = trace.samples.findIndex((s) => s.c[0] === 0)
const samples = trace.samples.slice(first)
const seed = samples[0].r
const demo = Demo.load(path.join(ROOT, 'original', trace.demo || 'BLOOD000.DEM'))
// The original's state at tick 0 is before its generators' first draws (Blood's InitGenerator): the remake is seeded
// with it before its level is set up, and makes them likewise
const game = new Game(new Resources(), { map: demo.options.levelName, difficulty: demo.options.difficulty, seed, frame: Number(process.env.FRAME || 0) })
const p = game.addPlayer(0)
// The remake's state after each tick
const states = [game.random.seed]
const counts = []
for (let k = 0; k < Number(ticksArg); k++) {
  const before = game.random.calls
  p.input = demo.inputs[k]
  game.tick()
  counts.push(game.random.calls - before)
  states.push(game.random.seed)
}
// The original's draws between successive samples, against the remake's over the same ticks
const distance = (a, b) => { let v = a, k = 0; while (v !== b && k < 20000) { v = step(v); k++ } return k < 20000 ? k : -1 }
let prev = samples[0], firstOff = null
const lines = []
for (const s of samples.slice(1)) {
  if (s.c[0] > Number(ticksArg) || s.c[0] < prev.c[0]) break
  if (s.r === prev.r) continue
  const orig = distance(prev.r, s.r)
  const ours = distance(states[prev.c[0]], states[s.c[0]])
  const same = states[s.c[0]] === s.r
  lines.push(`${prev.c[0]}->${s.c[0]} original ${orig} remake ${ours}${same ? ' (same state)' : ''}`)
  if (!same && !firstOff) firstOff = lines.length - 1
  prev = s
}
// Every state the remake's generator passed through, with the tick it was drawn in; each sample of the original must be
// one of them, drawn in its tick (or the next: the original counts the tick before its frame is done)
const where = new Map()
{
  let v = seed, n = 0
  for (let k = 0; k < counts.length; k++) for (let j = 0; j < counts[k]; j++) { v = step(v); n++; where.set(v, k + 1) }
}
let inSync = 0, lastSync = 0, broke = null
for (const s of samples) {
  if (s.c[0] > Number(ticksArg)) break
  if (s.c[0] === 0) continue
  const t = where.get(s.r)
  if (t !== undefined && Math.abs(t - s.c[0]) <= 1) { inSync++; lastSync = s.c[0] } else {
    if (!broke) broke = s
    if (process.env.VERBOSE) console.log('out of step: tick', s.c[0], t === undefined ? 'state not in the remake\'s stream' : 'drawn by the remake in tick ' + t)
  }
}
console.log('samples in step with the remake:', inSync, 'last in step at tick', lastSync, broke ? 'first out of step: tick ' + broke.c[0] : 'none out of step')
console.log('seed', seed, 'remake draws per tick (first 40):', counts.slice(0, 40).join(' '))
console.log(lines.slice(0, 40).join('\n'))
if (firstOff !== null) console.log('first different state at line', firstOff, lines[firstOff])
if (process.env.CUMULATIVE) {
  // The original's draws since tick 0 at each sample, against the remake's after the sample's tick and the one before
  const cum = [0]
  for (const n of counts) cum.push(cum[cum.length - 1] + n)
  for (const s of samples.slice(0, 60)) {
    if (s.c[0] > Number(ticksArg)) break
    const d = distance(seed, s.r)
    console.log('tick', s.c[0], 'original', d, 'remake', cum[s.c[0] - 1] ?? '-', '/', cum[s.c[0]], d - cum[s.c[0]])
  }
}
