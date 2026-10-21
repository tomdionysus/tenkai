/**
 * QuadBatch gathers quads (sprites, HUD tiles, glyphs) into one vertex array for one WebGL draw call: each quad is
 * two triangles, six vertices, laid out as the shader's attributes want them. The caller says what a vertex is
 * made of: each corner's own numbers (its place and texture coordinates) followed by numbers the whole quad
 * shares (its tile, its shade). The array grows as needed and is reused frame to frame.
 *
 * @example
const batch = new QuadBatch({ floats: 7 })               // x, y, u, v, then tile, shade, flags
batch.begin()
batch.quad([[x0, y0, 0, 0], [x1, y0, 16, 0], [x1, y1, 16, 16], [x0, y1, 0, 16]], [tile, shade, flags])
gl.bufferData(gl.ARRAY_BUFFER, batch.vertices, gl.STREAM_DRAW)
gl.drawArrays(gl.TRIANGLES, 0, batch.count)
 */
class QuadBatch {
  /**
   * @param {object} options
   * @param {integer} options.floats Numbers a vertex (a corner's own and the quad's shared ones together)
   * @param {integer} options.capacity Quads to make room for at first (default 256; it grows)
   */
  constructor (options = {}) {
    this.floats = options.floats || 4
    this.data = new Float32Array(this.floats * 6 * (options.capacity || 256))
    /** Vertices gathered since `begin`. */
    this.count = 0
  }

  /** Starts over: the next quad is the first. */
  begin () {
    this.count = 0
  }

  /**
   * Adds a quad: its four corners in order round it (clockwise or anti-clockwise), each corner's own numbers,
   * and the numbers every vertex of it shares.
   * @param {number[][]} corners Four arrays of a corner's numbers
   * @param {number[]} shared The quad's numbers, after each corner's (optional)
   */
  quad (corners, shared = []) {
    var n = this.floats
    if ((this.count + 6) * n > this.data.length) {
      var more = new Float32Array(this.data.length * 2)
      more.set(this.data)
      this.data = more
    }
    var at = this.count * n
    var order = [0, 1, 2, 0, 2, 3]
    for (var k = 0; k < 6; k++) {
      var c = corners[order[k]]
      this.data.set(c, at)
      this.data.set(shared, at + c.length)
      at += n
    }
    this.count += 6
  }

  /** The vertices gathered, as a view of the array to give the buffer. */
  get vertices () {
    return this.data.subarray(0, this.count * this.floats)
  }
}

export default QuadBatch
