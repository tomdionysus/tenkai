// A PNG writer with nothing but Node's zlib: grey (one byte a pixel), RGBA (four), or indexed (one, with a palette).
import zlib from 'zlib'

const CRC = new Int32Array(256)
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c }
function crc32 (buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0 }
function chunk (type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0); out.write(type, 4, 'latin1'); data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}
/**
 * @param {object} o { width, height, pixels, type: 'grey' | 'rgba' | 'indexed', palette (768 bytes, for indexed), transparent (an index, optional) }
 * @returns {Buffer} the file
 */
export function png (o) {
  const bpp = o.type === 'rgba' ? 4 : 1
  const raw = Buffer.alloc((o.width * bpp + 1) * o.height)
  for (let y = 0; y < o.height; y++) {
    raw[y * (o.width * bpp + 1)] = 0
    Buffer.from(o.pixels.buffer, o.pixels.byteOffset + y * o.width * bpp, o.width * bpp).copy(raw, y * (o.width * bpp + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(o.width, 0); ihdr.writeUInt32BE(o.height, 4); ihdr[8] = 8; ihdr[9] = o.type === 'rgba' ? 6 : o.type === 'indexed' ? 3 : 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const parts = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr)]
  if (o.type === 'indexed') {
    parts.push(chunk('PLTE', Buffer.from(o.palette)))
    if (o.transparent !== undefined) { const t = Buffer.alloc(o.transparent + 1, 255); t[o.transparent] = 0; parts.push(chunk('tRNS', t)) }
  }
  parts.push(chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)))
  return Buffer.concat(parts)
}
