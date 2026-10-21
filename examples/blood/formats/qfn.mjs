// Blood's QFN fonts (BLOOD.RFF: FONTSMAL, FONTBLOD, KFONT6, KFONT7, PFONT2O): a 32-byte header ("FNT\x1a", version,
// type, the pixels' size, the first and last character, the spacing between characters at byte 17, the line's
// height at 19), then 256 glyphs of 8 bytes (the offset of its pixels, its width, height, advance, and its top
// against the baseline, signed), then the pixels: palette numbers, a glyph's columns one after another, 255 clear.

/** @returns {{ first, last, spacing, height, glyphs: Array<{ code, width, height, advance, top, pixels: Uint8Array }> }} */
export default function qfn (data) {
  const b = Buffer.from(data)
  if (b.toString('latin1', 0, 3) !== 'FNT') throw new Error('not a QFN font')
  const first = b[12], last = b[13], spacing = b[17], height = b[19]
  const glyphs = []
  for (let code = first; code <= last; code++) {
    const o = 32 + code * 8
    const offset = b.readUInt32LE(o), width = b[o + 4], h = b[o + 5], advance = b[o + 6], top = b.readInt8(o + 7)
    // (the pixels turned to rows, as the tiles' are)
    const pixels = new Uint8Array(width * h)
    const at = 32 + 2048 + offset
    for (let x = 0; x < width; x++) for (let y = 0; y < h; y++) pixels[y * width + x] = b[at + x * h + y]
    glyphs.push({ code, width, height: h, advance, top, pixels })
  }
  return { first, last, spacing, height, glyphs }
}
