// Logs who calls the original's rand(): rand() in the emulator's memory is patched to jump to a stub (in the unused
// tail of the code object's last page) that writes its caller's return address into a ring buffer, then does what
// rand() did. Sampled with the demo's tick count, so each tick's draws can be placed by call site (tools/randcalls.py
// names the source file of each) and set beside the remake's.
//   node fidelity/randlog.mjs out.json [seconds] [demo]
import fs from 'fs'
import Emu from './emu.mjs'
import Mem from './mem.mjs'
import Demo from '../formats/dem.mjs'
import BloodMap from '../formats/map.mjs'
import RFF from '../formats/rff.mjs'

const [out = 'randlog.json', seconds = '20', demoFile] = process.argv.slice(2)
const files = demoFile ? [{ path: 'BLOOD000.DEM', contents: new Uint8Array(fs.readFileSync(demoFile)) }] : []
const exe = fs.readFileSync(new URL('../original/BLOOD.EXE', import.meta.url).pathname)
// rand() in the exe: its linear address (code object at 0x10000) and its first bytes
const RAND_LIN = 0xa4d3e, CODE_LIN = 0x10000, CODE_VSIZE = 0xe4ca0
const RAND_BYTES = Buffer.from('52e8f4ffffff85c074186910', 'hex')
const emu = await Emu.start({ log: !!process.env.LOG, files })
const mem = new Mem(emu)
const rff = RFF.load(new URL('../original/BLOOD.RFF', import.meta.url).pathname)
const demo = Demo.load(demoFile || new URL('../original/BLOOD000.DEM', import.meta.url).pathname)
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
const GLOBAL = arrays.sprites + 548 * 44
const SEED = GLOBAL - 2146176
const heap = mem.heap
// rand() in the heap
let H = -1
for (let i = 0; i < heap.length - 16; i++) {
  if (heap[i] === 0x52 && heap[i + 1] === 0xe8 && RAND_BYTES.every((b, k) => heap[i + k] === b)) { H = i; break }
}
if (H < 0) { console.log('rand() not found in memory'); process.exit(1) }
// The helper before it: mov eax, imm32 (the seed's address, as loaded); so the emulated memory's base in the heap
const seedLin = mem.u32(H - 5)
const base = SEED - seedLin
const randLin = H - base
const delta = randLin - RAND_LIN // how far the loader moved the code object
console.log('rand() at heap', H, 'linear', randLin.toString(16), 'seed at', seedLin.toString(16), 'heap', SEED, 'base', base, 'code moved by', delta.toString(16), 'helper byte', heap[H - 6].toString(16))
// The cave: the code object's last page after its end
const caveLin = CODE_LIN + delta + CODE_VSIZE + 0x10 & ~0xf
const caveEnd = (CODE_LIN + delta + CODE_VSIZE + 0xfff) & ~0xfff
let zero = true
for (let a = caveLin; a < caveEnd; a++) if (heap[base + a]) { zero = false; break }
console.log('cave', caveLin.toString(16), '-', caveEnd.toString(16), (caveEnd - caveLin), 'bytes, empty', zero)
if (!zero && !process.env.FORCE) process.exit(1)
// The ring buffer: in the data object's last page after its end if that is empty (512 entries), else in the cave
const DATA_LIN = 0x120000 + delta, DATA_VSIZE = 0x2d5540
const slackLin = (DATA_LIN + DATA_VSIZE + 0x3f) & ~0x3f, slackEnd = (DATA_LIN + DATA_VSIZE + 0xfff) & ~0xfff
let slackZero = true
for (let a = slackLin; a < slackEnd; a++) if (heap[base + a]) { slackZero = false; break }
let ENTRIES, BUF
if (slackZero && slackEnd - slackLin >= 2048) { ENTRIES = 256; BUF = slackLin } else { ENTRIES = 64; BUF = caveLin + 128 }
// Beside each caller, the demo's tick count when it called
const TICKS = BUF + ENTRIES * 4
const counterLin = GLOBAL - 934408 - base
const IDX = caveLin + 96
console.log('data slack', slackLin.toString(16), '-', slackEnd.toString(16), 'empty', slackZero, '; ring of', ENTRIES, 'at', BUF.toString(16))
const code = []
const u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]
const at = () => caveLin + code.length
code.push(0x52) // push edx (rand()'s own first instruction)
code.push(0x51) // push ecx
code.push(0x8b, 0x0d, ...u32(IDX)) // mov ecx, [IDX]
code.push(0x8b, 0x54, 0x24, 0x08) // mov edx, [esp+8]: the caller's return address
code.push(0x51) // push ecx
code.push(0x81, 0xe1, ...u32(ENTRIES - 1)) // and ecx, ENTRIES-1
code.push(0x89, 0x14, 0x8d, ...u32(BUF)) // mov [BUF + ecx*4], edx
code.push(0x8b, 0x15, ...u32(counterLin)) // mov edx, [the tick count]
code.push(0x89, 0x14, 0x8d, ...u32(TICKS)) // mov [TICKS + ecx*4], edx
code.push(0x59) // pop ecx
code.push(0x41) // inc ecx
code.push(0x89, 0x0d, ...u32(IDX)) // mov [IDX], ecx: the count of calls
code.push(0x59) // pop ecx
const helper = randLin - 6
code.push(0xe8, ...u32((helper - (at() + 5)) >>> 0)) // call the seed helper (rand()'s second instruction)
code.push(0xe9, ...u32((randLin + 6 - (at() + 5)) >>> 0)) // back into rand() after it
if (code.length > 96) throw new Error('stub too long')
if (heap[H - 6] !== 0xb8) { console.log('the helper is not mov eax, imm32'); process.exit(1) }
// In one go between the emulator's slices: the stub, the count, then rand()'s jump to it
heap.set(code, base + caveLin)
mem.view.setUint32(base + IDX, 0, true)
const jmp = [0xe9, ...u32((caveLin - (randLin + 5)) >>> 0), 0x90]
heap.set(jmp, H)
console.log('patched; stub', code.length, 'bytes')
const counter = () => mem.i32(GLOBAL - 934408)
const samples = []
let last = 0
const tStart = performance.now()
await new Promise((resolve) => {
  const h = setInterval(() => {
    const count = mem.u32(base + IDX)
    const sample = { c: counter(), r: mem.u32(SEED), n: count }
    if (count !== last) {
      const k = Math.min(count - last, ENTRIES)
      if (count - last > ENTRIES) sample.lost = count - last - ENTRIES
      sample.calls = []
      sample.ticks = []
      for (let i = count - k; i < count; i++) {
        sample.calls.push(mem.u32(base + BUF + 4 * (i & (ENTRIES - 1))) - delta)
        sample.ticks.push(mem.i32(base + TICKS + 4 * (i & (ENTRIES - 1))))
      }
      last = count
    }
    if (samples.length === 0 || sample.calls || sample.c !== samples[samples.length - 1].c) samples.push(sample)
    if (performance.now() - tStart > Number(seconds) * 1000) { clearInterval(h); resolve() }
  }, 1)
})
fs.writeFileSync(out, JSON.stringify({ demo: demoFile || 'BLOOD000.DEM', delta, samples }))
const lost = samples.reduce((a, s) => a + (s.lost || 0), 0)
console.log('samples', samples.length, 'calls', last, 'lost', lost)
await emu.exit()
process.exit(0)
