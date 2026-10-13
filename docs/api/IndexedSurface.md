# IndexedSurface

`lib/IndexedSurface.js`

A picture made of palette indices rather than colours, shown through a [Palette](Palette.md). Palette games
draw everything this way, so colour cycling, fades and shadow tables work on whatever is on screen. Show one
with an [IndexedScene](IndexedScene.md).

A surface is either opaque, with pixels 0 to 255 in a Uint8Array, or **transparent**, with pixels in an
Int16Array where -1 means nothing is there. Transparent surfaces make overlays, such as text over a room:
drawn over another surface, only their set pixels show.

```js
const frame = new IndexedSurface({ width: 320, height: 200 })
const room = new IndexedSurface({ width: 640, height: 144, pixels: roomPixels })
const text = new IndexedSurface({ width: 320, height: 200, transparent: true })
// The room scrolled 100 pixels right, under a 16-pixel status line, with the text over it
frame.blit(room, { sx: 100, w: 320, dy: 16 })
frame.blit(text)
```

## Constructor

`new IndexedSurface(options)`

| Option | Default | |
|---|---|---|
| `width`, `height` | | Size in pixels. |
| `transparent` | false | Pixels may be -1, meaning transparent. |
| `pixels` | 0s, or -1s when transparent | Pixels to use, row by row. They are not copied, so a surface can wrap an array the game already has. |

## Properties

`width`, `height`, `transparent`, and `pixels`, the array itself, row by row. Drawing code that needs speed
can work on `pixels` directly.

## Methods

### clear(color) / fill(x, y, w, h, color)

Set every pixel, or a rectangle clipped to the surface. `clear()` with no colour empties a transparent surface
and blacks out (index 0) an opaque one.

### get(x, y) / set(x, y, color)

One pixel. Off the surface, `get` returns -1 for transparent surfaces and 0 otherwise, and `set` does
nothing.

### line(x, y, length, color, vertical)

A line one pixel wide, `length` pixels from (x, y) to the right, or down when `vertical`, clipped to the surface.

### bits(rows, x, y, color, width)

A one-bit picture, such as a font's glyph, drawn ink only: each of `rows` is a number whose set bits, highest
first, are drawn in `color`; the other pixels are left alone, or drawn in `paper` when one is given (a solid
cell, as some fonts are drawn). `width` is the bits a row (default 8): `bits(rows, x, y, color, width, paper)`.

### remap(table)

Every pixel's number mapped through a table (an array, or a function of the number), transparent pixels left:
palette tricks such as darkening a picture by clearing a bit, or swapping two colours. Returns the surface.

### IndexedSurface.table(from, to, size)

A colour table for `map` and `remap`: every number to itself (`size` of them, default 256) but `from[k]` to
`to[k]`, as a picture drawn in one set of colours is shown in another.

### toCanvas(palette, { regions })

The surface as a canvas through a palette, to draw again and again (a sprite sheet in one character's
colours, a gauge's graphic); `regions` give ranges of rows their own palettes, as IndexedScene's do.

### IndexedSurface.fromNumbers(image, options)

A picture whose pixels are palette numbers written as grey (`scale`, default 8, levels a number), transparent where
its alpha is under 128: how a game's tools can export pictures for an indexed renderer without a palette, keeping
two entries of the same colour apart.

### IndexedSurface.fromImage(image, palette, options)

A picture (an image or canvas in a palette's colours) as palette numbers: a transparent surface, each pixel the
first entry of exactly its colour, `missing` (default 0) for a colour not in the palette, -1 where the picture is
transparent. `x`, `y`, `width`, `height` take part of it.

### rows(y, height)

A view of whole rows sharing the surface's memory, for drawing code that works on a plain array, such as a
sprite renderer drawing into the play area of a larger frame.

### blit(src, { sx, sy, w, h, dx, dy, key, mask, map, flip, clip })

`flip` mirrors the rectangle left to right: a sprite facing the other way. `clip` (`{ x, y, width, height }`)
draws only inside that rectangle of the destination: a sprite in a map's window.


`map`, a colour table, draws each pixel as `map[colour]`: a glyph in a text's colours, a sprite in a shadow's.


Copy a rectangle of `src` onto this surface, clipped to both. By default the whole source goes to the top
left. Pixels of a transparent source that are -1 are skipped, and so are pixels equal to `key` if one is
given. `mask` is one-bit alpha: an array laid out like the source, where 0 means do not draw that pixel.

### toRGBA(palette, rgba, from, to)

`from` and `to` (default all rows) limit it to a band of rows, leaving the others as they were, so bands can be
shown through different palettes (see `regions` on [IndexedScene](IndexedScene.md)).


Write the surface's colours into RGBA pixels the same size, such as an ImageData's `data`, skipping
transparent pixels so several surfaces can be written in turn.

### toRGBAAt(palette, rgba, width, height, x, y)

Write the surface into part of a larger RGBA image, clipped, skipping transparent pixels: how a small
surface such as a cursor is laid over a frame as it is shown.
