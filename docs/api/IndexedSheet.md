# IndexedSheet

`lib/IndexedSheet.js`

A set of pictures in palette numbers, by number: the cells of a grid (a tileset) or the frames of an atlas (sprites
of their own sizes), cut once from one [IndexedSurface](IndexedSurface.md). Old games number their sprites across
all the files they load; `join` gives several sheets one numbering, so a table's sprite numbers index it directly.

```js
const tiles = IndexedSheet.grid(IndexedSurface.fromNumbers(tileImage), 16, 16, 418)
const sprites = IndexedSheet.join([IndexedSheet.atlas(mouse, mouseFrames), IndexedSheet.atlas(units, unitFrames)])
sprites.draw(frame, 111, 40, 60, { map: houseColours, flip: true })
```

| Member | |
|---|---|
| `new IndexedSheet(pictures)` | from surfaces already cut |
| `IndexedSheet.grid(source, width, height, count)` | the cells of a grid, left to right and down (`count` default all) |
| `IndexedSheet.atlas(source, frames)` | the frames of an atlas, each `{ x, y, w, h }` |
| `IndexedSheet.join(sheets)` | several sheets numbered on one after another |
| `IndexedSheet.cut(source, x, y, w, h)` | a rectangle as a transparent surface of its own |
| `get(n)`, `length` | |
| `draw(surface, n, x, y, options)` | picture `n` with its top left at x, y; options as `blit`'s (`map`, `flip`, `key`, `mask`) |
