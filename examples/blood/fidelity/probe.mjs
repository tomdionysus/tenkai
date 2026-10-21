// Probes the original playing a demo: at chosen places in BLOOD.EXE's code a stub records registers or what they
// point at into a ring buffer, every time the code passes there; read a frame at a time (fidelity/lockstep.mjs).
// So what a function was given or did inside a frame can be compared with the remake's, not only what the frame left.
//   PROBES='0x29f00:6:[eax],[edx],ebx;0x30b7f:9:ebp,esi' node fidelity/probe.mjs out.json [seconds] [demo]
// Each probe: its address (the exe's linear addresses), how many bytes of whole instructions it moves to the stub
// (at least 5, nothing relative among them), then up to 7 values: a register (eax ... edi, esp as it was), or
// [reg+offset] what it points at, or [[reg+offset]+offset2] through a pointer kept there. The out file: per frame { c, hits: [[probe, ...values]] }.
import fs from 'fs'
import Emu from './emu.mjs'
import Mem from './mem.mjs'
import Demo from '../formats/dem.mjs'
import BloodMap from '../formats/map.mjs'
import RFF from '../formats/rff.mjs'
import Lockstep, { locate } from './lockstep.mjs'

const [out = 'probe.json', seconds = '20', demoFile] = process.argv.slice(2)
const probes = (process.env.PROBES || '').split(';').filter(Boolean).map((p) => {
  const [addr, len, vals = ''] = p.split(':')
  return { addr: Number(addr), len: Number(len), vals: vals.split(',').filter(Boolean) }
})
if (!probes.length) { console.log('PROBES= what to probe'); process.exit(1) }
const files = demoFile ? [{ path: 'BLOOD000.DEM', contents: new Uint8Array(fs.readFileSync(demoFile)) }] : []
const emu = await Emu.start({ log: !!process.env.LOG, files })
const mem = new Mem(emu)
const rff = RFF.load(new URL('../original/BLOOD.RFF', import.meta.url).pathname)
const demo = Demo.load(demoFile || new URL('../original/BLOOD000.DEM', import.meta.url).pathname)
const map = new BloodMap(rff.read(demo.options.levelName.toUpperCase() + '.MAP'))
let P = null
const t0 = Date.now()
while (!P && Date.now() - t0 < 120000) {
  await emu.wait(0.25)
  if (mem.findPlayers().some((o) => mem.i16(o + 38) === 231)) P = true
}
if (!P) { console.log('the player was not found'); process.exit(1) }
const arrays = mem.findArrays(map)
const GLOBAL = arrays.sprites + 548 * 44
const SEED = GLOBAL - 2146176
const heap = mem.heap
const { base, delta } = locate(mem, SEED)
const CODE_LIN = 0x10000, CODE_VSIZE = 0xe4ca0, DATA_LIN = 0x120000 + delta, DATA_VSIZE = 0x2d5540
// The stubs in the code object's last page, after fidelity/lockstep.mjs's stub (0x200) and flag (0x240)
const caveLin = (CODE_LIN + delta + CODE_VSIZE + 0x10) & ~0xf
const caveEnd = (CODE_LIN + delta + CODE_VSIZE + 0xfff) & ~0xfff
const IDX = caveLin + 0x248
let at = caveLin + 0x260
// The ring in the data object's last page after its end: 32 bytes an entry (the probe, 7 values)
const slackLin = (DATA_LIN + DATA_VSIZE + 0x3f) & ~0x3f, slackEnd = (DATA_LIN + DATA_VSIZE + 0xfff) & ~0xfff
let ENTRIES = 1
while (ENTRIES * 2 * 32 <= slackEnd - slackLin) ENTRIES *= 2
const BUF = slackLin
for (let a = slackLin; a < slackEnd; a++) if (heap[base + a]) { console.log('the data slack is not empty'); process.exit(1) }
console.log('ring of', ENTRIES, 'at', BUF.toString(16), 'stubs from', at.toString(16), 'to', caveEnd.toString(16))
const u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]
const SLOT = { edi: 0, esi: 4, ebp: 8, esp: 12, ebx: 16, edx: 20, ecx: 24, eax: 28 }
probes.forEach((p, id) => {
  const hook = p.addr + delta
  const original = Array.from(heap.slice(base + hook, base + hook + p.len))
  const code = []
  code.push(0x60) // pushad
  code.push(0x8b, 0x0d, ...u32(IDX)) // mov ecx, [IDX]
  code.push(0x81, 0xe1, ...u32(ENTRIES - 1)) // and ecx, ENTRIES-1
  code.push(0xc1, 0xe1, 0x05) // shl ecx, 5
  code.push(0x81, 0xc1, ...u32(BUF)) // add ecx, BUF
  code.push(0xc7, 0x01, ...u32(id)) // mov dword [ecx], id
  p.vals.slice(0, 7).forEach((v, k) => {
    // reg, [reg+off], or [[reg+off]+off2]: what a pointer kept at reg+off points at
    const m = v.match(/^(\[*)(e[a-z]{2})(?:\+(0x[0-9a-f]+|\d+))?\]?(?:\+(0x[0-9a-f]+|\d+))?\]?$/)
    if (!m || SLOT[m[2]] === undefined) throw new Error('what is ' + v)
    code.push(0x8b, 0x44, 0x24, SLOT[m[2]]) // mov eax, [esp+slot]: the register as it was
    if (m[1].length >= 1) code.push(0x8b, 0x80, ...u32(Number(m[3] || 0))) // mov eax, [eax+offset]
    if (m[1].length >= 2) code.push(0x8b, 0x80, ...u32(Number(m[4] || 0))) // mov eax, [eax+offset2]
    code.push(0x89, 0x41, 4 + 4 * k) // mov [ecx+4+4k], eax
  })
  code.push(0xff, 0x05, ...u32(IDX)) // inc dword [IDX]
  code.push(0x61) // popad
  code.push(...original)
  code.push(0xe9, ...u32((hook + p.len - (at + code.length + 5)) >>> 0)) // back
  if (at + code.length > caveEnd) throw new Error('no room for the stubs')
  heap.set(code, base + at)
  heap.set([0xe9, ...u32((at - (hook + 5)) >>> 0), ...new Array(p.len - 5).fill(0x90)], base + hook)
  at += (code.length + 15) & ~15
})
mem.view.setUint32(base + IDX, 0, true)
const step = Lockstep.install(mem, SEED, 0x200, { base, delta })
const counter = () => mem.i32(GLOBAL - 934408)
const frames = []
let last = 0
const tStart = performance.now()
await new Promise((resolve) => {
  const h = setInterval(() => {
    if (!step.waiting()) return
    const count = mem.u32(base + IDX)
    const f = { c: counter(), hits: [] }
    if (count - last > ENTRIES) f.lost = count - last - ENTRIES
    for (let i = Math.max(last, count - ENTRIES); i < count; i++) {
      const o = base + BUF + 32 * (i & (ENTRIES - 1))
      const id = mem.u32(o)
      f.hits.push([id, ...probes[id].vals.map((_, k) => mem.i32(o + 4 + 4 * k))])
    }
    last = count
    frames.push(f)
    step.release()
    if (performance.now() - tStart > Number(seconds) * 1000) { clearInterval(h); resolve() }
  }, 1)
})
fs.writeFileSync(out, JSON.stringify({ demo: demoFile || 'BLOOD000.DEM', probes: process.env.PROBES, frames }))
console.log('frames', frames.length)
