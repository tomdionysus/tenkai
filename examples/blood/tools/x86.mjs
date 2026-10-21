// A small disassembler for the 32-bit x86 that Watcom C emitted for BLOOD.EXE: enough of the instruction set to read
// the original's functions (integer instructions, ModRM/SIB addressing, the 0F two-byte group; x87 shown as such).
// For reading the game's logic where traces leave a question (fidelity/), not for running anything.
//   import { decode } from './x86.mjs'; const ins = decode(bytes, offset, address)

const R32 = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi']
const R16 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di']
const R8 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh']
const SREG = ['es', 'cs', 'ss', 'ds', 'fs', 'gs', '?', '?']
const CC = ['o', 'no', 'b', 'ae', 'e', 'ne', 'be', 'a', 's', 'ns', 'p', 'np', 'l', 'ge', 'le', 'g']
const ALU = ['add', 'or', 'adc', 'sbb', 'and', 'sub', 'xor', 'cmp']
const SHIFT = ['rol', 'ror', 'rcl', 'rcr', 'shl', 'shr', 'sal', 'sar']
const GRP3 = ['test', 'test', 'not', 'neg', 'mul', 'imul', 'div', 'idiv']
const GRP5 = ['inc', 'dec', 'call', 'callf', 'jmp', 'jmpf', 'push', '?']
const hex = (v) => (v < 0 ? '-0x' + (-v).toString(16) : '0x' + v.toString(16))

/**
 * Decodes one instruction at `off` in `b` (a Buffer), at address `addr`. Returns { len, text, op, target (a jump's
 * or call's address), mem: [{ at: offset of an absolute disp/imm in b, kind }] } so a caller can name fixups.
 * `name(value, at)` (optional) turns an absolute address held at byte `at` into a name.
 */
