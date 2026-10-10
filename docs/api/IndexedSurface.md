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

### rows(y, height)

A view of whole rows sharing the surface's memory, for drawing code that works on a plain array, such as a
sprite renderer drawing into the play area of a larger frame.

### blit(src, { sx, sy, w, h, dx, dy, key, mask })

Copy a rectangle of `src` onto this surface, clipped to both. By default the whole source goes to the top
left. Pixels of a transparent source that are -1 are skipped, and so are pixels equal to `key` if one is
given. `mask` is one-bit alpha: an array laid out like the source, where 0 means do not draw that pixel.

### toRGBA(palette, rgba)

Write the surface's colours into RGBA pixels the same size, such as an ImageData's `data`, skipping
transparent pixels so several surfaces can be written in turn.

### toRGBAAt(palette, rgba, width, height, x, y)

Write the surface into part of a larger RGBA image, clipped, skipping transparent pixels: how a small
surface such as a cursor is laid over a frame as it is shown.
