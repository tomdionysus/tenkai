// Blood's sound descriptors (.SFX in SOUNDS.RFF): i32 relVol, i32 pitch (16.16, 65536 = as recorded), i32 pitchRange,
// i32 format (1: 11025 Hz, 5: 22050 Hz; unsigned 8-bit mono), i32 loopStart (-1: none), then the .RAW's name.
export default function sfx (buffer) {
  return { relVol: buffer.readInt32LE(0), pitch: buffer.readInt32LE(4), pitchRange: buffer.readInt32LE(8), format: buffer.readInt32LE(12), loopStart: buffer.readInt32LE(16), raw: buffer.toString('latin1', 20).replace(/\0.*$/, '') }
}
export function rate (format) { return format === 1 ? 11025 : 22050 }
/** A WAV file of unsigned 8-bit mono samples */
export function wav (samples, sampleRate) {
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + samples.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate, 28); h.writeUInt16LE(1, 32); h.writeUInt16LE(8, 34)
  h.write('data', 36); h.writeUInt32LE(samples.length, 40)
  return Buffer.concat([h, Buffer.from(samples)])
}
