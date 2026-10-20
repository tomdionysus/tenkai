// Blood's sprite animation sequences (.SEQ in BLOOD.RFF): "SEQ\x1a", u16 version (0x300), i16 frames, i16 ticksPerFrame,
// i16 sound, i32 flags, then 8 bytes a frame, bit-packed: tile:12 transparent:1 transparent2:1 blockable:1 hittable:1
// xrepeat:8 yrepeat:8 shade:8(signed) pal:5 trigger:1 smoke:1 aim:1 pushable:1 playSound:1 invisible:1 flipX:1 flipY:1
// tile2:4 (the tile's high bits) soundRange:4 surfaceSound:1 reserved:2
import Bits from './bits.mjs'

export default function seq (buffer) {
  if (buffer.toString('latin1', 0, 4) !== 'SEQ\x1a') throw new Error('not a SEQ')
  const s = { version: buffer.readUInt16LE(4), ticksPerFrame: buffer.readInt16LE(8), sound: buffer.readInt16LE(10), flags: buffer.readInt32LE(12), frames: [] }
  const n = buffer.readInt16LE(6)
  for (let i = 0; i < n; i++) {
    const b = new Bits(buffer, 16 + i * 8)
    const f = {}
    f.tile = b.u(12); f.transparent = b.u(1); f.transparent2 = b.u(1); f.blockable = b.u(1); f.hittable = b.u(1)
    f.xrepeat = b.u(8); f.yrepeat = b.u(8); f.shade = b.s(8); f.pal = b.u(5); f.trigger = b.u(1); f.smoke = b.u(1); f.aim = b.u(1)
    f.pushable = b.u(1); f.playSound = b.u(1); f.invisible = b.u(1); f.flipX = b.u(1); f.flipY = b.u(1); f.tile += b.u(4) << 12; f.soundRange = b.u(4); f.surfaceSound = b.u(1); b.skip(2)
    s.frames.push(f)
  }
  // 57 of the 396 carry 8 bytes more than their count says (an unused frame); the original reads only the count
  if (16 + n * 8 > buffer.length) throw new Error('SEQ short by ' + (16 + n * 8 - buffer.length) + ' bytes')
  return s
}
