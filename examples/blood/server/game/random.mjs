// Blood's random numbers: the Watcom C library's rand() (seed = seed * 1103515245 + 12345, 15 bits out), found in the
// original's memory (fidelity/: it steps by exactly this), and Blood's helpers over it. One generator for the game,
// so a run seeded as the original's draws what it drew, in the order the game asks.
export default class Random {
  constructor (seed = 0) { this.seed = seed >>> 0; this.calls = 0 }

  /** Watcom's rand(): 0 to 32767 */
  rand () {
    this.seed = (Math.imul(this.seed, 1103515245) + 12345) >>> 0
    this.calls++
    return (this.seed >>> 16) & 0x7fff
  }

  /** Blood's Random(n): 0 to n-1 */
  Random (n) { return Math.floor(this.rand() * n / 32768) }
  /** Blood's Random2(n): -n to n */
  Random2 (n) { return Math.floor(this.rand() * n / 16384) - n }
  /** Blood's Random3(n): -n to n, peaked (two draws) */
  Random3 (n) { const a = this.rand(), b = this.rand(); return Math.floor((a + b) * n / 32768) - n }
  /** Blood's Chance(c): true with probability c / 65536 */
  Chance (c) { return this.rand() < (c >> 1) }
}
