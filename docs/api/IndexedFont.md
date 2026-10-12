# IndexedFont

`lib/IndexedFont.js`

Text drawn into an [IndexedSurface](IndexedSurface.md) in palette colours, from glyphs kept as rows of bits. A glyph
may have several layers (the letter, its shadow, an outline), each drawn in the colour the text gives it, as palette
games draw their two-tone fonts. Proportional: each glyph has an advance and may sit lower than the line's top.
(For text on a canvas, [BitmapFont](BitmapFont.md).)

```js
const font = new IndexedFont({ characters, widths, tops, cellWidth: 16, layers: { 1: letterBits, 31: shadowBits } })
font.draw(frame, 'Credits', 260, 4, { colours: { 1: 15, 31: 0 }, align: 'right' })
```

| Member | |
|---|---|
| `new IndexedFont({ characters, widths, tops, cellWidth, layers, height })` | `characters` maps each character to its glyph number; `layers` by name, each glyph's rows of bits (highest bit leftmost, `cellWidth` bits a row) |
| `measure(text)` | width in pixels (characters without a glyph count nothing) |
| `draw(surface, text, x, y, { colours, align })` | `colours` by layer name; a layer without a colour is not drawn; `align` `'left'`, `'center'` or `'right'` of x; returns the width |
