# Phase 3b: Depth-sorted Tiles

Goal: characters move among tiled scenery at the right depth. Gallagher walks
behind a chair, hops onto its seat and is still behind its back, with tile
maps built from a tileset and sprites of any size. Part of Phase 3, alongside
[3a](03a-animation-redesign.md).

## Outcome

Done, with Tim the Enchanter ported: Gallagher walks behind the chairs and tables, hops onto a seat and
stays behind its back, and walks in front of them. Where the build differs from the design below:

- **There is no `Tileset` class.** A [`Sheet`](../docs/api/Sheet.md) is a sprite sheet or a tileset: the same
  grid and image, with clips for animation and tile descriptions for maps. `info(tile, overrides)` and
  `draw(context, tile, x, y)` take a tile as `[column, row]`.
- **Heights are `elevation`, in pixels**, for tiles and entities alike, instead of `z` in levels. `z`
  keeps its meaning of drawing order in overhead mode.
- **Entities are drawn raised by their elevation.** The design left that to games. With pixels as the
  unit it is what a game wants anyway, so jumping in Golden Axe and hopping onto a seat in Tim need no
  drawing code.
- **`hotspotX`/`hotspotY` are gone.** An entity's position is now its anchor, taken from its sheet, so a
  character anchored at its feet sorts by its `y`. The same anchor gives rotation about the centre in
  1945 and flipping in place in Golden Axe.
- **The map stays as `layers`**, grids of placements, rather than a new cell-stack format. Layer order only
  breaks ties, which is what the cell stacks were for, and existing maps and editors keep working.
- **`setTile(layer, x, y, placement)`** removes a tile with `null`, instead of a separate `removeTile`.
- **Tile descriptions pass other properties through**, such as `seat: true`, for the game to use.
- **`PERSPECTIVE_ANGLE` is folded into `PERSPECTIVE_DEPTH`**, as recommended.

## Why

`TiledScene` draws every layer, then every entity. A cell's layers are only
its stacking order, for composing one picture. In Tim the Enchanter's room,
layer 1 holds a chair back, which should cover the cat, and also the rug,
which he should walk on. No layer number puts him in the right place, so he
is drawn over all the furniture.

Depth is not a property of a layer. It is a property of each piece of
scenery: how high it is, and where the object it belongs to stands.

## The model

Every drawable thing has a place in the room, made of three values:

- **Flat or upright.** Floor, rugs and anything else lying on the ground are
  flat. Walls, furniture, door frames and characters are upright.
- **Base line.** For an upright thing, the screen y of the line it stands
  on. For a character, its feet (`y + hotspotY`). For a tile, the bottom edge
  of the row its object stands in, which is not always the row the tile is
  drawn in: a chair back is drawn in row 3 but belongs to a chair standing in
  row 4.
- **Height (`z`).** How high it is: floor 0, rug 0.5, seat 1, table top 2,
  chair back 3. For a character, how high it is standing: 0 on the floor, 1
  on the seat.

Drawing has two passes:

1. **Ground.** Flat tiles, in `z` order (floor, then rugs). Nothing is ever
   drawn under the ground, so flat tiles never take part in the depth sort.
   That stops the floor of the row a character is stepping into being drawn
   over his feet.
2. **Depth.** Upright tile pieces and entities together, sorted by base line,
   then by height, then tiles before entities, then the order they were
   added.

Worked through for the chair (chair back at row 3, seat at row 4, tiles 64
px), with the cat's feet at the bottom of his tile:

| Cat | Cat's base, z | Chair back's base, z | Seat's base, z | Order | Result |
|-----|---------------|----------------------|----------------|-------|--------|
| On the floor in row 3, behind the chair | 256, 0 | 320, 3 | 320, 1 | cat, seat, back | Behind both |
| On the seat | 320, 1 | 320, 3 | 320, 1 | seat, cat, back | On the seat, behind the back |
| On the floor in row 5, in front | 384, 0 | 320, 3 | 320, 1 | seat, back, cat | In front, even if his head reaches into row 4 |
| Mid-step from row 2 to row 3 | 192 to 256, 0 | 320, 3 | 320, 1 | cat, seat, back | Slides behind the chair as he walks |

Height bands (one level per `z`, drawn in order) are the special case where
every object stands in the row it is drawn in and sprites are one tile tall,
so the model covers that too.

## Framework changes

### Tileset description (new `lib/Tileset.js`)

- [x] A `Tileset` wraps an image `Asset` with a description of its tiles,
  loaded from JSON alongside the image:

  ```json
  {
    "tileWidth": 64,
    "tileHeight": 64,
    "tiles": {
      "6,0": { "flat": true, "z": 0 },
      "0,0": { "flat": true, "z": 0.5 },
      "3,2": { "z": 3, "stand": 1 },
      "3,3": { "z": 1, "solid": true },
      "4,2": { "z": 2, "stand": 1 },
      "4,3": { "z": 0, "solid": true }
    },
    "objects": {
      "chair": { "tiles": [[3, 2], [3, 3]], "anchor": [0, 1] },
      "round table": { "tiles": [[4, 2], [5, 2], [4, 3], [5, 3]], "anchor": [0, 1] }
    }
  }
  ```

  - `flat`: drawn in the ground pass. Default `true`, so an undescribed tile
    behaves like the floor it usually is.
  - `z`: height. Default 0.
  - `stand`: rows below this tile that its object stands on. Default 0.
  - `solid`: blocks movement. Default `false`.
  - `objects`: named groups of tiles, for editors to place a whole chair
    rather than two halves. `anchor` is the tile the object stands on.
