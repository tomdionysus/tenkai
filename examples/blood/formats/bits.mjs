// Bit fields packed little-endian, as C compilers lay out Blood's extra records.
export default class Bits {
  constructor (buffer, offset = 0) { this.b = buffer; this.base = offset * 8; this.pos = 0 }
  /** The next n bits, unsigned */
  u (n) {
    let v = 0
    for (let i = 0; i < n; i++) {
      const bit = this.base + this.pos + i
      v += ((this.b[bit >> 3] >> (bit & 7)) & 1) * 2 ** i
    }
    this.pos += n
    return v
  }
  /** The next n bits, signed (two's complement) */
  s (n) { const v = this.u(n); return v >= 2 ** (n - 1) ? v - 2 ** n : v }
  skip (n) { this.pos += n }
}
