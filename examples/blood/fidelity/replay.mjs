// Plays a demo's inputs through the server's game and compares the player with a trace of the original playing it
// (fidelity/trace.mjs): position, angle and sector at every tick the trace sampled.
//   node fidelity/replay.mjs <trace.json> [ticks] [--show N] [--steps]
// --steps compares each tick's movement instead of the positions, so a difference in what happens (a step, a fall,
// a push) shows even after small differences have added up
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

/** `options.seed`: the random state to start from (the original's at the demo's start), or a fixed 1 */
export function replay (res, demo, ticks, onTick, options = {}) {
  if (options.seed === undefined) options = Object.assign({}, options, { seed: 1 })
  // Seeded before the level is set up: the original's state at the demo's start is before its generators' first
  // draws (Blood's InitGenerator), which the remake makes likewise; Blood's frame count starts at 0
  const game = new Game(res, Object.assign({ map: demo.options.levelName, difficulty: demo.options.difficulty, frame: 0 }, options))
  const level = game.level
  const p = game.addPlayer(0)
  const out = []
  { const s = p.sprite; out.start = { c: 0, x: s.x, y: s.y, z: s.z, ang: s.ang, sect: s.sectnum, xvel: 0, yvel: 0, zvel: 0, h: p.height } }
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
  // The trace's samples during the demo (after its first reset to tick 0); the remake starts from the original's
  // random state there, so a replay is the same every time
  const first = trace.samples.findIndex((s) => s.c[0] === 0)
  const seed = trace.samples[first] && trace.samples[first].r
  const sim = replay(res, demo, Number(ticksArg || demo.inputs.length), null, seed !== undefined ? { seed } : {})
  // Up to the demo's end: attract mode then starts the next demo, counting from 0 again
  let after = trace.samples.slice(first)
  const reset = after.findIndex((s, i) => i && s.c[0] < after[i - 1].c[0])
  if (reset > 0) after = after.slice(0, reset)
  const samples = after.filter((s) => s.c[0] >= 1 && s.c[0] <= sim.length)
  let worst = 0, sum = 0, n = 0, firstBad = null
  const lines = []
  const matched = []
  // The original counts the tick before it moves the player, so a sample may hold the state of the tick before its
  // count: each sample is compared with both, and the nearer counts
  const diff = (m, t) => ({ m, d: Math.hypot(m.x - t.x, m.y - t.y), dz: Math.abs(m.z - t.z), da: Math.abs((((m.ang - t.ang) % 2048) + 3072) % 2048 - 1024) })
  // A sample may also be taken mid-tick: the angle (input) already turned, the position (physics) not yet moved
  const start = sim.start
  const cost = (c) => c.d + c.dz / 16 + c.da * 8
  for (const t of samples) {
    const now = sim[t.c[0] - 1], before = t.c[0] >= 2 ? sim[t.c[0] - 2] : start
      // (each of x, y, z and the angle from either tick: the original moves them at different points of its frame)
    const candidates = []
    for (let k = 0; k < 16; k++) {
      const pick = (bit, f) => (k & bit ? before : now)[f]
      candidates.push(diff(Object.assign({}, now, { x: pick(1, 'x'), y: pick(2, 'y'), z: pick(4, 'z'), ang: pick(8, 'ang'), sect: pick(1, 'sect') }), t))
    }
    const { m, d, dz, da } = candidates.reduce((x, y) => (cost(y) < cost(x) ? y : x))
    matched.push({ t, m })
    sum += d; n++; worst = Math.max(worst, d)
    if (!firstBad && (d > 2 || dz > 512 || da > 1 || (m.sect !== t.sect && !process.env.NOSECT))) firstBad = { t, m, d, dz, da }
    lines.push(`${t.c[0]}\torig ${t.x},${t.y},${t.z} a${t.ang & 2047} s${t.sect}\tremake ${m.x},${m.y},${m.z} a${m.ang} s${m.sect} v${m.xvel},${m.yvel},${m.zvel} h${m.h}\td ${d.toFixed(0)} dz ${dz}`)
  }
  if (args.includes('--steps')) {
    // Each pair of samples a tick or more apart: the original's move against the remake's over the same ticks
    let shown = 0
    for (let i = 1; i < matched.length && shown < show; i++) {
      const a = matched[i - 1], b = matched[i]
      if (b.m === a.m || b.m.c !== a.m.c + 1) continue
      const ox = b.t.x - a.t.x, oy = b.t.y - a.t.y, oz = b.t.z - a.t.z
      const rx = b.m.x - a.m.x, ry = b.m.y - a.m.y, rz = b.m.z - a.m.z
      const dd = Math.hypot(ox - rx, oy - ry), ddz = Math.abs(oz - rz)
      if (dd > 8 || ddz > 256) {
        console.log(`${b.m.c}\torig step ${ox},${oy},${oz} s${b.t.sect}\tremake step ${rx},${ry},${rz} s${b.m.sect} at ${b.m.x},${b.m.y},${b.m.z} h${b.m.h}\td ${dd.toFixed(0)} dz ${ddz}`)
        shown++
      }
    }
  }
  console.log('samples', n, 'mean distance', (sum / n).toFixed(1), 'worst', worst.toFixed(0))
  if (firstBad) {
    console.log('first divergence at tick', firstBad.t.c[0], JSON.stringify({ d: firstBad.d, dz: firstBad.dz, da: firstBad.da }))
    const k = lines.findIndex((l) => l.startsWith(firstBad.t.c[0] + '\t'))
    console.log(lines.slice(Math.max(0, k - 3), k + show).join('\n'))
  } else console.log('no divergence')
}
