// Monte-Carlo fidelity: random inputs played by the original and by the remake, compared. Each run makes a demo of
// random input (segments of running, strafing, turning, jumping, crouching), has the original play it (in place of
// the attract mode's first demo), traces it from its memory, replays it through the server's game seeded with the
// original's random state, and reports how long the two keep together and how far they part.
//   node fidelity/montecarlo.mjs [runs] [ticks] [outdir] [seed]
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import Demo from '../formats/dem.mjs'
import { Resources } from '../server/game/Level.mjs'
import { replay } from './replay.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const [runsArg = '4', ticksArg = '450', outArg, seedArg] = process.argv.slice(2)
const OUT = outArg || fs.mkdtempSync('/tmp/blood-mc-')
fs.mkdirSync(OUT, { recursive: true })
let seed = Number(seedArg || Date.now() & 0xffff)
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000 }
const pick = (a) => a[Math.floor(rnd() * a.length)]

/** A random player: held moves of 5 to 40 ticks, now and then a jump or a crouch */
export function randomInputs (ticks) {
  const out = []
  while (out.length < ticks) {
    const n = 5 + Math.floor(rnd() * 35)
    const forward = pick([2048, 2048, 1024, 0, 0, -1024, -2048]), strafe = pick([0, 0, 0, 2048, -2048, 1024]), turn = pick([0, 0, 0, 24, -24, 64, -64, 160, -160])
    const jump = rnd() < 0.15, crouch = !jump && rnd() < 0.1
    for (let i = 0; i < n && out.length < ticks; i++) out.push({ run: 1, forward, strafe, turn, buttons: (jump && i < 3 ? 1 : 0) | (crouch ? 2 : 0) })
  }
  return out
}

const res = new Resources()

/** How a trace and the remake's replay of its demo agree: ticks together (within 16 units), mean and worst distance */
export function score (trace, demo) {
  const first = trace.samples.findIndex((s) => s.c[0] === 0)
  let after = trace.samples.slice(first)
  const reset = after.findIndex((s, i) => i && s.c[0] < after[i - 1].c[0])
  if (reset > 0) after = after.slice(0, reset)
  const samples = after.filter((s) => s.c[0] >= 1 && s.c[0] <= demo.inputs.length)
  const sim = replay(res, demo, demo.inputs.length, null, { seed: trace.samples[first].r })
  let together = 0, worst = 0, sum = 0, n = 0, broken = false
  for (const t of samples) {
    const near = [sim[t.c[0] - 1], sim[t.c[0] - 2]].filter(Boolean).map((m) => Math.hypot(m.x - t.x, m.y - t.y) + Math.abs(m.z - t.z) / 16)
    const d = Math.min(...near)
    sum += d; n++; worst = Math.max(worst, d)
    if (!broken && d <= 16) together = t.c[0]
    else if (d > 64) broken = true
  }
  return { ticks: demo.inputs.length, together, mean: Math.round(sum / Math.max(1, n)), worst: Math.round(worst) }
}

if (process.argv.includes('--score')) {
  const dir = process.argv[process.argv.indexOf('--score') + 1]
  for (const f of fs.readdirSync(dir).filter((f) => /^run\d+\.json$/.test(f)).sort()) {
    const trace = JSON.parse(fs.readFileSync(path.join(dir, f)))
    console.log(f, JSON.stringify(score(trace, new Demo(fs.readFileSync(path.join(dir, f.replace('.json', '.dem')))))))
  }
  process.exit(0)
}
const header = fs.readFileSync(path.join(ROOT, 'original/BLOOD000.DEM'))
const results = []
for (let r = 0; r < Number(runsArg); r++) {
  const inputs = randomInputs(Number(ticksArg))
  const demoFile = path.join(OUT, 'run' + r + '.dem'), traceFile = path.join(OUT, 'run' + r + '.json')
  fs.writeFileSync(demoFile, Demo.write(header, inputs))
  const seconds = Math.ceil(Number(ticksArg) / 30) + 4
  try {
    execFileSync('node', [path.join(ROOT, 'fidelity/trace.mjs'), traceFile, String(seconds), demoFile], { stdio: 'ignore', timeout: 400000 })
  } catch (e) { results.push({ run: r, error: 'trace failed' }); continue }
  const trace = JSON.parse(fs.readFileSync(traceFile))
  results.push(Object.assign({ run: r }, score(trace, new Demo(fs.readFileSync(demoFile)))))
  console.log(JSON.stringify(results[results.length - 1]))
}
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1))
const ok = results.filter((r) => !r.error)
console.log('runs', ok.length, 'mean ticks together', Math.round(ok.reduce((s, r) => s + r.together, 0) / Math.max(1, ok.length)), 'of', ticksArg, '; results in', OUT)
