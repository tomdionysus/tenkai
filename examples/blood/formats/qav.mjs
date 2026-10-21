// Blood's QAV animations (BLOOD.RFF *.QAV): the weapon in hand, drawn as up to 8 tiles a frame over the view.
//   header, 36 bytes: "QAV\x1a", u16 version (0x200), 2 pad, i32 frames, i32 ticksPerFrame, i32 duration, i32 x, i32 y,
//     i32 nSprite, 4 pad
//   a frame, 204 bytes: i32 callback (-1 none: the frame at which a weapon fires), sound { i32 id, u8 priority,
//     u8 flags, i8 range, 1 pad }, then 8 tiles of 24 bytes: i32 picnum (-1 none), x, y, z (zoom, 65536 = 1),
//     stat (Blood's RS_ flags: 1 translucent, 2 auto, 4 y-flip, 8 static, 16 aspect, 32 translucent more, ...),
//     i8 shade, u8 pal, u16 angle
export default function qav (b) {
  if (b.toString('latin1', 0, 4) !== 'QAV\x1a') throw new Error('not a QAV')
  const q = { version: b.readUInt16LE(4), ticksPerFrame: b.readInt32LE(12), duration: b.readInt32LE(16), x: b.readInt32LE(20), y: b.readInt32LE(24), frames: [] }
  const n = b.readInt32LE(8)
  for (let i = 0; i < n; i++) {
    const o = 36 + i * 204
    const f = { callback: b.readInt32LE(o), sound: { id: b.readInt32LE(o + 4), priority: b[o + 8], flags: b[o + 9], range: b.readInt8(o + 10) }, tiles: [] }
    for (let t = 0; t < 8; t++) {
      const p = o + 12 + t * 24
      const picnum = b.readInt32LE(p)
      if (picnum <= 0) continue
      f.tiles.push({ picnum, x: b.readInt32LE(p + 4), y: b.readInt32LE(p + 8), z: b.readInt32LE(p + 12), stat: b.readInt32LE(p + 16), shade: b.readInt8(p + 20), pal: b[p + 21], angle: b.readUInt16LE(p + 22) })
    }
    q.frames.push(f)
  }
  if (36 + n * 204 !== b.length) throw new Error('QAV of ' + b.length + ' bytes for ' + n + ' frames')
  return q
}