- [x] `tileset.info(tileX, tileY)`: the tile's description with defaults
  filled in.
- [x] `tileset.draw(context, tileX, tileY, x, y)`: one tile, so `TiledScene`
  and editors stop repeating the source-rectangle arithmetic.

### Map format

- [x] A map cell becomes a stack of placements: `[tileX, tileY]`, or
  `[tileX, tileY, { z, stand, flat }]` to override the tileset for one
  placement. The order within a cell no longer decides depth.
- [x] Keep accepting today's `layers` (an array or object of grids) as
  input. Layer order then only breaks ties between pieces that are otherwise
  equal, so existing maps draw as before.
- [x] Per-cell overrides of solidity (for example a doorway in a wall tile),
  replacing hand-painted masks such as Tim's `blocked` rows.

### `TiledScene`

- [x] Option `tileset`, used instead of `asset` with `tileWidth` and
  `tileHeight` when given.
- [x] `perspectiveMode: TiledScene.PERSPECTIVE_DEPTH`: the two-pass drawing
  above. `PERSPECTIVE_OVERHEAD` keeps today's behaviour (layers in z order,
  then entities by `z`). `PERSPECTIVE_ANGLE` becomes the special case of depth
  with no upright tiles, so it can be folded in or kept as an alias.
- [x] Build the list of upright pieces once, with base lines and heights
  resolved, and rebuild it only when the map changes (`setTile`,
  `invalidate()`). Each frame, sort the entities and merge them into the
  pre-sorted pieces, rather than sorting everything.
- [x] Child scenes in depth mode: drawn after the depth pass, as overlays.
  Scenes that need to sort among the scenery should be entities instead.
- [x] Map queries: `tilesAt(x, y)`, `isSolid(x, y)`, `cellAt(px, py)`, so
  games stop keeping parallel masks.
- [x] `setTile(x, y, index, placement)` and `removeTile(x, y, index)` for
  editors, keeping the piece list current.

### `Entity` and `HasEntitiesMixin`

- [x] `z` is a character's height in depth mode, and stays the drawing order
  in overhead mode. Higher is drawn later in both, so the meaning is
  consistent.
- [x] `hotspotY` must be the feet for depth sorting. Document it, and default
  it to `tileHeight` for entities created with a tile size, since sprites
  usually stand on their bottom edge.
- [x] Entities do not move on screen when their height changes. Showing a
  character raised by its height is the game's job, as Golden Axe's
  `place()` already does. Height units are levels, shared with the tileset;
  a game converts to pixels as it likes.
- [x] `drawEntities` keeps its own `PERSPECTIVE_ANGLE` sort for plain scenes
  with no tiles (Golden Axe's world). `TiledScene` in depth mode draws its
  entities itself, as part of the merge.

### Animated and interactive scenery

- [x] Scenery that animates or responds, such as the torch, a door or a lever,
  is an entity using the tileset's image and a clip from
  [3a](03a-animation-redesign.md). It sorts with everything else by its base
  line and height.

## Porting and examples

- [x] Describe the dungeon tileset (`examples/tim-the-enchanter/assets/
  tileset_dungeon.json`): flat floor and rugs, upright walls, furniture,
  doors and the torch bracket, solid where they block, and the furniture
  objects.
- [x] Convert Tim's map to cell stacks. Drop the `blocked` rows in favour of
  tile solidity, with overrides for the doorways.
- [x] Gallagher: `hotspotY` at his feet, `z` 0 on the floor. Add hopping
  onto chair seats (height 1) to show a character between two heights of
  one object.
- [x] Editor: place and remove whole objects from the tileset's `objects`,
  show and change a placement's height, and show solidity from the tileset
  instead of a painted mask.
- [x] Verify against the table above on a simulated clock: behind the chair,
  on the seat, in front of it, and mid-step between rows.

## Specs

- [x] `Tileset`: defaults, overrides, objects, drawing one tile.
- [x] `TiledScene` depth mode: the ground pass ignores entities; the depth
  order for each row of the worked example; layer order only breaks ties;
  the piece list rebuilds after `setTile`; overhead mode is unchanged.
- [x] Map queries and solidity, with overrides.

## Limits

- An object deep enough to span several rows, such as a long table running
  away from the viewer, has no single row it stands on. Describe it as a
  piece per row, each standing where it is drawn (`stand: 0`).
- Painter's order cannot draw objects that interleave in a cycle. Tile games
  almost never need it, and splitting one of the objects resolves it.

## Open questions

- Should `PERSPECTIVE_ANGLE` be folded into depth mode, or kept as a separate
  name for scenes without tiles? Recommended: fold it in; a scene without
  upright tiles behaves the same.
- Tileset descriptions in their own JSON file or inline in the map?
  Recommended: their own file, since one tileset serves many maps.

## Done when

- Gallagher walks behind the chairs and table, stands on a seat behind its
  back, and walks in front of them, in Tim the Enchanter.
- The editor places whole objects, and the map has no hand-painted masks.
- Docs (`docs/api/TiledScene.md`, a new `docs/api/Tileset.md`,
  `docs/architecture.md`) describe flat and upright tiles, base lines and
  heights.
