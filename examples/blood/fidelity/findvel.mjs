// Finds Blood's velocity arrays (int xvel[4096], yvel[4096], zvel[4096], one after another) in the original's memory
// while attract mode plays BLOOD000: the words at the player's index that follow its step each tick, in x and, 16384
// bytes on, in y. Prints where they are from the sprite array's start, for trace.mjs.
//   node fidelity/findvel.mjs
import Emu from './emu.mjs'
import Mem from './mem.mjs'
import Demo from '../formats/dem.mjs'
import BloodMap from '../formats/map.mjs'
import RFF from '../formats/rff.mjs'

const emu = await Emu.start({ log: !!process.env.LOG })
const mem = new Mem(emu)
const rff = RFF.load(new URL('../original/BLOOD.RFF', import.meta.url).pathname)
const demo = Demo.load(new URL('../original/BLOOD000.DEM', import.meta.url).pathname)
const map = new BloodMap(rff.read(demo.options.levelName.toUpperCase() + '.MAP'))
let P = null
const t0 = Date.now()
while (!P && Date.now() - t0 < 120000) {
  await emu.wait(0.25)
  const found = mem.findPlayers().filter((o) => mem.i16(o + 38) === 231)
  if (found.length) P = found[0]
}
if (!P) { console.log('the player was not found'); process.exit(1) }
const arrays = mem.findArrays(map)
const index = (P - arrays.sprites) / 44
const GLOBAL = arrays.sprites + 548 * 44
const counter = () => mem.i32(GLOBAL - 934408)
console.log('player sprite', index, 'at', P, 'sprites at', arrays.sprites)
let candidates = null
const fits = (v, step) => step > 0 ? v > step * 2000 && v < step * 7000 : v < step * 2000 && v > step * 7000
let events = 0
while (events < 12 && Date.now() - t0 < 240000) {
  const c0 = counter(), a = mem.sprite(P)
  await emu.wait(0.005)
  const c1 = counter(), b = mem.sprite(P)
  if (c1 !== c0 + 1) continue
  const dx = b.x - a.x, dy = b.y - a.y
  if (Math.abs(dx) < 24 || Math.abs(dy) < 24 || Math.abs(dx) > 400 || Math.abs(dy) > 400) continue
  const h = mem.view, n = mem.heap.length - 32772
  const next = []
  if (!candidates) {
    for (let X = 0; X < n; X += 4) if (fits(h.getInt32(X, true), dx) && fits(h.getInt32(X + 16384, true), dy)) next.push(X)
  } else for (const X of candidates) if (fits(h.getInt32(X, true), dx) && fits(h.getInt32(X + 16384, true), dy)) next.push(X)
  candidates = next
  events++
  console.log('tick', c1, 'step', dx, dy, 'candidates', candidates.length)
  if (candidates.length <= 3) break
}
for (const X of candidates || []) {
  const base = X - 4 * index
  console.log('xvel[] at', base, 'from the sprites', base - arrays.sprites, 'from GLOBAL', base - GLOBAL, 'now', mem.i32(X), mem.i32(X + 16384), mem.i32(X + 32768))
}
await emu.exit()
process.exit(0)
