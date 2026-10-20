// Blood's maps (BLOOD.RFF E1M1.MAP ...), version 6.03 as the shareware ships them, read as found:
//   "BLM\x1a", u16 version (0x603)
//   header, 37 bytes: i32 x, y, z; i16 ang, sector; i16 pskybits; i32 visibility; i32 songId; u8 parallaxType;
//     i32 revision; i16 sectors, walls, sprites
//   i16 skyOffsets[2 ** pskybits]
//   the sectors: a 40-byte Build sector, followed by a 60-byte XSECTOR when its extra > 0
//   the walls: a 32-byte Build wall, followed by a 24-byte XWALL when its extra > 0
//   the sprites: a 44-byte Build sprite, followed by a 56-byte XSPRITE when its extra > 0
//   4 bytes (a checksum)
// The sector's, wall's and sprite's `extra` is given the index of its extra record in the lists here. The extra
// records are bit fields, laid out as Blood's structures (the first field of each is the index of its owner,
// which the reader checks). Version 7.00 maps (the retail 1.21 release) are encrypted; not handled here.
import Bits from './bits.mjs'

export default class BloodMap {
  /** @param {Buffer} m The map file's bytes */
  constructor (m) {
    if (m.toString('latin1', 0, 4) !== 'BLM\x1a') throw new Error('not a Blood map')
    this.version = m.readUInt16LE(4)
    if (this.version !== 0x603) throw new Error('map version ' + this.version.toString(16) + ' not handled')
    this.start = { x: m.readInt32LE(6), y: m.readInt32LE(10), z: m.readInt32LE(14), ang: m.readInt16LE(18), sector: m.readInt16LE(20) }
    this.pskybits = m.readInt16LE(22)
    this.visibility = m.readInt32LE(24)
    this.songId = m.readInt32LE(28)
    this.parallaxType = m[32]
    this.revision = m.readInt32LE(33)
    const ns = m.readInt16LE(37), nw = m.readInt16LE(39), nsp = m.readInt16LE(41)
    let p = 43
    this.skyOffsets = []
    for (let i = 0; i < (1 << this.pskybits); i++, p += 2) this.skyOffsets.push(m.readInt16LE(p))
    this.sectors = []; this.xsectors = []
    for (let i = 0; i < ns; i++) {
      const s = {
        wallptr: m.readInt16LE(p), wallnum: m.readInt16LE(p + 2), ceilingz: m.readInt32LE(p + 4), floorz: m.readInt32LE(p + 8),
        ceilingstat: m.readUInt16LE(p + 12), floorstat: m.readUInt16LE(p + 14),
        ceilingpicnum: m.readInt16LE(p + 16), ceilingheinum: m.readInt16LE(p + 18), ceilingshade: m.readInt8(p + 20), ceilingpal: m[p + 21], ceilingxpanning: m[p + 22], ceilingypanning: m[p + 23],
        floorpicnum: m.readInt16LE(p + 24), floorheinum: m.readInt16LE(p + 26), floorshade: m.readInt8(p + 28), floorpal: m[p + 29], floorxpanning: m[p + 30], floorypanning: m[p + 31],
        visibility: m[p + 32], filler: m[p + 33], lotag: m.readInt16LE(p + 34), hitag: m.readInt16LE(p + 36), extra: m.readInt16LE(p + 38)
      }
      p += 40
      if (s.extra > 0) { s.extra = this.xsectors.length; this.xsectors.push(BloodMap.xsector(m, p, i)); p += 60 } else s.extra = -1
      this.sectors.push(s)
    }
    this.walls = []; this.xwalls = []
    for (let i = 0; i < nw; i++) {
      const w = {
        x: m.readInt32LE(p), y: m.readInt32LE(p + 4), point2: m.readInt16LE(p + 8), nextwall: m.readInt16LE(p + 10), nextsector: m.readInt16LE(p + 12),
        cstat: m.readUInt16LE(p + 14), picnum: m.readInt16LE(p + 16), overpicnum: m.readInt16LE(p + 18), shade: m.readInt8(p + 20), pal: m[p + 21],
        xrepeat: m[p + 22], yrepeat: m[p + 23], xpanning: m[p + 24], ypanning: m[p + 25], lotag: m.readInt16LE(p + 26), hitag: m.readInt16LE(p + 28), extra: m.readInt16LE(p + 30)
      }
      p += 32
      if (w.extra > 0) { w.extra = this.xwalls.length; this.xwalls.push(BloodMap.xwall(m, p, i)); p += 24 } else w.extra = -1
      this.walls.push(w)
    }
    this.sprites = []; this.xsprites = []
    for (let i = 0; i < nsp; i++) {
      const s = {
        x: m.readInt32LE(p), y: m.readInt32LE(p + 4), z: m.readInt32LE(p + 8), cstat: m.readUInt16LE(p + 12), picnum: m.readInt16LE(p + 14),
        shade: m.readInt8(p + 16), pal: m[p + 17], clipdist: m[p + 18], filler: m[p + 19], xrepeat: m[p + 20], yrepeat: m[p + 21], xoffset: m.readInt8(p + 22), yoffset: m.readInt8(p + 23),
        sectnum: m.readInt16LE(p + 24), statnum: m.readInt16LE(p + 26), ang: m.readInt16LE(p + 28), owner: m.readInt16LE(p + 30),
        xvel: m.readInt16LE(p + 32), yvel: m.readInt16LE(p + 34), zvel: m.readInt16LE(p + 36), lotag: m.readInt16LE(p + 38), hitag: m.readInt16LE(p + 40), extra: m.readInt16LE(p + 42)
      }
      p += 44
      if (s.extra > 0) { s.extra = this.xsprites.length; this.xsprites.push(BloodMap.xsprite(m, p, i)); p += 56 } else s.extra = -1
      this.sprites.push(s)
    }
    this.trailer = m.readUInt32LE(p)
    if (p + 4 !== m.length) throw new Error('map has ' + (m.length - p - 4) + ' bytes over')
  }

