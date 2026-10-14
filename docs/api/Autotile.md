# Autotile

`lib/Autotile.js`

Which piece of a run a cell shows, chosen by which of its neighbours it joins: a map laid out in kinds of ground
(rock, sand, wall) draws itself with its edges and corners in the right places, as strategy games' maps and their
editors do. The classic form has four neighbours (north, east, south, west) and a run of 16 pieces, one for each way
the neighbours can join, the piece's number being the neighbours' bits (north 1, east 2, south 4, west 8). A `table`
maps the bits to a piece when the run is in another order or has fewer pieces (a blob tileset), and `joins` may
answer with a number whose bits say which of several ways a neighbour joins, each way a further set of bits.

```js
import { Autotile } from 'tenkai'

// Rock joins rock and mountain, spice joins thick spice; each kind's run of 16 pieces starts at its base
const JOINS = { [ROCK]: MOUNTAIN, [SPICE]: THICK_SPICE }
const ground = new Autotile({ joins: (c, n) => n === c || n === JOINS[c], base: (c) => BASE[c] })
// The map's edges count as the same kind as the cell
const piece = ground.piece(x, y, (nx, ny) => inside(nx, ny) ? kinds[ny * 64 + nx] : kinds[y * 64 + x])

// Walls: a bit a neighbour that is a wall or rubble, a second a neighbour that is rubble, through a 256-entry table
const walls = new Autotile({ joins: (c, n) => n === RUBBLE ? 3 : n === WALL ? 1 : 0, table: WALL_TABLE, base: 1 })
```

## Constructor

`new Autotile(options)`

| Option | Default | |
|---|---|---|
| `around` | `Autotile.FOUR` | The neighbours as `[dx, dy]`, in the bits' order. |
| `joins` | the same kind | `(centre, neighbour) => boolean | number`: whether the neighbour joins the centre, or a number whose bit n says it joins the n-th way. |
| `table` | none | The piece for each value of the bits; without one the bits are the piece. |
| `base` | 0 | Added to the piece: a number, or `(centre) => number` when each kind has its own run. |

`Autotile.FOUR` is `[[0, -1], [1, 0], [0, 1], [-1, 0]]`: north, east, south, west.

## Methods

### piece(x, y, at)

The piece of the cell at (x, y) of a map read through `at(x, y)`, a function giving a cell's kind. It is asked for
the neighbours too, so it says what stands off the map: `undefined` joins nothing with the default `joins`, or the
cell's own kind makes the map's edge continue it.

### pieceOf(centre, neighbours)

The piece of a centre among its neighbours' kinds, given in `around`'s order: for a generator that has the
neighbours in hand.

### bitsOf(centre, neighbours)

The neighbours' bits before the table and base: bit i where the i-th neighbour joins, and where `joins` answers a
number, its bit n sets bit i + n * (the neighbours' count).
