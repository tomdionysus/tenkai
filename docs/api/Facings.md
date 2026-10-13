# Facings

`lib/Facings.js`

Picks a sprite's picture for the way it faces, as old games store them: a picture for each of a number of
directions, often only the half from north round to south with the other half drawn mirrored, and for things that
walk several frames to each direction's picture.

A facing runs from 0 (north) clockwise to `turn` (default 256), rounded to the nearest direction. `pictures` says
which picture each direction uses, north first, so directions can share one: a soldier's north, side and south
pictures over eight directions are `[0, 1, 1, 1, 2]`.

```js
const tank = new Facings({ directions: 8, mirror: true })   // pictures 0-4, the west side mirrored
const { offset, flip } = tank.pick(unit.facing)
const soldier = new Facings({ directions: 8, mirror: true, pictures: [0, 1, 1, 1, 2], frames: 3 })
soldier.pick(unit.facing, step)                              // offset: picture * 3 + step % 3
```

| Member | |
|---|---|
| `new Facings({ directions, mirror, pictures, frames, turn })` | |
| `direction(facing)` | the nearest direction, 0 to `directions - 1` |
| `pick(facing, frame)` | `{ offset, flip }`: the picture from the thing's first, and whether mirrored |