  static xsector (m, p, owner) {
    const b = new Bits(m, p)
    const x = {}
    x.reference = b.u(14); x.state = b.u(1); x.busy = b.u(17)
    x.data = b.u(16); x.txID = b.u(10); x.busyWaveA = b.u(3); x.busyWaveB = b.u(3)
    x.rxID = b.u(10); x.command = b.u(8); x.triggerOn = b.u(1); x.triggerOff = b.u(1); x.busyTimeA = b.u(12)
    x.waitTimeA = b.u(12); x.restState = b.u(1); x.interruptable = b.u(1); x.amplitude = b.s(8); x.freq = b.u(8); x.reTriggerA = b.u(1); x.reTriggerB = b.u(1)
    x.phase = b.u(8); x.wave = b.u(4); x.shadeAlways = b.u(1); x.shadeFloor = b.u(1); x.shadeCeiling = b.u(1); x.shadeWalls = b.u(1)
    x.shade = b.s(8); x.panAlways = b.u(1); x.panFloor = b.u(1); x.panCeiling = b.u(1); x.drag = b.u(1); x.underwater = b.u(1); x.depth = b.u(3)
    x.panVel = b.u(8); x.panAngle = b.u(11); x.wind = b.u(1); x.decoupled = b.u(1); x.triggerOnce = b.u(1); x.isTriggered = b.u(1); x.key = b.u(3)
    x.push = b.u(1); x.vector = b.u(1); x.reserved = b.u(1); x.enter = b.u(1); x.exit = b.u(1); x.wallPush = b.u(1)
    x.color = b.u(1); x.unused1 = b.u(1); x.busyTimeB = b.u(12); x.waitTimeB = b.u(12); x.stopOn = b.u(1); x.stopOff = b.u(1); x.ceilpal = b.u(4)
    x.offCeilZ = b.s(32); x.onCeilZ = b.s(32); x.offFloorZ = b.s(32); x.onFloorZ = b.s(32)
    x.marker0 = b.u(16); x.marker1 = b.u(16)
    x.crush = b.u(1); x.ceilXPanFrac = b.u(8); x.ceilYPanFrac = b.u(8); x.floorXPanFrac = b.u(8); x.damageType = b.u(3); x.floorpal = b.u(4)
    x.floorYPanFrac = b.u(8); x.locked = b.u(1); x.windVel = b.u(10); x.windAng = b.u(11); x.windAlways = b.u(1); x.dudeLockout = b.u(1)
    x.bobTheta = b.u(11); x.bobSpeed = b.s(5); x.bobAlways = b.u(1); x.bobFloor = b.u(1); x.bobCeiling = b.u(1); x.bobRotate = b.u(1); x.unused2 = b.u(12)
    if (b.pos !== 480) throw new Error('xsector bits ' + b.pos)
    x.owner = owner
    return x
  }

