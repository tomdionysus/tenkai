// Traces the original playing a demo: the player's sprite (position, angle, sector, velocity) sampled as often as the
// emulator lets Node in (every 1 to 4 game ticks), with the counters beside it, saved as JSON for comparing with
// the remake playing the same demo.
//   node fidelity/trace.mjs BLOOD000.DEM out.json [seconds]
import fs from 'fs'
import Emu from './emu.mjs'
import Mem from './mem.mjs'
import Demo from '../formats/dem.mjs'
import Lockstep, { locate } from './lockstep.mjs'

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
// Each dude's AI state: its xsprite (56 bytes each in memory) holds a pointer to its AISTATE (tools/aistates.mjs
// lists them), found by fidelity's search at the data object's 0x52d08 + 56 * the xsprite's index; the data object's
// start is the seed's place less its offset there, 0x1cb18
const XSTATE = RNG - 0x1cb18 + 0x52d08
// Blood's velocity arrays (int xvel[4096], yvel[4096], zvel[4096]), found by fidelity/findvel.mjs, from the
// sprite array's start
const VEL = -1736580
// The sectors and walls to watch (WATCH=30,29 / WATCHWALLS=229,230), read each sample from Blood's arrays
const { default: BloodMap2 } = await import('../formats/map.mjs')
const map = new BloodMap2(rff.read(Demo.load(new URL('../original/' + file, import.meta.url).pathname).options.levelName.toUpperCase() + '.MAP'))
const arrays = mem.findArrays(map)
console.log('arrays', JSON.stringify(arrays))
// The counters and the random state are globals: found in E1M1, where the player's sprite is the 548th, so placed
// from the sprite array's start (the player's index differs from map to map)
const GLOBAL = arrays.sprites !== null ? arrays.sprites + 548 * 44 : P
let dudesAtStart = 0
const dudeIndex = new Set()
if (arrays.sprites !== null) for (let i = 0; i < 4096; i++) if (mem.i16(arrays.sprites + i * 44 + 26) === 6) { dudesAtStart++; dudeIndex.add(i) }
console.log('dudes (with players) at the start', dudesAtStart)
const watch = (process.env.WATCH || '').split(',').filter(Boolean).map(Number)
const watchWalls = (process.env.WATCHWALLS || '').split(',').filter(Boolean).map(Number)
const watchSprites = (process.env.WATCHSPRITES || '').split(',').filter(Boolean).map(Number)
const where = arrays.sprites !== null ? locate(mem, GLOBAL + RNG) : null
// STEP=1: one sample a frame, each at the frame's start (fidelity/lockstep.mjs)
const step = process.env.STEP && where ? Lockstep.install(mem, GLOBAL + RNG, 0x200, where) : null
const samples = []
const tStart = performance.now()
await new Promise((resolve) => {
  const h = setInterval(() => {
    if (step && !step.waiting()) return
    const s = mem.sprite(P)
    const sample = { t: Math.round(performance.now() - tStart), c: C.map((c) => mem.i32(GLOBAL + c)), r: mem.u32(GLOBAL + RNG), x: s.x, y: s.y, z: s.z, ang: s.ang, sect: s.sectnum, pic: s.picnum }
    if (arrays.sprites !== null) {
      const i = (P - arrays.sprites) / 44, v = arrays.sprites + VEL + 4 * i
      sample.v = [mem.i32(v), mem.i32(v + 16384), mem.i32(v + 32768)]
    }
    if (arrays.sectors !== null) for (const w of watch) sample['s' + w] = mem.sector(arrays.sectors, w)
    if (arrays.walls !== null) for (const w of watchWalls) sample['w' + w] = mem.wall(arrays.walls, w)
    // PEEK=f3956,f3934: bytes of the data object at those offsets (d:, as tools/disasm.mjs names them)
    if (process.env.PEEK) sample.peek = process.env.PEEK.split(',').map((h) => mem.u8(GLOBAL + RNG - 0x1cb18 + parseInt(h, 16)))
    // HEAP=1: Blood's event queue (d:0x11194c: time and event pairs, the count at +0x2008), as [time, index, type, cmd]
    if (process.env.HEAP) {
      const q = GLOBAL + RNG - 0x1cb18 + 0x11194c, n = mem.i32(q + 0x2008), h = []
      for (let i = 1; i <= n && i < 0x400; i++) { const d = mem.u32(q + i * 8 + 4); h.push([mem.i32(q + i * 8), d & 0x1fff, (d >> 13) & 7, (d >> 16) & 0xff, d >>> 24]) }
      sample.heap = h
    }
    // SPRITES=540-600: every sprite in that index range: [index, status, type, tile, x, y]
    if (process.env.SPRITES && arrays.sprites !== null) {
      const [lo, hi] = process.env.SPRITES.split('-').map(Number), out = []
      for (let i = lo; i <= hi; i++) { const o = arrays.sprites + i * 44; out.push([i, mem.i16(o + 26), mem.i16(o + 38), mem.i16(o + 14), mem.i32(o), mem.i32(o + 4), mem.i32(o + 8), mem.i32(arrays.sprites + VEL + 4 * i + 32768)]) }
      sample.sprites = out
    }
    // WATCHSPRITES=194,228: those sprites' place, status, tile and cstat, then xsprite and velocity
    // (and its xsprite's health, the low 12 bits at 0x1c, and its first word, where the state bit is)
    if (arrays.sprites !== null) for (const i of watchSprites) {
      const o = arrays.sprites + i * 44, extra = mem.i16(o + 42)
      const xs = extra > 0 ? GLOBAL + XSTATE - 0x34 + 56 * extra : 0
      sample['p' + i] = [mem.i32(o), mem.i32(o + 4), mem.i32(o + 8), mem.i16(o + 26), mem.i16(o + 14), mem.u16(o + 12), xs ? mem.u16(xs + 0x1c) & 0xfff : -1, xs ? mem.u32(xs) : -1, ...[0, 1, 2].map((k) => mem.i32(arrays.sprites + VEL + 4 * i + k * 16384))]
      if (xs && process.env.XDUMP) sample['x' + i] = Array.from({ length: 14 }, (_, k) => mem.u32(xs + 4 * k).toString(16))
    }
    // The monsters (DUDES=1): every sprite in the dudes' status, its place, angle and tile
    if (process.env.DUDES && arrays.sprites !== null) {
      const d = {}
      for (let i = 0; i < 1200; i++) {
        const o = arrays.sprites + i * 44
        const stat = mem.i16(o + 26)
        // The dudes, the monsters that died (things now), and every sprite the game made after the map's (thrown TNT,
        // missiles, effects)
        if (stat >= 1024 || (stat !== 6 && !dudeIndex.has(i) && i < map.sprites.length)) continue
        // (then its velocity, from Blood's xvel, yvel and zvel arrays, and its cstat)
        const v = arrays.sprites + VEL + 4 * i
        const extra = mem.i16(o + 42)
        const ai = extra > 0 && stat === 6 && where ? mem.u32(GLOBAL + XSTATE + 56 * extra) - where.dataLin : 0
        d[i] = [mem.i32(o), mem.i32(o + 4), mem.i32(o + 8), mem.i16(o + 28) & 2047, mem.i16(o + 14), stat, mem.i16(o + 38), mem.i32(v), mem.i32(v + 16384), mem.i32(v + 32768), mem.u16(o + 12), ai]
      }
      sample.dudes = d
    }
    // Every sprite within NEAR of the player (NEAR=1500): index, place, tile, cstat, status, type, clipdist
    if (process.env.NEAR && arrays.sprites !== null) {
      // (NEAR=600@-2048,44800: around that point instead)
      const [rs, at] = process.env.NEAR.split('@'), r = Number(rs), n = []
      const [cx, cy] = at ? at.split(',').map(Number) : [s.x, s.y]
      for (let i = 0; i < 4096; i++) {
        const o = arrays.sprites + i * 44
        const stat = mem.i16(o + 26)
        if (stat >= 1024 || o === P) continue
        const x = mem.i32(o), y = mem.i32(o + 4)
        if (Math.abs(x - cx) < r && Math.abs(y - cy) < r) n.push([i, x, y, mem.i32(o + 8), mem.i16(o + 14), mem.u16(o + 12), stat, mem.i16(o + 38), mem.u8(o + 18)])
      }
      sample.near = n
    }
    samples.push(sample)
    if (step) step.release()
    if (performance.now() - tStart > Number(seconds) * 1000) { clearInterval(h); resolve() }
  }, 1)
})
// Only the samples where something changed
const kept = samples.filter((s, i) => !i || JSON.stringify(Object.assign({}, s, { t: 0 })) !== JSON.stringify(Object.assign({}, samples[i - 1], { t: 0 })))
fs.writeFileSync(out, JSON.stringify({ demo: file, demoPath: demoFile ? fs.realpathSync(demoFile) : null, dudesAtStart, start: { x: start.x, y: start.y, z: start.z, ang: start.ang }, samples: kept }))
console.log('samples', samples.length, 'kept', kept.length, 'last', JSON.stringify(kept[kept.length - 1]))
await emu.exit()
process.exit(0)
