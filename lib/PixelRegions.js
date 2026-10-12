/**
 * Regions of a picture's pixels, for cutting art out of a picture: what a flood fill reaches, the islands of
 * joined pixels, the hollows inside solid parts. It works on pixel indexes (y * width + x) and the tests a game
 * gives it (black, opaque, ...), so it serves RGBA image data, an {@link IndexedSurface}'s numbers or any mask.
 *
 * @example
// The black joined to the picture's edges made clear (the backing round a captured panel)
const d = image.data
const black = (i) => d[i * 4 + 3] > 0 && d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] === 0
const regions = new PixelRegions(image.width, image.height)
const reached = regions.flood((i) => regions.edge(i), black)
for (let i = 0; i < reached.length; i++) if (reached[i]) d[i * 4 + 3] = 0
 */
class PixelRegions {
  /**
   * @param {integer} width
   * @param {integer} height
   */
  constructor (width, height) {
    this.width = width
    this.height = height
  }

  /** Whether pixel i is on the picture's border. */
  edge (i) {
    const x = i % this.width
    const y = (i - x) / this.width
    return x === 0 || y === 0 || x === this.width - 1 || y === this.height - 1
  }

  // Pixel i's neighbours: side by side, or with the corners too
  neighbours (i, diagonal) {
    const w = this.width
    const x = i % w
    const y = (i - x) / w
    const out = []
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || (!diagonal && dx && dy)) continue
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < w && ny >= 0 && ny < this.height) out.push(ny * w + nx)
      }
    }
    return out
  }

  /**
   * A flood fill: every pixel `through` lets in that is joined (side by side, or with the corners when `diagonal`)
   * to a starting pixel (one that `start` and `through` both pass).
   * @param {function} start `start(i)`: whether pixel i starts the flood
   * @param {function} through `through(i)`: whether the flood goes through pixel i
   * @param {object} options
   * @param {boolean} options.diagonal Joined at the corners too (default false)
   * @returns {Uint8Array} 1 for each pixel reached
   */
  flood (start, through, { diagonal = false } = {}) {
    const n = this.width * this.height
    const reached = new Uint8Array(n)
    const queue = []
    for (let i = 0; i < n; i++) {
      if (start(i) && through(i)) {
        reached[i] = 1
        queue.push(i)
      }
    }
    while (queue.length) {
      for (const m of this.neighbours(queue.pop(), diagonal)) {
        if (!reached[m] && through(m)) {
          reached[m] = 1
          queue.push(m)
        }
      }
    }
    return reached
  }

  /**
   * The islands of pixels `solid` passes, each the indexes of its pixels, joined at the corners too unless
   * `diagonal` is false.
   * @param {function} solid `solid(i)`
   * @param {object} options
   * @param {boolean} options.diagonal (default true)
   * @returns {integer[][]}
   */
  islands (solid, { diagonal = true } = {}) {
    const n = this.width * this.height
    const seen = new Uint8Array(n)
    const out = []
    for (let start = 0; start < n; start++) {
      if (seen[start] || !solid(start)) continue
      const island = [start]
      seen[start] = 1
      for (let k = 0; k < island.length; k++) {
        for (const m of this.neighbours(island[k], diagonal)) {
          if (!seen[m] && solid(m)) {
            seen[m] = 1
            island.push(m)
          }
        }
      }
      out.push(island)
    }
    return out
  }

  /**
   * The hollows inside the solid parts: pixels not solid that the outside cannot reach once the parts are grown by
   * `r` (gaps of up to 2r closed), less those within `r` of the outside (so the parts keep their edges).
   * @param {function} solid `solid(i)`
   * @param {integer} r How far the parts are grown
   * @returns {Uint8Array} 1 for each pixel of a hollow
   */
  hollows (solid, r) {
    const w = this.width
    const h = this.height
    const n = w * h
    const around = (i, mark) => {
      const x = i % w
      const y = (i - x) / w
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) mark[ny * w + nx] = 1
        }
      }
    }
    const grown = new Uint8Array(n)
    for (let i = 0; i < n; i++) if (solid(i)) around(i, grown)
    const outside = this.flood((i) => this.edge(i) && !solid(i), (i) => !grown[i] || (this.edge(i) && !solid(i)))
    const near = new Uint8Array(n)
    for (let i = 0; i < n; i++) if (outside[i]) around(i, near)
    const out = new Uint8Array(n)
    for (let i = 0; i < n; i++) if (!solid(i) && !near[i]) out[i] = 1
    return out
  }
}

export default PixelRegions
