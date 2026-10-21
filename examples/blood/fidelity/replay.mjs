// Plays a demo's inputs through the server's game and compares the player with a trace of the original playing it
// (fidelity/trace.mjs): position, angle and sector at every tick the trace sampled.
//   node fidelity/replay.mjs <trace.json> [ticks] [--show N]
import fs from 'fs'
import path from 'path'
import Demo from '../formats/dem.mjs'
import { Resources } from '../server/game/Level.mjs'
import Game from '../server/game/Game.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)

/** The player of a level at its first single-player start, as Blood puts it there (standing on the floor) */
export function startPlayer (level, number = 0) {
  const start = level.sprites.find((s) => s.type === 1 && level.x(s) && level.x(s).data1 === number)
  const s = level.spawn(start.sectnum, start.x, start.y, start.z, 6, { cstat: 385, picnum: 3870, pal: 11 + number, clipdist: 48, xrepeat: 39, yrepeat: 37, ang: start.ang, type: 231 + number, shade: -8 })
  const fz = level.engine.getflorzofslope(s.sectnum, s.x, s.y)
  const { bottom } = level.extents(s)
  s.z += fz - bottom
  return new Player(level, s, number)
}

export function replay (res, demo, ticks, onTick, options = {}) {
  const game = new Game(res, Object.assign({ map: demo.options.levelName, difficulty: demo.options.difficulty, frame: 2 }, options))
  const level = game.level
  const p = game.addPlayer(0)
  if (options.seed !== undefined) { game.random.seed = options.seed; game.random.calls = 0 }
  const out = []
  for (let k = 0; k < Math.min(ticks, demo.inputs.length); k++) {
    p.input = demo.inputs[k]
    game.tick()
    const s = p.sprite
    out.push({ c: k + 1, x: s.x, y: s.y, z: s.z, ang: s.ang, sect: s.sectnum, xvel: s.xvel, yvel: s.yvel, zvel: s.zvel, h: p.height })
    if (onTick) onTick(k + 1, p, level)
  }
  return out
}

if (process.argv[1] && process.argv[1].endsWith('replay.mjs')) {
  const args = process.argv.slice(2)
  const show = args.includes('--show') ? Number(args[args.indexOf('--show') + 1]) : 12
  const [file, ticksArg] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--show')
  const trace = JSON.parse(fs.readFileSync(file))
  const demo = Demo.load(trace.demoPath || path.join(ROOT, 'original', trace.demo))
  const res = new Resources()
  const sim = replay(res, demo, Number(ticksArg || demo.inputs.length))
  // The trace's samples during the demo (after its first reset to tick 0)
  const first = trace.samples.findIndex((s) => s.c[0] === 0)
  // Up to the demo's end: attract mode then starts the next demo, counting from 0 again
  let after = trace.samples.slice(first)
  const reset = after.findIndex((s, i) => i && s.c[0] < after[i - 1].c[0])
  if (reset > 0) after = after.slice(0, reset)
  const samples = after.filter((s) => s.c[0] >= 1 && s.c[0] <= sim.length)
  let worst = 0, sum = 0, n = 0, firstBad = null
  const lines = []
  // The original counts the tick before it moves the player, so a sample may hold the state of the tick before its
  // count: each sample is compared with both, and the nearer counts
  const diff = (m, t) => ({ m, d: Math.hypot(m.x - t.x, m.y - t.y), dz: Math.abs(m.z - t.z), da: Math.abs((((m.ang - t.ang) % 2048) + 3072) % 2048 - 1024) })
  for (const t of samples) {
    const a = diff(sim[t.c[0] - 1], t), b = t.c[0] >= 2 ? diff(sim[t.c[0] - 2], t) : a
    const { m, d, dz, da } = (b.d + b.dz / 16 + b.da * 8) < (a.d + a.dz / 16 + a.da * 8) ? b : a
    sum += d; n++; worst = Math.max(worst, d)
    if (!firstBad && (d > 2 || dz > 512 || da > 1 || (m.sect !== t.sect && !process.env.NOSECT))) firstBad = { t, m, d, dz, da }
    lines.push(`${t.c[0]}\torig ${t.x},${t.y},${t.z} a${t.ang & 2047} s${t.sect}\tremake ${m.x},${m.y},${m.z} a${m.ang} s${m.sect} v${m.xvel},${m.yvel},${m.zvel} h${m.h}\td ${d.toFixed(0)} dz ${dz}`)
  }
  console.log('samples', n, 'mean distance', (sum / n).toFixed(1), 'worst', worst.toFixed(0))
  if (firstBad) {
    console.log('first divergence at tick', firstBad.t.c[0], JSON.stringify({ d: firstBad.d, dz: firstBad.dz, da: firstBad.da }))
    const k = lines.findIndex((l) => l.startsWith(firstBad.t.c[0] + '\t'))
    console.log(lines.slice(Math.max(0, k - 3), k + show).join('\n'))
  } else console.log('no divergence')
}
