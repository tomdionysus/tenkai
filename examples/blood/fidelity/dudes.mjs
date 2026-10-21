// The monsters of the original against the remake's, in a demo traced with DUDES=1: for each monster that moves in
// the original, when it starts to move, where it goes, how it ends (its tile), beside the remake's same sprite.
//   node fidelity/dudes.mjs <trace.json> [ticks]
import fs from 'fs'
import path from 'path'
import Demo from '../formats/dem.mjs'
import { Resources } from '../server/game/Level.mjs'
import { replay } from './replay.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const [file, ticksArg = '700'] = process.argv.slice(2)
const trace = JSON.parse(fs.readFileSync(file))
const first = trace.samples.findIndex((s) => s.c[0] === 0)
let samples = trace.samples.slice(first)
const reset = samples.findIndex((s, i) => i && s.c[0] < samples[i - 1].c[0])
if (reset > 0) samples = samples.slice(0, reset)
samples = samples.filter((s) => s.dudes && s.c[0] <= Number(ticksArg))
const demo = trace.demoPath ? new Demo(fs.readFileSync(trace.demoPath)) : Demo.load(path.join(ROOT, 'original', trace.demo))
// The remake's monsters at every tick
const ours = []
replay(new Resources(), demo, Number(ticksArg), (c, p, level) => {
  const d = {}
  for (const s of level.sprites) if (s.statnum === 6 || (s.statnum === 4 && s.type >= 201 && s.type < 260)) d[s.index] = [s.x, s.y, s.z, s.ang, s.picnum, s.statnum]
  ours[c] = d
}, { seed: samples[0].r })
const start = samples[0].dudes
const report = []
for (const k of Object.keys(start)) {
  if (Number(k) >= 548) continue // the player
  const series = samples.map((s) => ({ c: s.c[0], d: s.dudes[k] })).filter((x) => x.d)
  const moved = series.find((x) => Math.hypot(x.d[0] - start[k][0], x.d[1] - start[k][1]) > 64 || x.d[4] !== start[k][4])
  const last = series[series.length - 1]
  const oursMoved = ours.findIndex((d) => d && d[k] && (Math.hypot(d[k][0] - start[k][0], d[k][1] - start[k][1]) > 64 || d[k][4] !== start[k][4]))
  const ol = ours[Math.min(ours.length - 1, last.c)] && ours[Math.min(ours.length - 1, last.c)][k]
  if (!moved && oursMoved < 0) continue
  report.push(`sprite ${k}: original ${moved ? 'stirs at ' + moved.c + ', ends at ' + last.d.slice(0, 2) + ' tile ' + last.d[4] + ' status ' + last.d[5] : 'stays'}; remake ${oursMoved >= 0 ? 'stirs at ' + oursMoved + ', ends at ' + (ol ? ol.slice(0, 2) + ' tile ' + ol[4] + ' status ' + ol[5] : 'gone') : 'stays'}`)
}
console.log(report.join('\n'))
