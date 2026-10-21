// Tables read out of BLOOD.EXE (the shareware's v1.11, an LE executable for DOS/4GW), found by their signatures
// rather than fixed offsets: Blood's game data lives there as packed C structures.
//
// dudeInfo (148 bytes each, from type 201): i16 seqStartID, i16 startHealth, u16 mass, i32 at6, u8 clipdist,
// i32 eyeHeight, aimHeight, hearDist, seeDist, periphery, meleeDist, fleeHealth, hinderDamage, changeTargetChance,
// changeTargetKinChance, alertChance; u8 lockOut; i32 frontSpeed, sideSpeed, backSpeed, angSpeed, gibType[3],
// startDamage[7], damageVal[7], at8c, at90. Found by the cultist's first fields (4096, 40, 70, 1200, 48).
import fs from 'fs'

export default class BloodExe {
  constructor (buffer) { this.b = buffer }
  static load (path) { return new BloodExe(fs.readFileSync(path)) }

  find (bytes, from = 0) { return this.b.indexOf(Buffer.from(bytes), from) }

  /**
   * Blood's hitscans (VECTORDATA, 134 bytes each): u8 dmgType, i32 dmg, impulse, maxDist, fxChance, burnTime,
   * bloodSplats, splatChance, then 15 surfaces' { u8 fx1, fx2, fx3, i32 sound }. Found by the pitchfork's tine
   * (17, 174762, 1152); 23 of them, in Blood's order (tine, shell, bullet, ...).
   */
  vectorData () {
    const at = this.find([0x11, 0, 0, 0, 0xaa, 0xaa, 0x02, 0, 0x80, 0x04, 0, 0]) - 1
    if (at < 0) throw new Error('vectorData not found')
    const out = []
    for (let k = 0; k < 23; k++) {
      const o = at + k * 134, b = this.b
      const v = { dmgType: b[o], dmg: b.readInt32LE(o + 1), impulse: b.readInt32LE(o + 5), maxDist: b.readInt32LE(o + 9), fxChance: b.readInt32LE(o + 13), burnTime: b.readInt32LE(o + 17), bloodSplats: b.readInt32LE(o + 21), splatChance: b.readInt32LE(o + 25), surfaces: [] }
      for (let s = 0; s < 15; s++) { const p = o + 29 + s * 7; v.surfaces.push({ fx: [b.readInt8(p), b.readInt8(p + 1), b.readInt8(p + 2)], sound: b.readInt32LE(p + 3) }) }
      out.push(v)
    }
    return out
  }

  /** The weapons lying about (from type 40, 14 bytes each): cstat, picnum, shade, pal, repeats, weapon, ammo type, count */
  weaponItems () {
    const at = this.find([0x2f, 0x02, 0xf8, 0x00, 0x30, 0x30, 0x03, 0x00, 0x02, 0x00]) - 2 - 14 // the sawed-off is type 41
    const out = {}
    for (let k = 0; k < 11; k++) {
      const o = at + k * 14, b = this.b
      out[40 + k] = { cstat: b.readInt16LE(o), picnum: b.readInt16LE(o + 2), shade: b.readInt8(o + 4), pal: b[o + 5], xrepeat: b[o + 6], yrepeat: b[o + 7], weapon: b.readInt16LE(o + 8), ammoType: b.readInt16LE(o + 10), count: b.readInt16LE(o + 12) }
    }
    return out
  }

  /** The ammo lying about (from type 60, 12 bytes each): cstat, picnum, shade, pal, repeats, count, ammo type, weapon */
  ammoItems () {
    // The first record on the bundle of TNT's tile is type 62 (the maps' type 67 is tile 619, 68 is 812: so the table starts at 60)
    const at = this.find([0x4d, 0x02, 0xf8, 0x00, 0x30, 0x30, 0x01, 0x00, 0x05, 0x06]) - 2 - 12
    const out = {}
    for (let k = 0; k < 21; k++) {
      const o = at + k * 12, b = this.b
      out[60 + k] = { cstat: b.readInt16LE(o), picnum: b.readInt16LE(o + 2), shade: b.readInt8(o + 4), pal: b[o + 5], xrepeat: b[o + 6], yrepeat: b[o + 7], count: b.readInt16LE(o + 8), ammoType: b[o + 10], weapon: b[o + 11] }
    }
    return out
  }

