// Build's TABLES.DAT (8448 bytes): i16 sintable[2048], i16 radarang[640], u8 textfont[1024], u8 smalltextfont[1024],
// u8 britable[16][64]. Blood's palettes: BLOOD.PAL etc. (768 bytes, 8-bit red, green, blue per entry); the shade
// tables (.PLU): 64 shades of 256 entries, shade 0 the identity; the colour tables (.CLU): 256 entries; the
// translucency table (TRANS.TLU): 256 x 256.
export function tables (buffer) {
  const sintable = new Int16Array(2048), radarang = new Int16Array(640)
  for (let i = 0; i < 2048; i++) sintable[i] = buffer.readInt16LE(i * 2)
  for (let i = 0; i < 640; i++) radarang[i] = buffer.readInt16LE(4096 + i * 2)
  return { sintable, radarang, textfont: buffer.subarray(5376, 6400), smalltextfont: buffer.subarray(6400, 7424), britable: buffer.subarray(7424, 8448) }
}
export function palette (buffer) {
  if (buffer.length !== 768) throw new Error('palette of ' + buffer.length + ' bytes')
  return new Uint8Array(buffer)
}
export function shadeTable (buffer) {
  if (buffer.length !== 16384) throw new Error('shade table of ' + buffer.length + ' bytes')
  return new Uint8Array(buffer)
}
