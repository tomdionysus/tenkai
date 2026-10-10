# TiledScene

`lib/TiledScene.js`. Extends [Scene](Scene.md).

A scene drawn from a map of tiles taken from one [Sheet](Sheet.md), with entities among them. It can draw
the map flat, with characters always on top, or in depth, with characters walking behind and in front of
the scenery and climbing onto it.

```js
const room = game.addScene('room', new TiledScene({
  sheet: dungeon,                                    // a Sheet whose tiles say what they are
  layers: map.layers,
  perspectiveMode: TiledScene.PERSPECTIVE_DEPTH
}))
room.addEntity('gallagher', cat)

if (!room.isSolid(x + 1, y)) walkRight()
```

## Constructor options

All [Scene](Scene.md) options, plus:

| Option | Default | Meaning |
|--------|---------|---------|
| `sheet` | none | The tiles. |
| `asset`, `tileWidth`, `tileHeight` | `32` | Instead of `sheet`, for a plain grid with no description: the image and tile size. |
| `layers` | `{}` | The map (see below). |
| `perspectiveMode` | `PERSPECTIVE_OVERHEAD` | Flat or depth drawing (see below). |

## The map

`layers` is a list, or an object keyed by number, of layers. Each layer is a grid of rows, and each cell
is `null` or a tile placement:

- `[column, row]`: a tile from the sheet;
- `[column, row, overrides]`: the same, with some of what the sheet says about that tile replaced for this
  placement, such as `{ flat: true, solid: false }` for the wall tile in a doorway.

```js
layers: [
  [                                         // layer 0: the floor
    [[6, 0], [6, 0], [6, 0]],
    [[6, 0], [6, 0], [6, 0]]
  ],
  [                                         // layer 1: a chair, its back above its seat
    [null, [3, 2], null],
    [null, [3, 3], null]
  ]
]
```

You can change `layers` at any time. Assigning `room.layers` replaces the whole map. After changing the
grids in place, call `invalidate()`; `setTile` does that itself.

## Drawing flat: `PERSPECTIVE_OVERHEAD`

Layers are drawn in ascending key order, and child scenes share the same order by `z`: at each z, the
layer with that key, then the child scenes with that `z`. Then all entities, by `z`. This suits top-down
maps where characters are always on top.

## Drawing in depth: `PERSPECTIVE_DEPTH`

The sheet's [tile descriptions](Sheet.md#infotile-overrides) decide what goes where:

1. **The ground.** Flat tiles, such as floor and rugs, are drawn first, lowest `elevation` first. Nothing is
   ever drawn under them.
2. **Everything upright.** Upright tiles (walls, furniture) and entities are drawn together, in order of
   the line each stands on, then by elevation:
   - An entity stands at its `y`, which is its anchor, usually its feet.
   - An upright tile stands at the bottom of its row, or of the row `stand` rows below it. A chair back
     drawn in row 3 with `stand: 1` stands with its seat in row 4.
   - Where a tile and an entity stand on the same line, the lower is drawn first, and a tile goes before an
     entity at the same elevation.
3. **Child scenes**, last, as overlays.

So for a chair whose back (elevation 48) is drawn a row above its seat (elevation 24):

| Character | Drawn |
|-----------|-------|
| On the floor behind the chair | First: the seat and back cover it. |
| On the seat, at elevation 24 | After the seat, before the back. |
| On the floor in front of the chair | Last: it covers the chair, even if it is taller than a tile. |

Layer order only breaks ties. The pieces are sorted once and kept until the map changes. Each frame, the
entities are sorted and merged in.

An object deep enough to span several rows, such as a long counter running away from the viewer, has no
single line it stands on. Describe it as a piece per row, each standing where it is drawn.

## Map queries

### `tilesAt(x, y)`

The placements in a cell, lowest layer first, each `{ layer, tile, overrides }`.

### `isSolid(x, y)`

Whether a cell blocks movement. A cell override wins if there is one (see `setSolid`). Otherwise a cell is
solid if any of its tiles is solid, and a cell with no tiles at all is solid, so the edges of a room hold
things in.

### `setSolid(x, y, solid)` / `clearSolid()`

Override a cell's solidity, or remove the override with `null`. `clearSolid` removes every override.

### `cellAt(px, py)`

The cell containing a point in the scene's coordinates, as `[x, y]`.

### `layerKeys`

The keys of the layers, as numbers in ascending order.

## Editing

### `setTile(layer, x, y, placement)`

Places a tile, or removes one with `null`, creating the layer and rows as needed.

### `invalidate()`

Call after changing the map in place by other means.

## Performance

Drawn flat (`PERSPECTIVE_OVERHEAD`), only the cells that can be seen are drawn, worked out from the canvas
and the transform in effect ([`Scene.visibleBounds`](Scene.md)), so large maps cost little. In depth mode
every piece is drawn every frame; keep those maps modest, or split large worlds into several scenes.