  /** Keys, health and powerups (from type 100, 10 bytes each): cstat, picnum, shade, pal, repeats, pack slot */
  items () {
    const at = this.find([0xf8, 0x09, 0xf8, 0x00, 0x20, 0x20]) - 2 // the skull key, type 100
    const out = {}
    for (let k = 0; k < 50; k++) {
      const o = at + k * 10, b = this.b
      out[100 + k] = { cstat: b.readInt16LE(o), picnum: b.readInt16LE(o + 2), shade: b.readInt8(o + 4), pal: b[o + 5], xrepeat: b[o + 6], yrepeat: b[o + 7], packSlot: b.readInt16LE(o + 8) }
    }
    return out
  }

  /** Blood's missileInfo (14 bytes each, types 300-317): i16 picnum, i32 velocity, angleOfs, u8 xrepeat, yrepeat, i8 shade, u8 clipdist */
  missileInfo () {
    const at = this.find([0x5a, 0x08, 0xee, 0xee, 0x0e, 0x00])
    if (at < 0) throw new Error('missileInfo not found')
    const out = []
    for (let k = 0; k < 18; k++) {
      const o = at + k * 14, b = this.b
      out.push({ picnum: b.readInt16LE(o), velocity: b.readInt32LE(o + 2), angleOfs: b.readInt32LE(o + 6), xrepeat: b[o + 10], yrepeat: b[o + 11], shade: b.readInt8(o + 12), clipdist: b[o + 13] })
    }
    return out
  }

  /** Blood's thingInfo (51 bytes each, types 400-429): i16 startHealth, mass, u8 clipdist, i16 flags, i32 elastic, dmgResist, i16 cstat, picnum, i8 shade, u8 pal, xrepeat, yrepeat, i32 dmgControl[7] */
  thingInfo () {
    const at = this.find([0x19, 0x00, 0xfa, 0x00, 0x20, 0x0b, 0x00, 0x00, 0x10, 0x00, 0x00, 0x50])
    if (at < 0) throw new Error('thingInfo not found')
    const out = {}
    for (let k = 0; k < 30; k++) {
      const o = at + k * 51, b = this.b
      out[400 + k] = { startHealth: b.readInt16LE(o), mass: b.readInt16LE(o + 2), clipdist: b[o + 4], flags: b.readInt16LE(o + 5), elastic: b.readInt32LE(o + 7), dmgResist: b.readInt32LE(o + 11), cstat: b.readInt16LE(o + 15), picnum: b.readInt16LE(o + 17), shade: b.readInt8(o + 19), pal: b[o + 20], xrepeat: b[o + 21], yrepeat: b[o + 22], dmgControl: Array.from({ length: 7 }, (_, j) => b.readInt32LE(o + 23 + j * 4)) }
    }
    return out
  }

  /** Blood's explodeInfo (27 bytes each): u8 repeat, i8 dmg, u8 dmgRng, i32 radius (x 16 units), force (the concussion), burnTime, ticks, quake, flash */
  explodeInfo () {
    const at = this.find([40, 10, 10, 75, 0, 0, 0, 0xc2, 0x01, 0, 0])
    if (at < 0) throw new Error('explodeInfo not found')
    const out = []
    for (let k = 0; k < 8; k++) {
      const o = at + k * 27, b = this.b
      out.push({ repeat: b[o], dmg: b.readInt8(o + 1), dmgRng: b[o + 2], radius: b.readInt32LE(o + 3), force: b.readInt32LE(o + 7), burnTime: b.readInt32LE(o + 11), ticks: b.readInt32LE(o + 15), quake: b.readInt32LE(o + 19), flash: b.readInt32LE(o + 23) })
    }
    return out
  }

  /** Blood's gib things (GIBTHING, 20 bytes each): i32 type, picnum, chance, speed across, speed up; the run that starts with the human body's */
  gibThings () {
    const at = this.find([0xa9, 0x01, 0, 0, 0xae, 0x05, 0, 0, 0, 0, 0x0e, 0])
    if (at < 0) throw new Error('gibThings not found')
    const out = []
    for (let k = 0; k < 64; k++) {
      const o = at + k * 20, b = this.b
      const type = b.readInt32LE(o), picnum = b.readInt32LE(o + 4)
      if (type < 400 || type >= 440 || picnum < -1 || picnum >= 4096) break
      out.push({ type, picnum, chance: b.readInt32LE(o + 8), across: b.readInt32LE(o + 12), up: b.readInt32LE(o + 16) })
    }
    return out
  }

