// Blood's AI states (AISTATE, 28 bytes in v1.11: int seqId, funcId (the sequence's callback), stateTicks; then
// pointers to the enter, move and think functions and the next state), found in BLOOD.EXE's data object by their
// shape: runs of records whose function slots hold code addresses (fixups into the code object) or nothing, and
// whose next slot holds another record's address or nothing. Prints the state graph, a state per line.
//   node tools/aistates.mjs [--json]
import fs from 'fs'

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
const DATA = objs[3], CODE = objs[0]
// Every fixup in the data object: offset in it -> { obj, off }
const fix = new Map()
{
  const npages = u32(le + 0x14), fpt = le + u32(le + 0x68), frt = le + u32(le + 0x6c)
  const first = DATA.page - 1
  for (let page = first; page < Math.min(npages, first + DATA.count); page++) {
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
      for (const so of srcs) fix.set((page - first) * 4096 + so, { obj, off })
    }
  }
}
const loaded = Math.min(DATA.count * 4096, exe.length - DATA.file)
const i32 = (o) => exe.readInt32LE(DATA.file + o)
const codeAt = (o) => { const f = fix.get(o); if (f && f.obj === 1) return CODE.base + f.off; return i32(o) === 0 ? 0 : -1 }
const dataAt = (o) => { const f = fix.get(o); if (f && f.obj === 4) return f.off; return i32(o) === 0 ? 0 : -1 }

// A state: its slots fit, and it is not all empty
const isState = (o) => {
  if (o + 28 > loaded) return false
  const seq = i32(o), func = i32(o + 4), ticks = i32(o + 8)
  if (seq < -1 || seq > 64 || func < -1 || func > 64 || ticks < 0 || ticks > 10000) return false
  const e = codeAt(o + 12), m = codeAt(o + 16), t = codeAt(o + 20), n = dataAt(o + 24)
  if (e < 0 || m < 0 || t < 0 || n < 0) return false
  if (fix.get(o) || fix.get(o + 4) || fix.get(o + 8)) return false
  return e || m || t || n
}
const states = new Map()
for (let o = 0; o < loaded - 28; o += 4) {
  if (!isState(o)) continue
  states.set(o, { at: o, seq: i32(o), func: i32(o + 4), ticks: i32(o + 8), enter: codeAt(o + 12), move: codeAt(o + 16), think: codeAt(o + 20), next: dataAt(o + 24) })
}
// Keep those another state's next points at, or whose next is a state (drops chance matches)
const kept = [...states.values()].filter((s) => (s.next && states.has(s.next)) || [...states.values()].some((t) => t.next === s.at))
if (process.argv.includes('--json')) console.log(JSON.stringify(kept))
else {
  const h = (v) => (v ? '0x' + v.toString(16) : '-')
  for (const s of kept) console.log(`d:${h(s.at)} seq ${s.seq} cb ${s.func} ticks ${s.ticks} enter ${h(s.enter)} move ${h(s.move)} think ${h(s.think)} next ${h(s.next)}`)
  console.log(kept.length, 'states')
}
