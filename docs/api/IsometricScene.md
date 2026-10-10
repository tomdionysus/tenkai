# IsometricScene

`lib/IsometricScene.js`

Extends [Scene](Scene.md). Shows a 3D world in isometric view: entities placed by world position are
projected onto the screen and drawn in depth order, farthest first, over a ground drawn by child scenes.

- **Entities** get a world position with [`place()`](#placename-entity-x-y-z), kept as `entity.world`
  (`{ x, y, z }`, change it freely). Before each draw, the scene sets each such entity's `x` and `y` to the
  point on the ground below it and its `elevation` to its height, through its
  [IsometricProjection](IsometricProjection.md), and draws in depth order: nearer things cover farther ones,
  and at the same depth higher things cover lower ones. Entities without `world` keep their own position.
- **The ground** is whatever child scenes draw beneath the entities: for pre-drawn isometric art, a
  [TiledScene](TiledScene.md) of flat tiles (which draws only what is on screen), or a
  [BackgroundScene](BackgroundScene.md). Scenery that characters walk behind must be entities itself, so it is
  sorted in with them.
- **Occluders** are for pre-drawn art, where walls, railings and arches that characters pass behind are part
  of one flat picture. An occluder is the foreground part of the art at a place (an image, transparent
  elsewhere) with a test of which entities are behind it. After drawing an entity, the scene draws over it,
  clipped to the entity's own box, every occluder that hides it, which cuts the foreground out of the entity;
  nearer entities, drawn later, are not affected. This is how Wreckers (Amiga, 1991) does it: each room and
  corridor has a list of foreground masks, each hiding characters that stand beyond a point.
- **The camera** is `camera.x` and `camera.y`, the scroll; [`centerOn()`](#centeronposition-sx-sy-snap) sets it.
- Combine with the Scene `clip` option to show the view inside a shaped frame.

Game logic belongs in an [IsometricWorld](IsometricWorld.md); the scene only shows it.

```js
const projection = new IsometricProjection({ xAxis: [-2, -1], yAxis: [2, -1], origin: [2048, 3072] })
const view = new IsometricScene({ projection, clip: frameOutline })
view.addScene('ground', new TiledScene({ sheet: stationTiles, layers: [stationMap] }))
const officer = view.place('officer', new Entity({ sheet: officerSheet }), 1020, 356, 896)

// Each step, after moving the officer's body in the world:
officer.world = { x: body.x, y: body.y, z: body.z }
view.centerOn(officer.world, 120, 96)        // keep the officer in the middle of the view
```

## Constructor

`new IsometricScene(options)` takes the [Scene](Scene.md) options (it defaults to `PERSPECTIVE_DEPTH`), and:

| Option | Default | |
|---|---|---|
| `projection` | classic 2:1 | The [IsometricProjection](IsometricProjection.md) to place entities with. |
| `snap` | 0 (none) | Draw entities on a grid of this many pixels. Give it the camera's `centerOn` snap (for smooth scrolling at a scale, one device pixel: `1 / scale`), so a character the camera follows stays still on the screen rather than shivering as the two are rounded apart. |

## Methods

### place(name, entity, x, y, z)

Add an entity at a world position. Returns the entity.

### projectEntity(entity)

Set an entity's screen position from its world position now. The scene does this before every draw; call it
to know where an entity is on screen in between.

### centerOn(position, sx, sy, snap)

Scroll so that a world position (`{ x, y, z }`) appears at (`sx`, `sy`) in the scene's area, rounding the
scroll to `snap` pixels (default 1), as games that scrolled in steps did: one number for both axes, or
`[x, y]`, such as `[8, 1]` for 8-pixel steps across and smooth scrolling up and down. Rounding the vertical
scroll makes the view jump when a character walks, since every isometric step moves it up or down a little.

### addOccluder({ image, x, y, hides, sx, sy, width, height, source })

Add an occluder: `image` is the foreground, transparent elsewhere, drawn with its top left at (`x`, `y`) in
the ground's coordinates. Use `sx`, `sy`, `width` and `height` to take part of an atlas. `hides(entity)` says
whether an entity is behind it (default: every entity it overlaps). Returns the occluder. `occluders` lists
them; `clearOccluders()` removes them all, for example when the map changes.

With `source` (a scene, usually the ground), the occluder is live: `image` is only a mask, and the art is taken
from the source where the mask is opaque, as games that hide characters with masks over their own map art do.
The art is taken when first needed and again after `invalidateOccluders(x, y, width, height)` is told that the
scene changed over that rectangle (a tile replaced, a door opened); `occluderArt(occluder)` gives the image and
source position used to draw it.

### occludersOf(entity)

The occluders that hide an entity: those overlapping its box whose `hides` says it is behind.

### IsometricScene.entityBox(entity)

The screen box an entity's tile covers, `[left, top, right, bottom]`, or null if it has no size.

### worldAt(sx, sy, z)

The world position `{ x, y }` under a point of the scene's area, on the plane at height `z`: what the mouse
points at.
