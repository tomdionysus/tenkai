/**
 * Autotiling: which piece of a run a cell shows, chosen by which of its neighbours it joins, so a map laid out in
 * kinds of ground (rock, sand, wall) draws itself with edges and corners in the right places. The classic form has
 * four neighbours (north, east, south, west) and a run of 16 pieces, one for each way the neighbours can join; a
 * `table` maps the neighbour bits to a piece when the run is in another order or has fewer pieces (a blob tileset),
 * and `joins` may answer with a number whose bits say which of several ways a neighbour joins (a wall meets a wall,
 * or a destroyed wall's rubble), each way a further set of bits.
 *
 * @example
// Rock joins rock and mountain; each kind's run of 16 pieces starts at its base
const ground = new Autotile({ joins: (c, n) => n === c || n === JOINS[c], base: (c) => BASE[c] })
const piece = ground.piece(x, y, (x, y) => kinds[y * 64 + x] ?? kinds[cy * 64 + cx])
// Walls, with a second set of bits for rubble, through the original's 256-entry table
const walls = new Autotile({ joins: (c, n) => n === RUBBLE ? 3 : n === WALL ? 1 : 0, table: TABLE, base: 1 })
 */
class Autotile {
  /**
   * @param {object} options
   * @param {number[][]} options.around The neighbours as [dx, dy] in the bits' order (default the four, north,
   *   east, south, west)
   * @param {function} options.joins `(centre, neighbour) => boolean|number`: whether the neighbour joins the
   *   centre, or a number whose bit n means it joins the n-th way (default: the same kind)
   * @param {number[]} options.table The piece for each value of the bits (default: the bits themselves)
   * @param {number|function} options.base Added to the piece: a number, or `(centre) => number` for a run a kind
   *   (default 0)
   */
  constructor ({ around = Autotile.FOUR, joins = (a, b) => a === b, table = null, base = 0 } = {}) {
    this.around = around
    this.joins = joins
    this.table = table
    this.base = base
  }

  /** The four neighbours in the usual order: north, east, south, west. */
  static get FOUR () { return [[0, -1], [1, 0], [0, 1], [-1, 0]] }

  /**
   * The neighbour bits of a centre among its neighbours' kinds (in `around`'s order): bit i set where the i-th
   * neighbour joins; where `joins` answers a number, its bit n sets bit i + n * (the neighbours' count).
   * @param {*} centre
   * @param {Array} neighbours
   * @returns {number}
   */
  bitsOf (centre, neighbours) {
    const count = this.around.length
    let bits = 0
    neighbours.forEach((n, i) => {
      let ways = this.joins(centre, n)
      if (ways === true) ways = 1
      for (let w = 0; ways; w++, ways = Math.floor(ways / 2)) if (ways & 1) bits |= 1 << (i + w * count)
    })
    return bits
  }

  /**
   * The piece of a centre among its neighbours' kinds: the table's entry for the bits (the bits themselves without
   * a table), plus the base.
   * @param {*} centre
   * @param {Array} neighbours
   * @returns {number}
   */
  pieceOf (centre, neighbours) {
    const bits = this.bitsOf(centre, neighbours)
    const base = typeof this.base === 'function' ? this.base(centre) : this.base
    return (this.table ? this.table[bits] : bits) + base
  }

  /**
   * The piece of the cell at (x, y) of a map read through `at(x, y)`, which gives a cell's kind (and whatever should
   * stand for a cell off the map: undefined joins nothing with the default `joins`).
   * @param {number} x
   * @param {number} y
   * @param {function} at
   * @returns {number}
   */
  piece (x, y, at) {
    return this.pieceOf(at(x, y), this.around.map(([dx, dy]) => at(x + dx, y + dy)))
  }
}

export default Autotile
