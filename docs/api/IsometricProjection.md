# IsometricProjection

`lib/IsometricProjection.js`

Turns positions in a 3D world (x, y, and z for height) into positions on the screen, and back. It is the one
place an isometric game's geometry is defined, shared by its [IsometricScene](IsometricScene.md), its game
logic, a map screen, and whatever turns a mouse click into a place in the world.

The projection is linear: each world axis has a vector on the screen (the pixels one unit along it moves),
height goes straight up, and the world's origin has a screen position. The default is the classic 2:1
isometric view: a step along x goes two pixels right and one down, a step along y two left and one down. Other
views, such as dimetric ones or games whose axes point elsewhere, are other vectors.

```js
// Classic 2:1 isometric, one pixel of height per unit of z
const iso = new IsometricProjection()
iso.toScreen(10, 0, 5)         // { x: 20, y: 5 }

// Wreckers (Amiga, 1991): x runs up and left, y up and right
const wreckers = new IsometricProjection({ xAxis: [-2, -1], yAxis: [2, -1], origin: [2048, 3072] })
wreckers.toScreen(1020, 356, 896)    // { x: 720, y: 800 }, as the game computes it
```

## Constructor

`new IsometricProjection(options)`

| Option | Default | |
|---|---|---|
| `xAxis` | `[2, 1]` | Screen pixels for one unit of x. |
| `yAxis` | `[-2, 1]` | Screen pixels for one unit of y. Must not be parallel to `xAxis`. |
| `zScale` | 1 | Screen pixels up for one unit of z. |
| `origin` | `[0, 0]` | Screen position of the world's origin. |

## Methods

### project(x, y, z)

Where a world position appears, as an [Entity](Entity.md) holds it: `{ x, y, elevation }`, the screen point
on the ground below it and its height in pixels. Scenes in depth order sort by `y` then `elevation`, so this
gives the right drawing order: farther first, then lower first.

### toScreen(x, y, z)

The screen point of a world position, `{ x, y }`: the ground point raised by the height.

### toWorld(sx, sy, z)

The world position `{ x, y }` at a screen point, on the plane at height `z` (default 0): where the mouse
points on a floor.

### vectorToWorld(dx, dy)

The world vector `{ x, y }` that moves a point by a screen vector. For controls that follow the screen, where
pushing up means up the screen whichever way the world's axes run: normalise the result and move by it.

### depth(x, y)

How near a world position is: larger is nearer. It is the ground point's screen y.
