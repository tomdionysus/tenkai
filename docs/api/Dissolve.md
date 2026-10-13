# Dissolve

`lib/Dissolve.js`

A picture dissolving in over another, as old games faded a new picture in without touching the palette (Dune II's
`GUI_Screen_FadeIn2`): the rectangle's columns and rows are shuffled once, and each step copies one pixel in every
column, each column a different shuffled row, so the new picture appears as scattered dots that fill in. After as
many steps as the rectangle has rows, every pixel has been copied.

```js
import { Dissolve } from 'tenkai'

// The new map (drawn on `back`) over the old one on `screen`, eight steps a frame
const dissolve = new Dissolve({ x: 8, y: 24, width: 304, height: 120 })
// each frame:
dissolve.step(back, screen, 8)
if (dissolve.done) next()
```

## Options

| Option | Default | |
|---|---|---|
| `x`, `y`, `width`, `height` | | the rectangle, the same on both surfaces |
| `random` | `Math.random`'s | `(n) => an integer from 0 to n - 1`, for the shuffles |
| `skipZero` | false | leave pixels of colour 0 in the source alone |

## Members

| Member | |
|---|---|
| `step(from, to, steps = 1)` | copies the next steps' pixels from one `IndexedSurface` to the other; returns `done` |
| `finish(from, to)` | copies what is left at once |
| `done` | whether every pixel has been copied |
| `taken` | steps taken |
| `Dissolve.shuffled(n, random)` | 0 to n - 1, each swapped with a random place in turn |
