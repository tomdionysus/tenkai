# PaletteFade

`lib/PaletteFade.js`

A palette fade as the old machines did it: every red, green and blue component of every colour moves one level
towards its target at each step, so colours arrive at different times, the way an Amiga or ST fade looks.
Components are levels from 0 to `max` (15 for the Amiga's 4 bits a component), red, green and blue for each entry
in turn.

```js
import { PaletteFade } from 'tenkai'

// From black to the title's colours, a step every 5 frames, at twice the original's speed
const fade = new PaletteFade({ from: black, to: titleColours, every: 5, speed: 2 })
// each frame:
if (fade.tick()) fade.apply(palette)
if (fade.done) next()
```

The fade waits `wait` frames, steps every `every` frames `steps` times, and ends `every` frames after the last
step: with the defaults (wait 1, 16 steps) a fade with `every` 5 lasts 81 frames. `level` counts the steps taken,
for a fade that darkens something that is not a palette, such as a held picture of the screen one level a step
(give it no colours).

## Options

| Option | Default | |
|---|---|---|
| `from` | none | the colours now, as levels |
| `to` | none | the colours to reach, the same length |
| `every` | 1 | frames between steps |
| `wait` | 1 | frames before the first step |
| `steps` | 16 | how many steps |
| `speed` | 1 | frames of the fade a `tick` |
| `max` | 15 | the highest level of a component |

## Members

| Member | |
|---|---|
| `colours` | the colours as they are now (a copy: `from` is not changed) |
| `level`, `frame`, `length` | steps taken, frames passed, frames it lasts |
| `done` | whether it has run its length |
| `tick()` | `speed` frames; true when a step was taken |
| `step()` | one frame; true when a step was taken |
| `apply(palette, start)` | writes the colours into a [Palette](Palette.md) from entry `start`, each level x 255 / `max` |