export function decode (b, off, addr, name = null) {
  let p = off
  let opsize = 32, rep = '', seg = ''
  for (;;) {
    const x = b[p]
    if (x === 0x66) { opsize = 16; p++ } else if (x === 0xf2) { rep = 'repne '; p++ } else if (x === 0xf3) { rep = 'rep '; p++ } else if ([0x26, 0x2e, 0x36, 0x3e, 0x64, 0x65].includes(x)) { seg = { 0x26: 'es', 0x2e: 'cs', 0x36: 'ss', 0x3e: 'ds', 0x64: 'fs', 0x65: 'gs' }[x] + ':'; p++ } else break
  }
  const i8 = () => { const v = b.readInt8(p); p += 1; return v }
  const u8 = () => b[p++]
  const i16 = () => { const v = b.readInt16LE(p); p += 2; return v }
  const i32 = () => { const v = b.readInt32LE(p); p += 4; return v }
  const absName = (v, at) => (name && name(v >>> 0, at)) || hex(v >>> 0)
  const regs = (size) => (size === 8 ? R8 : size === 16 ? R16 : R32)
  // ModRM: returns { reg, rm: text, isReg }
  const modrm = (size) => {
    const m = u8()
    const mod = m >> 6, reg = (m >> 3) & 7, rm = m & 7
    if (mod === 3) return { reg, rm: regs(size)[rm], isReg: true, mod, rmn: rm }
    let base = null, index = null, scale = 1, disp = 0, dispAt = -1
    if (rm === 4) {
      const sib = u8()
      scale = 1 << (sib >> 6); const idx = (sib >> 3) & 7, bs = sib & 7
      if (idx !== 4) index = R32[idx]
      if (bs === 5 && mod === 0) { dispAt = p; disp = i32() } else base = R32[bs]
    } else if (rm === 5 && mod === 0) { dispAt = p; disp = i32() } else base = R32[rm]
    if (mod === 1) disp = i8()
    else if (mod === 2) { dispAt = p; disp = i32() }
    const parts = []
    if (base) parts.push(base)
    if (index) parts.push(index + (scale > 1 ? '*' + scale : ''))
    let d = ''
    if (dispAt >= 0 && !base && !index) d = absName(disp, dispAt)
    else if (dispAt >= 0 && name && name(disp >>> 0, dispAt)) d = name(disp >>> 0, dispAt)
    else if (disp) d = hex(disp)
    let text = parts.join('+')
    if (d) text = text ? text + (d.startsWith('-') ? d : '+' + d) : d
    const sz = size === 8 ? 'byte ' : size === 16 ? 'word ' : 'dword '
    return { reg, rm: sz + seg + '[' + text + ']', isReg: false, mod, rmn: rm }
  }
  const imm = (size) => (size === 8 ? i8() : size === 16 ? i16() : i32())
  const out = (text, extra = {}) => Object.assign({ len: p - off, text }, extra)
  const op = b[p++]
  const sz = opsize
  // ALU ops 00-3f
  if (op < 0x40 && (op & 7) < 6) {
    const k = ALU[op >> 3], f = op & 7
    if (f === 0) { const m = modrm(8); return out(`${k} ${m.rm}, ${R8[m.reg]}`) }
    if (f === 1) { const m = modrm(sz); return out(`${k} ${m.rm}, ${regs(sz)[m.reg]}`) }
    if (f === 2) { const m = modrm(8); return out(`${k} ${R8[m.reg]}, ${m.rm}`) }
    if (f === 3) { const m = modrm(sz); return out(`${k} ${regs(sz)[m.reg]}, ${m.rm}`) }
    if (f === 4) return out(`${k} al, ${hex(i8())}`)
    const at = p; const v = imm(sz); return out(`${k} ${regs(sz)[0]}, ${sz === 32 ? absName(v, at) : hex(v)}`)
  }
  if (op >= 0x40 && op <= 0x47) return out(`inc ${regs(sz)[op & 7]}`)
  if (op >= 0x48 && op <= 0x4f) return out(`dec ${regs(sz)[op & 7]}`)
  if (op >= 0x50 && op <= 0x57) return out(`push ${R32[op & 7]}`)
  if (op >= 0x58 && op <= 0x5f) return out(`pop ${R32[op & 7]}`)
  if (op === 0x60) return out('pushad')
  if (op === 0x61) return out('popad')
  if (op === 0x68) { const at = p; return out(`push ${absName(i32(), at)}`) }
  if (op === 0x6a) return out(`push ${hex(i8())}`)
  if (op === 0x69) { const m = modrm(sz); const at = p; return out(`imul ${regs(sz)[m.reg]}, ${m.rm}, ${absName(imm(sz), at)}`) }
  if (op === 0x6b) { const m = modrm(sz); return out(`imul ${regs(sz)[m.reg]}, ${m.rm}, ${hex(i8())}`) }
  if (op >= 0x70 && op <= 0x7f) { const d = i8(); const t = addr + (p - off) + d; return out(`j${CC[op & 15]} ${hex(t)}`, { target: t, jcc: true }) }
  if (op === 0x80 || op === 0x81 || op === 0x83) {
    const s = op === 0x80 ? 8 : sz; const m = modrm(s); const at = p
    const v = op === 0x81 ? imm(sz) : i8()
    return out(`${ALU[m.reg]} ${m.rm}, ${op === 0x81 && sz === 32 ? absName(v, at) : hex(v)}`)
  }
  if (op === 0x84) { const m = modrm(8); return out(`test ${m.rm}, ${R8[m.reg]}`) }
  if (op === 0x85) { const m = modrm(sz); return out(`test ${m.rm}, ${regs(sz)[m.reg]}`) }
  if (op === 0x86) { const m = modrm(8); return out(`xchg ${m.rm}, ${R8[m.reg]}`) }
  if (op === 0x87) { const m = modrm(sz); return out(`xchg ${m.rm}, ${regs(sz)[m.reg]}`) }
  if (op === 0x88) { const m = modrm(8); return out(`mov ${m.rm}, ${R8[m.reg]}`) }
  if (op === 0x89) { const m = modrm(sz); return out(`mov ${m.rm}, ${regs(sz)[m.reg]}`) }
  if (op === 0x8a) { const m = modrm(8); return out(`mov ${R8[m.reg]}, ${m.rm}`) }
  if (op === 0x8b) { const m = modrm(sz); return out(`mov ${regs(sz)[m.reg]}, ${m.rm}`) }
  if (op === 0x8c) { const m = modrm(16); return out(`mov ${m.rm}, ${SREG[m.reg]}`) }
  if (op === 0x8d) { const m = modrm(sz); return out(`lea ${regs(sz)[m.reg]}, ${m.rm.replace(/^(dword|word|byte) /, '')}`) }
  if (op === 0x8e) { const m = modrm(16); return out(`mov ${SREG[m.reg]}, ${m.rm}`) }
  if (op === 0x8f) { const m = modrm(sz); return out(`pop ${m.rm}`) }
  if (op === 0x90) return out('nop')
  if (op >= 0x91 && op <= 0x97) return out(`xchg ${regs(sz)[0]}, ${regs(sz)[op & 7]}`)
  if (op === 0x98) return out(sz === 16 ? 'cbw' : 'cwde')
  if (op === 0x99) return out(sz === 16 ? 'cwd' : 'cdq')
  if (op === 0x9c) return out('pushfd')
  if (op === 0x9d) return out('popfd')
  if (op === 0x9e) return out('sahf')
  if (op === 0x9f) return out('lahf')
  if (op >= 0xa0 && op <= 0xa3) {
    const at = p; const a = absName(i32(), at); const s = op & 1 ? sz : 8; const r = regs(s)[0]
    const m = (s === 8 ? 'byte ' : s === 16 ? 'word ' : 'dword ') + seg + '[' + a + ']'
    return out(op < 0xa2 ? `mov ${r}, ${m}` : `mov ${m}, ${r}`)
  }
  if (op >= 0xa4 && op <= 0xaf && op !== 0xa8 && op !== 0xa9) {
    const names = { 0xa4: 'movsb', 0xa5: sz === 16 ? 'movsw' : 'movsd', 0xa6: 'cmpsb', 0xa7: 'cmpsd', 0xaa: 'stosb', 0xab: sz === 16 ? 'stosw' : 'stosd', 0xac: 'lodsb', 0xad: 'lodsd', 0xae: 'scasb', 0xaf: 'scasd' }
    return out(rep + names[op])
  }
  if (op === 0xa8) return out(`test al, ${hex(u8())}`)
  if (op === 0xa9) { const at = p; return out(`test ${regs(sz)[0]}, ${sz === 32 ? absName(imm(sz), at) : hex(imm(sz))}`) }
  if (op >= 0xb0 && op <= 0xb7) return out(`mov ${R8[op & 7]}, ${hex(u8())}`)
  if (op >= 0xb8 && op <= 0xbf) { const at = p; const v = imm(sz); return out(`mov ${regs(sz)[op & 7]}, ${sz === 32 ? absName(v, at) : hex(v)}`) }
  if (op === 0xc0 || op === 0xc1) { const m = modrm(op === 0xc0 ? 8 : sz); return out(`${SHIFT[m.reg]} ${m.rm}, ${u8()}`) }
  if (op === 0xc2) return out(`ret ${hex(b.readUInt16LE((p += 2) - 2))}`, { ret: true })
  if (op === 0xc3) return out('ret', { ret: true })
  if (op === 0xc6) { const m = modrm(8); return out(`mov ${m.rm}, ${hex(u8())}`) }
  if (op === 0xc7) { const m = modrm(sz); const at = p; const v = imm(sz); return out(`mov ${m.rm}, ${sz === 32 ? absName(v, at) : hex(v)}`) }
  if (op === 0xc9) return out('leave')
  if (op === 0xcc) return out('int3')
  if (op === 0xcd) return out(`int ${hex(u8())}`)
  if (op >= 0xd0 && op <= 0xd3) { const m = modrm(op & 1 ? sz : 8); return out(`${SHIFT[m.reg]} ${m.rm}, ${op >= 0xd2 ? 'cl' : '1'}`) }
  if (op >= 0xd8 && op <= 0xdf) { const m = modrm(32); return out(`fpu ${hex(op)}/${m.reg} ${m.isReg ? 'st' + m.rmn : m.rm}`) }
  if (op === 0xe3) { const d = i8(); const t = addr + (p - off) + d; return out(`jecxz ${hex(t)}`, { target: t, jcc: true }) }
  if (op === 0xe8) { const d = i32(); const t = (addr + (p - off) + d) >>> 0; return out(`call ${(name && name(t, -1, true)) || hex(t)}`, { target: t, call: true }) }
  if (op === 0xe9) { const d = i32(); const t = (addr + (p - off) + d) >>> 0; return out(`jmp ${hex(t)}`, { target: t, jmp: true }) }
  if (op === 0xeb) { const d = i8(); const t = addr + (p - off) + d; return out(`jmp ${hex(t)}`, { target: t, jmp: true }) }
  if (op === 0xf6 || op === 0xf7) {
    const s = op === 0xf6 ? 8 : sz; const m = modrm(s)
    if (m.reg < 2) { const v = s === 8 ? u8() : imm(s); return out(`test ${m.rm}, ${hex(v)}`) }
    return out(`${GRP3[m.reg]} ${m.rm}`)
  }
  if (op === 0xf8) return out('clc')
  if (op === 0xf9) return out('stc')
  if (op === 0xfc) return out('cld')
  if (op === 0xfd) return out('std')
  if (op === 0xfe) { const m = modrm(8); return out(`${m.reg ? 'dec' : 'inc'} ${m.rm}`) }
  if (op === 0xff) { const m = modrm(sz); return out(`${GRP5[m.reg]} ${m.rm}`, { call: m.reg === 2, jmp: m.reg === 4, indirect: true }) }
  if (op === 0x0f) {
    const o2 = b[p++]
    if (o2 >= 0x80 && o2 <= 0x8f) { const d = i32(); const t = (addr + (p - off) + d) >>> 0; return out(`j${CC[o2 & 15]} ${hex(t)}`, { target: t, jcc: true }) }
    if (o2 >= 0x90 && o2 <= 0x9f) { const m = modrm(8); return out(`set${CC[o2 & 15]} ${m.rm}`) }
    if (o2 >= 0x40 && o2 <= 0x4f) { const m = modrm(sz); return out(`cmov${CC[o2 & 15]} ${regs(sz)[m.reg]}, ${m.rm}`) }
    if (o2 === 0xaf) { const m = modrm(sz); return out(`imul ${regs(sz)[m.reg]}, ${m.rm}`) }
    if (o2 === 0xb6 || o2 === 0xbe) { const m = modrm(8); return out(`${o2 === 0xb6 ? 'movzx' : 'movsx'} ${regs(sz)[m.reg]}, ${m.rm}`) }
    if (o2 === 0xb7 || o2 === 0xbf) { const m = modrm(16); return out(`${o2 === 0xb7 ? 'movzx' : 'movsx'} ${regs(sz)[m.reg]}, ${m.rm}`) }
    if (o2 === 0xa4 || o2 === 0xac) { const m = modrm(sz); return out(`${o2 === 0xa4 ? 'shld' : 'shrd'} ${m.rm}, ${regs(sz)[m.reg]}, ${u8()}`) }
    if (o2 === 0xa5 || o2 === 0xad) { const m = modrm(sz); return out(`${o2 === 0xa5 ? 'shld' : 'shrd'} ${m.rm}, ${regs(sz)[m.reg]}, cl`) }
    if (o2 === 0xa3 || o2 === 0xab || o2 === 0xb3 || o2 === 0xbb) { const m = modrm(sz); return out(`${{ 0xa3: 'bt', 0xab: 'bts', 0xb3: 'btr', 0xbb: 'btc' }[o2]} ${m.rm}, ${regs(sz)[m.reg]}`) }
    if (o2 === 0xba) { const m = modrm(sz); return out(`${['?', '?', '?', '?', 'bt', 'bts', 'btr', 'btc'][m.reg]} ${m.rm}, ${u8()}`) }
    if (o2 === 0xbc || o2 === 0xbd) { const m = modrm(sz); return out(`${o2 === 0xbc ? 'bsf' : 'bsr'} ${regs(sz)[m.reg]}, ${m.rm}`) }
    if (o2 === 0xa0 || o2 === 0xa8) return out(`push ${o2 === 0xa0 ? 'fs' : 'gs'}`)
    if (o2 === 0xa1 || o2 === 0xa9) return out(`pop ${o2 === 0xa1 ? 'fs' : 'gs'}`)
    if (o2 === 0xa2) return out('cpuid')
    if (o2 === 0x31) return out('rdtsc')
    return out(`db 0x0f, ${hex(o2)}`, { unknown: true })
  }
  if (op === 0x06 || op === 0x0e || op === 0x16 || op === 0x1e) return out(`push ${['es', 'cs', 'ss', 'ds'][(op >> 3) & 3]}`)
  if (op === 0x07 || op === 0x17 || op === 0x1f) return out(`pop ${['es', '?', 'ss', 'ds'][(op >> 3) & 3]}`)
  if (op === 0x27) return out('daa')
  if (op === 0xe4) return out(`in al, ${hex(u8())}`)
  if (op === 0xe6) return out(`out ${hex(u8())}, al`)
  if (op === 0xec) return out('in al, dx')
  if (op === 0xee) return out('out dx, al')
  if (op === 0xfa) return out('cli')
  if (op === 0xfb) return out('sti')
  if (op === 0xf4) return out('hlt')
  return out(`db ${hex(op)}`, { unknown: true })
}
