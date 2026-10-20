// Build ART tiles (SHARE000.ART): i32 version (1), i32 tiles (ignored), i32 first, i32 last; then i16 width[n],
// i16 height[n], i32 picanm[n]; then each tile's pixels, column by column (x outer, y inner), as palette numbers.
// picanm: bits 0-5 animation frames, 6-7 animation type (0 none, 1 oscillate, 2 forward, 3 backward), 8-15 x
// offset (signed), 16-23 y offset (signed), 24-27 animation speed, 28-31 Blood's view type (0 single, 1 5 views,
// 2 8 views, 3 bounce, 4 vertical?, 6 voxel, 7 spinning voxel).
export default class Art {
  constructor (buffer) {
    this.version = buffer.readInt32LE(0)
    this.first = buffer.readInt32LE(8)
    this.last = buffer.readInt32LE(12)
    const n = this.last - this.first + 1
    this.tiles = []
    let p = 16
    const widths = [], heights = []
    for (let i = 0; i < n; i++, p += 2) widths.push(buffer.readInt16LE(p))
    for (let i = 0; i < n; i++, p += 2) heights.push(buffer.readInt16LE(p))
    for (let i = 0; i < n; i++, p += 4) {
      const a = buffer.readUInt32LE(p)
      this.tiles.push({
        number: this.first + i, width: widths[i], height: heights[i], picanm: a,
        frames: a & 63, animType: (a >> 6) & 3, xoffset: (a << 16 >> 24), yoffset: (a << 8 >> 24), speed: (a >> 24) & 15, view: (a >>> 28) & 15,
        pixels: null
      })
    }
    for (const t of this.tiles) {
      const size = t.width * t.height
      t.pixels = size ? buffer.subarray(p, p + size) : null // column-major
      p += size
    }
    this.end = p
    if (p !== buffer.length) throw new Error('ART has ' + (buffer.length - p) + ' bytes over')
  }

  /** A tile's pixels row by row (a Uint8Array of width * height), or null for an empty tile */
  rows (t) {
    if (!t.pixels) return null
    const out = new Uint8Array(t.width * t.height)
    for (let x = 0; x < t.width; x++) for (let y = 0; y < t.height; y++) out[y * t.width + x] = t.pixels[x * t.height + y]
    return out
  }
}
