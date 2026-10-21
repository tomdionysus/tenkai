// Traces the original playing a demo: the player's sprite (position, angle, sector) sampled as often as the
// emulator lets Node in (every 1 to 4 game ticks), with the counters beside it, saved as JSON for comparing with
// the remake playing the same demo.
//   node fidelity/trace.mjs BLOOD000.DEM out.json [seconds]
import fs from 'fs'
import Emu from './emu.mjs'
import Mem from './mem.mjs'
import Demo from '../formats/dem.mjs'

// -playback is in BLOOD.EXE's switches but plays nothing given a file here; attract mode plays the demos in turn
// after the title, so the trace waits for the player of one of their maps to appear
const [out = 'trace.json', seconds = '60', demoFile] = process.argv.slice(2)
// A demo of our own (fidelity/montecarlo.mjs) in place of BLOOD000.DEM, which attract mode plays first
const files = demoFile ? [{ path: 'BLOOD000.DEM', contents: new Uint8Array(fs.readFileSync(demoFile)) }] : []
const emu = await Emu.start({ log: !!process.env.LOG, files })
const mem = new Mem(emu)
const { default: BloodMap } = await import('../formats/map.mjs')
const { default: RFF } = await import('../formats/rff.mjs')
const rff = RFF.load(new URL('../original/BLOOD.RFF', import.meta.url).pathname)
const starts = ['BLOOD000.DEM', 'BLOOD001.DEM', 'BLOOD002.DEM'].map((file) => {
  const demo = Demo.load(new URL('../original/' + file, import.meta.url).pathname)
  const map = new BloodMap(rff.read(demo.options.levelName.toUpperCase() + '.MAP'))
  const start = map.sprites.find((s) => s.lotag === 1 && map.xsprites[s.extra] && map.xsprites[s.extra].data1 === 0)
  return { file, start }
})
let P = null, file = null, start = null
const t0 = Date.now()
while (!P && Date.now() - t0 < 90000) {
  await emu.wait(0.25)
  const found = mem.findPlayers().filter((o) => mem.i16(o + 38) === 231)
  if (found.length) {
    P = found[0]
    // Which demo: the map whose start sector the player is nearest (its sector number matches a start's, or else the nearest start)
    const sp = mem.sprite(P)
    const best = starts.map((s) => ({ s, d: Math.hypot(s.start.x - sp.x, s.start.y - sp.y) })).sort((a, b) => a.d - b.d)[0]
    file = best.s.file; start = best.s.start
    console.log('player at', JSON.stringify(sp), 'nearest start', file, best.d.toFixed(0))
  }
}
if (!P) { console.log('the player was not found'); process.exit(1) }
console.log('found the player of', file, 'after', (Date.now() - t0) / 1000, 's')
// The counters found by clock.mjs, relative to the player sprite (the same layout every run)
const C = [-934408, -934404]
// Blood's random number state (Watcom's rand(): seed = seed * 1103515245 + 12345), found by rng search
const RNG = -2146176
// The sectors and walls to watch (WATCH=30,29 / WATCHWALLS=229,230), read each sample from Blood's arrays
const { default: BloodMap2 } = await import('../formats/map.mjs')
const map = new BloodMap2(rff.read(Demo.load(new URL('../original/' + file, import.meta.url).pathname).options.levelName.toUpperCase() + '.MAP'))
const arrays = mem.findArrays(map)
console.log('arrays', JSON.stringify(arrays))
let dudesAtStart = 0
const dudeIndex = new Set()
if (arrays.sprites !== null) for (let i = 0; i < 4096; i++) if (mem.i16(arrays.sprites + i * 44 + 26) === 6) { dudesAtStart++; dudeIndex.add(i) }
console.log('dudes (with players) at the start', dudesAtStart)
const watch = (process.env.WATCH || '').split(',').filter(Boolean).map(Number)
const watchWalls = (process.env.WATCHWALLS || '').split(',').filter(Boolean).map(Number)
const samples = []
const tStart = performance.now()
await new Promise((resolve) => {
  const h = setInterval(() => {
    const s = mem.sprite(P)
    const sample = { t: Math.round(performance.now() - tStart), c: C.map((c) => mem.i32(P + c)), r: mem.u32(P + RNG), x: s.x, y: s.y, z: s.z, ang: s.ang, sect: s.sectnum, pic: s.picnum }
    if (arrays.sectors !== null) for (const w of watch) sample['s' + w] = mem.sector(arrays.sectors, w)
    if (arrays.walls !== null) for (const w of watchWalls) sample['w' + w] = mem.wall(arrays.walls, w)
    // The monsters (DUDES=1): every sprite in the dudes' status, its place, angle and tile
    if (process.env.DUDES && arrays.sprites !== null) {
      const d = {}
      for (let i = 0; i < 1200; i++) {
        const o = arrays.sprites + i * 44
        const stat = mem.i16(o + 26)
        // The dudes, the monsters that died (things now), and every sprite the game made after the map's (thrown TNT,
        // missiles, effects)
        if (stat >= 1024 || (stat !== 6 && !dudeIndex.has(i) && i < map.sprites.length)) continue
        d[i] = [mem.i32(o), mem.i32(o + 4), mem.i32(o + 8), mem.i16(o + 28) & 2047, mem.i16(o + 14), stat, mem.i16(o + 38)]
      }
      sample.dudes = d
    }
    samples.push(sample)
    if (performance.now() - tStart > Number(seconds) * 1000) { clearInterval(h); resolve() }
  }, 1)
})
// Only the samples where something changed
const kept = samples.filter((s, i) => !i || JSON.stringify(Object.assign({}, s, { t: 0 })) !== JSON.stringify(Object.assign({}, samples[i - 1], { t: 0 })))
fs.writeFileSync(out, JSON.stringify({ demo: file, demoPath: demoFile ? fs.realpathSync(demoFile) : null, dudesAtStart, start: { x: start.x, y: start.y, z: start.z, ang: start.ang }, samples: kept }))
console.log('samples', samples.length, 'kept', kept.length, 'last', JSON.stringify(kept[kept.length - 1]))
await emu.exit()
process.exit(0)