  /**
   * Blood's effects (gFXData, 26 bytes each, 57 of them): u8 callback (on reaching the floor; 255 none), u8 detail,
   * i16 seq, i16 flags (1: a chance to flip in x, 2: in y), i32 gravity, i32 drag, i32 duration (clock ticks; 0
   * lasts as its sequence), i16 picnum, u8 xrepeat, yrepeat, i16 cstat, i8 shade, u8 pal. Found by the first
   * effects' sequences (49, 50, 51).
   */
  fxData () {
    const at = this.find([0xff, 0x00, 0x31, 0x00, 0x01, 0x00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0x00, 0x32, 0x00])
    if (at < 0) throw new Error('fxData not found')
    const out = []
    for (let k = 0; k < 57; k++) {
      const o = at + k * 26, b = this.b
      out.push({ callback: b[o], detail: b[o + 1], seq: b.readInt16LE(o + 2), flags: b.readInt16LE(o + 4), gravity: b.readInt32LE(o + 6), drag: b.readInt32LE(o + 10), duration: b.readInt32LE(o + 14), picnum: b.readInt16LE(o + 18), xrepeat: b[o + 20], yrepeat: b[o + 21], cstat: b.readInt16LE(o + 22), shade: b.readInt8(o + 24), pal: b[o + 25] })
    }
    return out
  }

  /**
   * Blood's gibList (20 bytes each, 31 of them): a pointer to its GIBFX records and their count, a pointer to its
   * GIBTHING records and their count, a sound. GIBFX (21 bytes, packed): i32 fx, i8 pal (-1: the sprite's own),
   * i32 chance, i32 count, i32 speed across, i32 speed up. GIBTHING (20 bytes): i32 type, picnum (-1: the thing's
   * own), chance, speed across, speed up. The pointers are offsets in the data object: found from its first
   * GIBFX record (glass: effect 18, three of them, 200 and 400) at its offset there, 0x1b758.
   */
  gibList () {
    const first = this.find([0x12, 0, 0, 0, 0, 0, 0, 1, 0, 3, 0, 0, 0, 0xc8, 0, 0, 0, 0x90, 0x01, 0, 0, 0x1f])
    if (first < 0) throw new Error('gibList not found')
    const data = first - 0x1b758, b = this.b
    const out = []
    for (let k = 0; k < 31; k++) {
      const o = data + 0x1bcd8 + k * 20
      const fxAt = b.readInt32LE(o), nfx = b.readInt32LE(o + 4), thingAt = b.readInt32LE(o + 8), nthing = b.readInt32LE(o + 12)
      const fx = [], things = []
      for (let i = 0; i < nfx; i++) {
        const p = data + fxAt + i * 21
        fx.push({ fx: b.readInt32LE(p), pal: b.readInt8(p + 4), chance: b.readInt32LE(p + 5), count: b.readInt32LE(p + 9), across: b.readInt32LE(p + 13), up: b.readInt32LE(p + 17) })
      }
      for (let i = 0; i < nthing; i++) {
        const p = data + thingAt + i * 20
        things.push({ type: b.readInt32LE(p), picnum: b.readInt32LE(p + 4), chance: b.readInt32LE(p + 8), across: b.readInt32LE(p + 12), up: b.readInt32LE(p + 16) })
      }
      out.push({ fx, things, sound: b.readInt32LE(o + 16) })
    }
    return out
  }

  /** The LE header's objects and fixups (where an address is put in at load, and what it points at) */
  le () {
    if (this._le) return this._le
    const b = this.b, le = b.indexOf(Buffer.from('LE\0\0'))
    const u32 = (o) => b.readUInt32LE(o)
    const dataPages = u32(le + 0x80), objtab = le + u32(le + 0x40)
    const objs = []
    for (let i = 0; i < u32(le + 0x44); i++) {
      const o = objtab + i * 24
      objs.push({ vsize: u32(o), base: u32(o + 4), page: u32(o + 12), count: u32(o + 16), file: dataPages + (u32(o + 12) - 1) * 4096 })
    }
    // fixups by object: object number -> Map(offset in it -> { obj, off })
    const fix = new Map()
    const npages = u32(le + 0x14), fpt = le + u32(le + 0x68), frt = le + u32(le + 0x6c)
    const objOfPage = (page) => { for (let i = 0; i < objs.length; i++) if (page >= objs[i].page - 1 && page < objs[i].page - 1 + objs[i].count) return i + 1; return 0 }
    for (let page = 0; page < npages; page++) {
      let p = frt + u32(fpt + page * 4)
      const end = frt + u32(fpt + (page + 1) * 4)
      const ob = objOfPage(page), pageBase = (page - (objs[ob - 1].page - 1)) * 4096
      if (!fix.has(ob)) fix.set(ob, new Map())
      const m = fix.get(ob)
      while (p < end) {
        const stype = b[p], flags = b[p + 1]; p += 2
        let srcs = null, count = 0
        if (stype & 0x20) { count = b[p]; p += 1 } else { srcs = [b.readInt16LE(p)]; p += 2 }
        let obj
        if (flags & 0x40) { obj = b.readUInt16LE(p); p += 2 } else { obj = b[p]; p += 1 }
        let off = 0
        if ((stype & 0xf) !== 2) { if (flags & 0x10) { off = u32(p); p += 4 } else { off = b.readUInt16LE(p); p += 2 } }
        if (!srcs) { srcs = []; for (let k = 0; k < count; k++) srcs.push(b.readInt16LE(p + k * 2)); p += count * 2 }
        for (const so of srcs) m.set(pageBase + so, { obj, off })
      }
    }
    this._le = { objs, fix }
    return this._le
  }

