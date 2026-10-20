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

  /** Player sprites: statnum 6 (dudes), type 231-238 (players 1-8), clipdist 48; offsets, in heap order */
  findPlayers () {
    const h = this.heap, out = []
    for (let o = 0; o + 44 < h.length; o += 2) {
      if (h[o + 26] !== 6 || h[o + 27] !== 0 || h[o + 39] !== 0 || h[o + 18] !== 48) continue
      const type = h[o + 38]
      if (type >= 231 && type <= 238) out.push(o)
    }
    return out
  }

  /**
   * Blood's arrays in the emulated memory, found from the map they were loaded from: the sectors (40 bytes each) by
   * the first sector's wallptr, wallnum and ceiling, the walls (32) by the first two walls' points, the sprites (44)
   * by the sprite whose position is unique. Returns { sectors, walls, sprites } offsets (or null where not found).
   */
  findArrays (map) {
    const out = { sectors: null, walls: null, sprites: null }
    const s0 = map.sectors[0]
    for (const o of this.findInt32s([s0.ceilingz, s0.floorz])) {
      if (this.i16(o - 4) === s0.wallptr && this.i16(o - 2) === s0.wallnum && this.i16(o + 8 + 40 - 8 - 4) !== undefined) { out.sectors = o - 4; break }
    }
    const w0 = map.walls[0], w1 = map.walls[1]
    for (const o of this.findInt32s([w0.x, w0.y])) if (this.i32(o + 32) === w1.x && this.i32(o + 36) === w1.y) { out.walls = o; break }
    // A sprite that does not move (a marker), by its x, y, z and picnum
    map.sprites.some((sp, i) => {
      if (sp.statnum !== 10) return false
      for (const o of this.findInt32s([sp.x, sp.y, sp.z])) if (this.i16(o + 14) === sp.picnum) { out.sprites = o - i * 44; return true }
      return false
    })
    return out
  }

  sector (base, i) {
    const o = base + i * 40
    return { wallptr: this.i16(o), wallnum: this.i16(o + 2), ceilingz: this.i32(o + 4), floorz: this.i32(o + 8), ceilingstat: this.u16(o + 12), floorstat: this.u16(o + 14), ceilingpicnum: this.i16(o + 16), floorpicnum: this.i16(o + 24) }
  }

  wall (base, i) { const o = base + i * 32; return { x: this.i32(o), y: this.i32(o + 4), point2: this.i16(o + 8), nextwall: this.i16(o + 10), nextsector: this.i16(o + 12), cstat: this.u16(o + 14), picnum: this.i16(o + 16) } }

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
