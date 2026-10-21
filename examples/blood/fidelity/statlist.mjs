// The original's status lists as it runs a demo (Build's headspritestat and nextspritestat): the order its loops
// visit the dudes, things and the rest in, at a frame of the demo (fidelity/lockstep.mjs).
//   node fidelity/statlist.mjs [frame] [demo] [statnum]
import fs from 'fs'
import Emu from './emu.mjs'
import Mem from './mem.mjs'
import Demo from '../formats/dem.mjs'
import BloodMap from '../formats/map.mjs'
import RFF from '../formats/rff.mjs'
import Lockstep, { locate } from './lockstep.mjs'

const [frameArg = '10', demoFile, statArg = '6'] = process.argv.slice(2)
const files = demoFile ? [{ path: 'BLOOD000.DEM', contents: new Uint8Array(fs.readFileSync(demoFile)) }] : []
const emu = await Emu.start({ log: !!process.env.LOG, files })
const mem = new Mem(emu)
const rff = RFF.load(new URL('../original/BLOOD.RFF', import.meta.url).pathname)
const demo = Demo.load(demoFile || new URL('../original/BLOOD000.DEM', import.meta.url).pathname)
const map = new BloodMap(rff.read(demo.options.levelName.toUpperCase() + '.MAP'))
const t0 = Date.now()
while (Date.now() - t0 < 120000) { await emu.wait(0.25); if (mem.findPlayers().some((o) => mem.i16(o + 38) === 231)) break }
const arrays = mem.findArrays(map)
const GLOBAL = arrays.sprites + 548 * 44
const SEED = GLOBAL - 2146176
const { base, delta, dataLin } = locate(mem, SEED)
const DATA = base + dataLin
if (DATA + 0x222c68 !== arrays.sprites) console.log('the data object is not where the sprites say', DATA + 0x222c68, arrays.sprites)
const step = Lockstep.install(mem, SEED, 0x200, { base, delta })
const counter = () => mem.i32(GLOBAL - 934408)
await new Promise((resolve) => {
  const h = setInterval(() => {
    if (!step.waiting()) return
    if (counter() >= Number(frameArg)) {
      clearInterval(h)
      const order = []
      for (let i = mem.i16(DATA + 0x2a7586 + 2 * Number(statArg)), n = 0; i >= 0 && n < 4096; i = mem.i16(DATA + 0x211868 + 2 * i), n++) order.push(i)
      if (order.length >= 4096) console.log('no end to the list: the addresses are wrong')
      console.log('frame', counter(), 'status', statArg, order.length, 'sprites:', order.join(','))
      resolve()
      return
    }
    step.release()
  }, 1)
})
process.exit(0)