  /**
   * Blood's AI states (AISTATE, 28 bytes in v1.11: seqId, funcId, stateTicks, then the enter, move and think
   * functions and the next state), by their offset in the data object: { seq, func, ticks, enter, move, think,
   * next }, the functions as the code's linear addresses (0x10000 based, as tools/disasm.mjs shows them), next as
   * a state's offset. Found by their shape (tools/aistates.mjs prints them).
   */
  aiStates () {
    const { objs, fix } = this.le()
    const DATA = objs[3], CODE = objs[0], df = fix.get(4) || new Map(), b = this.b
    const loaded = Math.min(DATA.count * 4096, b.length - DATA.file)
    const i32 = (o) => b.readInt32LE(DATA.file + o)
    const codeAt = (o) => { const f = df.get(o); if (f && f.obj === 1) return CODE.base + f.off; return i32(o) === 0 ? 0 : -1 }
    const dataAt = (o) => { const f = df.get(o); if (f && f.obj === 4) return f.off; return i32(o) === 0 ? 0 : -1 }
    // (a state with no functions and no next, as the statues' idle, is taken only where the code names it)
    const named = new Set()
    for (const f of (fix.get(1) || new Map()).values()) if (f.obj === 4) named.add(f.off)
    const out = new Map()
    for (let o = 0; o + 28 <= loaded; o += 4) {
      const seq = i32(o), func = i32(o + 4), ticks = i32(o + 8)
      if (seq < -1 || seq > 64 || func < -1 || func > 64 || ticks < 0 || ticks > 10000) continue
      if (df.get(o) || df.get(o + 4) || df.get(o + 8)) continue
      const enter = codeAt(o + 12), move = codeAt(o + 16), think = codeAt(o + 20), next = dataAt(o + 24)
      if (enter < 0 || move < 0 || think < 0 || next < 0) continue
      if (!(enter || move || think || next) && !named.has(o)) continue
      out.set(o, { at: o, seq, func, ticks, enter, move, think, next })
    }
    return out
  }

  dudeInfo () {
    const at = this.find([0x00, 0x10, 0x28, 0x00, 0x46, 0x00, 0xb0, 0x04, 0x00, 0x00, 0x30])
    if (at < 0) throw new Error('dudeInfo not found')
    const out = {}
    for (let k = 0; k < 60; k++) {
      const o = at + k * 148, b = this.b
      const seq = b.readInt16LE(o)
      if (seq <= 0 || seq > 30000 || (seq & 0xff)) break
      const i32 = (n) => b.readInt32LE(o + n)
      const arr = (n, c) => Array.from({ length: c }, (_, j) => b.readInt32LE(o + n + j * 4))
      out[201 + k] = {
        seqStartID: seq, startHealth: b.readInt16LE(o + 2), mass: b.readUInt16LE(o + 4), at6: i32(6), clipdist: b[o + 10],
        eyeHeight: i32(11), aimHeight: i32(15), hearDist: i32(19), seeDist: i32(23), periphery: i32(27), meleeDist: i32(31),
        fleeHealth: i32(35), hinderDamage: i32(39), changeTargetChance: i32(43), changeTargetKinChance: i32(47), alertChance: i32(51),
        lockOut: b[o + 55], frontSpeed: i32(56), sideSpeed: i32(60), backSpeed: i32(64), angSpeed: i32(68),
        gibType: arr(72, 3), startDamage: arr(84, 7), damageVal: arr(112, 7), at8c: i32(140), at90: i32(144)
      }
    }
    return out
  }
}
