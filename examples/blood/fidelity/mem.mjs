// Reading the original's memory as it runs: DOSBox's emulated RAM is inside the emulator's WebAssembly heap, so
// Blood's own structures (its sprites, its players, its clock) can be found there and read tick by tick.
//   const mem = new Mem(emu); const hits = mem.findInt32s([-14976, 33280])
export default class Mem {
  constructor (emu) { this.emu = emu }
  get heap () { return this.emu.ci.transport.module.HEAPU8 }
  get view () { const h = this.heap; return new DataView(h.buffer, h.byteOffset, h.byteLength) }

  /** Every offset where these int32s follow one another */
  findInt32s (values, from = 0, to = Infinity) {
    const h = this.heap, v = this.view, out = []
    const first = values[0] >>> 0
    const b0 = first & 255
    const end = Math.min(h.length - values.length * 4, to)
    for (let i = from; i < end; i++) {
      if (h[i] !== b0) continue
      if (v.getUint32(i, true) !== first) continue
      let ok = true
      for (let k = 1; k < values.length && ok; k++) ok = v.getInt32(i + k * 4, true) === values[k]
      if (ok) out.push(i)
    }
    return out
  }

  i32 (o) { return this.view.getInt32(o, true) }
  u32 (o) { return this.view.getUint32(o, true) }
  i16 (o) { return this.view.getInt16(o, true) }
  u16 (o) { return this.view.getUint16(o, true) }
  u8 (o) { return this.heap[o] }

  /** A Build sprite (44 bytes) at an offset */
  sprite (o) {
    return { x: this.i32(o), y: this.i32(o + 4), z: this.i32(o + 8), cstat: this.u16(o + 12), picnum: this.i16(o + 14), shade: this.view.getInt8(o + 16), pal: this.u8(o + 17),
      clipdist: this.u8(o + 18), xrepeat: this.u8(o + 20), yrepeat: this.u8(o + 21), sectnum: this.i16(o + 24), statnum: this.i16(o + 26), ang: this.i16(o + 28),
      owner: this.i16(o + 30), xvel: this.i16(o + 32), yvel: this.i16(o + 34), zvel: this.i16(o + 36), lotag: this.i16(o + 38), hitag: this.i16(o + 40), extra: this.i16(o + 42) }
  }

  /** The offsets of int32s that differ between two snapshots by an amount in a range (for finding counters) */
  static changed (a, b, lo, hi) {
    const va = new DataView(a.buffer, a.byteOffset, a.byteLength), vb = new DataView(b.buffer, b.byteOffset, b.byteLength), out = []
    for (let i = 0; i + 4 <= Math.min(a.length, b.length); i += 4) { const d = vb.getInt32(i, true) - va.getInt32(i, true); if (d >= lo && d <= hi) out.push(i) }
    return out
  }
}
