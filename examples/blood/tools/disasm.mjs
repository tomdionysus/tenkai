// Disassembles BLOOD.EXE's code at an address (the exe's linear addresses: code object at 0x10000), with the LE
// fixups naming what the absolute operands point at (d:0x... is an offset in the data object, 0x120000 when loaded
// unmoved) and the functions it knows by name.
//   node tools/disasm.mjs <address> [count]      (count of instructions; default: to the function's return)
import fs from 'fs'
import { decode } from './x86.mjs'

const exe = fs.readFileSync(new URL('../original/BLOOD.EXE', import.meta.url).pathname)
const le = exe.indexOf(Buffer.from('LE\0\0'))
const u32 = (o) => exe.readUInt32LE(o)
const dataPages = u32(le + 0x80)
const objtab = le + u32(le + 0x40)
const objs = []
for (let i = 0; i < u32(le + 0x44); i++) {
  const o = objtab + i * 24
  objs.push({ vsize: u32(o), base: u32(o + 4), page: u32(o + 12), count: u32(o + 16), file: dataPages + (u32(o + 12) - 1) * 4096 })
}
const CODE = objs[0]
// The fixups: code offset -> { obj, off }
const fix = new Map()
{
  const npages = u32(le + 0x14), fpt = le + u32(le + 0x68), frt = le + u32(le + 0x6c)
  for (let page = 0; page < Math.min(npages, CODE.count); page++) {
    let p = frt + u32(fpt + page * 4)
    const end = frt + u32(fpt + (page + 1) * 4)
    while (p < end) {
      const stype = exe[p], flags = exe[p + 1]; p += 2
      let srcs = null, count = 0
      if (stype & 0x20) { count = exe[p]; p += 1 } else { srcs = [exe.readInt16LE(p)]; p += 2 }
      let obj
      if (flags & 0x40) { obj = exe.readUInt16LE(p); p += 2 } else { obj = exe[p]; p += 1 }
      let off = 0
      if ((stype & 0xf) !== 2) { if (flags & 0x10) { off = u32(p); p += 4 } else { off = exe.readUInt16LE(p); p += 2 } }
      if (!srcs) { srcs = []; for (let k = 0; k < count; k++) srcs.push(exe.readInt16LE(p + k * 2)); p += count * 2 }
      for (const so of srcs) fix.set(page * 4096 + so, { obj, off })
    }
  }
}
// Names known so far (code: functions; data: tables and globals)
const NAMES = {
  code: { 0xa4d3e: 'rand', 0x78288: 'CalcGameChecksum', 0x72c00: 'fxSpawn?' },
  data: { 0x1ac38: 'gFXData', 0x1bcd8: 'gibList' }
}
const name = (value, at, isCall) => {
  if (isCall) return NAMES.code[value] ? `${NAMES.code[value]} (${'0x' + value.toString(16)})` : null
  if (at < 0) return null
  const f = fix.get(at - CODE.file)
  if (!f) return null
  if (f.obj === 1) return NAMES.code[CODE.base + f.off] || 'c:0x' + (CODE.base + f.off).toString(16)
  const n = f.obj === 4 && NAMES.data[f.off]
  return n || `d${f.obj === 4 ? '' : f.obj}:0x${f.off.toString(16)}`
}

/** The functions' starts: every target of a direct call in the code */
let starts = null
export function functionStarts () {
  if (starts) return starts
  const set = new Set()
  for (let o = CODE.file; o < CODE.file + CODE.vsize - 5; o++) {
    if (exe[o] !== 0xe8) continue
    const t = (CODE.base + (o - CODE.file) + 5 + exe.readInt32LE(o + 1)) >>> 0
    if (t >= CODE.base && t < CODE.base + CODE.vsize) set.add(t)
  }
  starts = [...set].sort((a, b) => a - b)
  return starts
}

/** The start of the function holding an address (the nearest call target at or before it) */
export function functionOf (addr) {
  const s = functionStarts()
  let lo = 0, hi = s.length - 1, best = -1
  while (lo <= hi) { const m = (lo + hi) >> 1; if (s[m] <= addr) { best = s[m]; lo = m + 1 } else hi = m - 1 }
  return best
}

export function disassemble (addr, count = 0, print = true) {
  const out = []
  let a = addr
  for (let n = 0; count ? n < count : n < 4000; n++) {
    const off = CODE.file + (a - CODE.base)
    const ins = decode(exe, off, a, name)
    out.push({ addr: a, ...ins })
    if (print) console.log(a.toString(16).padStart(6) + '  ' + exe.subarray(off, off + ins.len).toString('hex').padEnd(20) + ' ' + ins.text)
    a += ins.len
    if (!count && ins.ret) break
  }
  return out
}

if (process.argv[1] && process.argv[1].endsWith('disasm.mjs')) {
  const args = process.argv.slice(2)
  if (args[0] === '--fn') {
    // the whole function holding an address: from its start to the next function's
    const a = parseInt(args[1], 16), f = functionOf(a), s = functionStarts()
    const next = s[s.indexOf(f) + 1]
    console.log('function', f.toString(16), 'to', next.toString(16))
    let x = f
    while (x < next) { const [i] = disassemble(x, 1); x += i.len }
  } else disassemble(parseInt(args[0], 16), Number(args[1] || 0))
}
