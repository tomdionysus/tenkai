# Shake

`lib/Shake.js`

A screen shake as old games did it: a part of the screen jolted by a pattern of small offsets, one a step (a frame),
and still again when the pattern ends. Starting it while it shakes begins the pattern again. Move the part's content,
not its window: draw the scene at the offset inside a clip that stays put, and it shakes inside its frame at any size,
the next row or column of what it shows coming into the edge rather than a gap.

```js
// The PC Dune II's: two frames still, two a row up, twice
const shake = new Shake({ pattern: [[0, 0], [0, 0], [0, -1], [0, -1], [0, 0], [0, 0], [0, -1], [0, -1]] })
shake.start()                                  // a structure's explosion
scene.y = top + shake.y                        // each frame, the clip moved back by the same
shake.step()
```

| Member | |
|---|---|
| `new Shake({ pattern })` | `[x, y]` offsets, one a step (default a row up and back, twice) |
| `start()` | begins the shake from the pattern's start |
| `step()` | one step on; still once the pattern is done |
| `active` | whether it is shaking |
| `x`, `y` | the offset to draw at now (0 when still) |
