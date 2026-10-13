# IndexedSprites

`lib/IndexedSprites.js`

The pictures of an [IndexedSheet](IndexedSheet.md) as [Sheet](Sheet.md)s for [Entity](Entity.md)s: each picture
through a [Palette](Palette.md) and a colour table (a house's colours, a blink's white), mirrored or not, made into a
canvas the first time it is asked for and kept. Palette games draw one picture in many colourings; this is how a
canvas-drawn scene shows them without recolouring every frame. Pictures put together some other way (several tiles
of a building) are made once and kept the same way.

Colour tables are kept by identity: build each once with `IndexedSurface.table(from, to, size)` and pass the same
array again.

```js
const sprites = new IndexedSprites({ sheet: unitPictures, palette, anchor: 'centre' })
const blue = IndexedSurface.table([1, 2, 3], [5, 6, 7], 32)
tank.sheet = sprites.get(111, { map: blue, flip: true })
const yard = tiles.make('yard:2:blue', 32, 32, (surface, sheet) => sheet.draw(surface, 290, 0, 0, { map: blue }))
```

| Member | |
|---|---|
| `new IndexedSprites({ sheet, palette, anchor, createCanvas })` | `anchor` `'topleft'` (default), `'centre'` or `(width, height) => [x, y]` |
| `get(n, { map, flip, upsideDown })` | picture `n` as a one-picture Sheet (mirrored left to right with `flip`, top to bottom with `upsideDown`), or null if there is none |
| `make(key, width, height, paint)` | a picture painted once by `paint(surface, sheet)`, kept under `key` |
| `clear()`, `size` | forget every canvas (after the palette changes); how many are kept |
