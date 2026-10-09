# Sheet

`lib/Sheet.js`

An image divided into a grid of equal tiles, with a description of how to use them. The same class serves
sprite sheets, whose tiles are animation frames, and tilesets, whose tiles build maps.

A sheet can describe:

- where its grid is in the image, so several sheets can share one image laid out as separate grids;
- an **anchor**, the point in each tile that an [Entity](Entity.md)'s position refers to;
- named animation **clips**, shared by every entity that uses the sheet;
- for tilesets, what each **tile** is: flat or upright, its elevation, whether it is solid;
- for tilesets, named **objects** made of several tiles, for editors to place whole.

```js
const dungeon = new Sheet({
  image: game.getAsset('dungeon'),
  tileWidth: 64,
  tileHeight: 64,
  clips: { torch: { frames: [[6, 6], [6, 5]], delay: 100, loop: true } },
  tiles: {
    '6,0': { flat: true },                                      // floor
    '0,0': { flat: true, elevation: 1 },                        // rug, over the floor
    '3,2': { elevation: 48, stand: 1 },                         // chair back, belongs to the seat below
    '3,3': { elevation: 24, solid: true, surface: 24 }          // chair seat, something to stand on
  },
  objects: { chair: { tiles: [[3, 2], [3, 3]], anchor: [0, 1] } }
})
```

A sheet's description is plain data, so it can live in a JSON file next to its image and be spread into
the constructor: `new Sheet(Object.assign({ image }, require('./tileset.json')))`.

## Constructor options

| Option | Default | Meaning |
|--------|---------|---------|
| `image` | required | The image: an [Asset](Asset.md), image or canvas. |
| `tileWidth`, `tileHeight` | the whole image | The size of a tile. |
| `offsetX`, `offsetY` | `0` | Pixel position of the first tile in the image. |
| `spacing` | `0` | Pixels between neighbouring tiles. |
| `anchor` | `[0, 0]` | `[x, y]` within a tile that entity positions refer to. It may lie outside the tile. |
| `clips` | none | Named animation clips (see `addClip`). |
| `tiles` | none | Tile descriptions keyed `"column,row"` (see `info`). |
| `objects` | none | Named groups of tiles: `{ tiles: [[c, r], ...], anchor: [col, row] }`, the anchor being the tile, counted within the group, that the object stands on. |

Tile `[c, r]` is the rectangle at
`(offsetX + c * (tileWidth + spacing), offsetY + r * (tileHeight + spacing))`.

## Properties

| Property | Meaning |
|----------|---------|
| `element` | The image element. |
| `tileWidth`, `tileHeight`, `anchor` | As given. |
| `columns`, `rows` | How many tiles fit across and down the image. |
| `clips`, `tiles`, `objects` | As given; clips are normalised by `addClip`. |

## Methods

### `addClip(name, def)`

Defines a clip. A clip is a list of frames, each a tile `[column, row]`, optionally with its own delay
in milliseconds as a third value. It can be given three ways:

| Form | Frames |
|------|--------|
| `{ frames: [[0, 1], [1, 1, 200]] }` | As listed. |
| `{ row: 1, columns: [0, 1, 2, 1] }` | Those columns of one row. |
| `{ row: 1, count: 6 }` | The first `count` columns of one row. |

with `delay` (milliseconds per frame, default 100) and `loop` (default false). Returns the clip.

### `clip(name)`

A clip by name. Given a clip object, returns it unchanged.

### `source(tile)`

The tile's source rectangle in the image, `[x, y, width, height]`.

### `draw(context, tile, x, y)`

Draws a tile with its top-left at `(x, y)`.

### `info(tile, overrides)`

What a tile is, with defaults filled in. `overrides` replaces the sheet's values for one placement:

| Field | Default | Meaning |
|-------|---------|---------|
| `flat` | see below | Lies on the ground, like floor or a rug, and is drawn under everything upright. |
| `elevation` | `0` | Height in pixels. Among things standing on the same line, lower is drawn first. |
| `stand` | `0` | How many rows below this tile its object stands. A chair back drawn one row above its seat has `stand: 1`. Negative is above: the lower half of a bookcase against the back wall, drawn over the floor in front, stands at the wall with `stand: -1`, so characters walk in front of it. |
| `solid` | `false` | Blocks movement. |

A tile is flat unless its description gives `stand` or `elevation`, or says `flat: false`, so a tile with
no description at all is floor. Any other fields in a description, such as Tim the Enchanter's `surface: 24`
for something a character can stand on, are passed through for the game to use.

See [TiledScene](TiledScene.md) for how these drive drawing in depth.
