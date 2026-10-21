// The view against the original's: the original plays its demo; at chosen ticks its screen is saved with where its
// player stands (from its memory); the remake's fly-through renders the same eye at the original's 320x200; both are
// saved side by side.
//   node fidelity/views.mjs <outdir> <tick> [tick ...]      (the fly-through page must be served at :8471)
import fs from 'fs'
import path from 'path'
import Emu from './emu.mjs'
import Mem from './mem.mjs'
import Page from '../tools/page.mjs'

const [out, ...ticks] = process.argv.slice(2)
fs.mkdirSync(out, { recursive: true })
const wanted = ticks.map(Number).sort((a, b) => a - b)
const emu = await Emu.start({})
const mem = new Mem(emu)
let P = null
for (let i = 0; i < 400 && !P; i++) { await emu.wait(0.25); P = mem.findPlayers()[0] || null }
const C = -934408
const shots = []
for (const tick of wanted) {
  while (mem.i32(P + C) < tick) await emu.wait(0.002)
  const s = mem.sprite(P)
  const file = path.join(out, 'orig-' + tick + '.png')
  await emu.shot(file)
  shots.push({ tick, x: s.x, y: s.y, z: s.z, ang: s.ang & 2047, sect: s.sectnum, file })
  console.log('original at', tick, JSON.stringify(shots[shots.length - 1]))
}
await emu.exit()
// The remake's view of the same: the server's game replays the demo to each tick and saves its state (moved sectors
// and walls, its sprites, its player's eye); the fly-through draws that at 320x200
const { Resources } = await import('../server/game/Level.mjs')
const { replay } = await import('./replay.mjs')
const { default: Demo } = await import('../formats/dem.mjs')
const demo = Demo.load(new URL('../original/BLOOD000.DEM', import.meta.url).pathname)
const saved = {}
replay(new Resources(), demo, wanted[wanted.length - 1], (c, p, level) => {
  if (!wanted.includes(c)) return
  const sectors = {}, walls = {}
  level.sectors.forEach((s, i) => { sectors[i] = { ceilingz: s.ceilingz, floorz: s.floorz, ceilingshade: s.ceilingshade, floorshade: s.floorshade, ceilingpicnum: s.ceilingpicnum, floorpicnum: s.floorpicnum } })
  level.walls.forEach((w, i) => { walls[i] = { x: w.x, y: w.y, picnum: w.picnum, cstat: w.cstat, shade: w.shade } })
  const sprites = level.sprites.filter((s) => s.statnum < 1024 && s.sectnum >= 0 && !(s.cstat & 32768) && s !== p.sprite).map((s) => ({ x: s.x, y: s.y, z: s.z, ang: s.ang, picnum: s.picnum, cstat: s.cstat, shade: s.shade, pal: s.pal, xrepeat: s.xrepeat, yrepeat: s.yrepeat, xoffset: s.xoffset, yoffset: s.yoffset, sectnum: s.sectnum }))
  saved[c] = { sectors, walls, sprites, eye: { x: p.sprite.x, y: p.sprite.y, z: p.zView, ang: p.ang, horiz: p.horiz }, clock: p.game.clock }
}, { seed: 0 })
for (const s of shots) {
  const file = path.join(out, 'state-' + s.tick + '.json')
  fs.writeFileSync(file, JSON.stringify(saved[s.tick]))
  const rel = path.relative(path.resolve(new URL('..', import.meta.url).pathname), file)
  const page = await Page.open('http://127.0.0.1:8471/fly.html?stretch=1&state=' + encodeURIComponent('/' + rel), { width: 320, height: 200, ready: 'window.fly && fly.view && fly.view.map && fly.view.sprites.length' })
  await new Promise((r) => setTimeout(r, 400))
  await page.shot(path.join(out, 'remake-' + s.tick + '.png'))
  await page.close()
}
fs.writeFileSync(path.join(out, 'views.json'), JSON.stringify(shots, null, 1))
process.exit(0)
