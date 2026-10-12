# FontCleaner

`lib/FontCleaner.js`

Cleans up an old game's font whose glyphs are drawn as segments with one-pixel gaps through their strokes, which
read as clipped text when scaled up. A gap is filled where a vertical stroke runs through it: ink above and below,
and the stroke at least two deep on one side, so a diagonal (a zero's slash) is left alone.

```js
const glyphs = FontCleaner.glyphs(data.font.glyphs)            // rows of bits
const sheet = FontCleaner.image(game.getAsset('font').element)  // a picture of 8 x 8 cells
```

| Static method | |
|---|---|
| `rows(rows, width)` | one glyph's rows of bits (high bit leftmost, `width` bits, default 8), cleaned: a new array |
| `glyphs(list, width)` | every glyph of a list cleaned (a missing glyph stays missing) |
| `image(image, cell, createCanvas)` | a picture of square cells (`cell`, default 8) cleaned: a new canvas, each filled pixel the colour of the one above |
| `gap(ink, x, y)` | whether (x, y) is a gap in a vertical stroke, by `ink(x, y)` |