  static xwall (m, p, owner) {
    const b = new Bits(m, p)
    const x = {}
    x.reference = b.u(14); x.state = b.u(1); x.busy = b.u(17)
    x.data = b.u(16); x.txID = b.u(10); x.unused1 = b.u(6)
    x.rxID = b.u(10); x.command = b.u(8); x.triggerOn = b.u(1); x.triggerOff = b.u(1); x.busyTime = b.u(12)
    x.waitTime = b.u(12); x.restState = b.u(1); x.interruptable = b.u(1); x.panAlways = b.u(1); x.panXVel = b.s(8); x.panYVel = b.s(8); x.decoupled = b.u(1)
    x.triggerOnce = b.u(1); x.isTriggered = b.u(1); x.key = b.u(3); x.push = b.u(1); x.vector = b.u(1); x.reserved = b.u(1); x.xpanFrac = b.u(8); x.ypanFrac = b.u(8)
    x.locked = b.u(1); x.dudeLockout = b.u(1); x.unused2 = b.u(6); x.unused3 = b.u(32)
    if (b.pos !== 192) throw new Error('xwall bits ' + b.pos)
    x.owner = owner
    return x
  }

  static xsprite (m, p, owner) {
    const b = new Bits(m, p)
    const x = {}
    x.reference = b.u(14); x.state = b.u(1); x.busy = b.u(17)
    x.txID = b.u(10); x.rxID = b.u(10); x.command = b.u(8); x.triggerOn = b.u(1); x.triggerOff = b.u(1); x.wave = b.u(2)
    x.busyTime = b.u(12); x.waitTime = b.u(12); x.restState = b.u(1); x.interruptable = b.u(1); x.unused1 = b.u(2); x.respawnPending = b.u(2); x.unused2 = b.u(1); x.lT = b.u(1)
    x.dropMsg = b.u(8); x.decoupled = b.u(1); x.triggerOnce = b.u(1); x.isTriggered = b.u(1); x.key = b.u(3); x.push = b.u(1); x.vector = b.u(1)
    x.impact = b.u(1); x.pickup = b.u(1); x.touch = b.u(1); x.sight = b.u(1); x.proximity = b.u(1); x.unused3 = b.u(2); x.lSkill = b.u(5); x.lS = b.u(1); x.lB = b.u(1); x.lC = b.u(1); x.lCoop = b.u(1)
    x.data1 = b.s(16); x.data2 = b.s(16); x.data3 = b.s(16)
    x.goalAng = b.u(11); x.dodgeDir = b.s(2); x.locked = b.u(1); x.medium = b.u(2)
    x.respawn = b.u(2); x.data4 = b.u(16); x.unused4 = b.u(6); x.lockMsg = b.u(8)
    x.health = b.u(12); x.dudeDeaf = b.u(1); x.dudeAmbush = b.u(1); x.dudeGuard = b.u(1); x.dudeFlag4 = b.u(1)
    x.target = b.s(16); x.targetX = b.s(32); x.targetY = b.s(32); x.targetZ = b.s(32)
    x.burnTime = b.u(16); x.burnSource = b.s(16); x.height = b.u(16); x.stateTimer = b.u(16); x.aiState = b.u(32)
    if (b.pos !== 448) throw new Error('xsprite bits ' + b.pos)
    x.owner = owner
    return x
  }
}
