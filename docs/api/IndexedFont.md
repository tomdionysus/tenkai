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
| `measure(text, spacing)` | width in pixels, `spacing` (default 0) added for each letter (characters without a glyph count nothing) |
| `draw(surface, text, x, y, { colours, align, spacing })` | `colours` by layer name; a layer without a colour is not drawn; `align` `'left'`, `'center'` or `'right'` of x; `spacing` pixels added to each letter's advance (default 0); returns the width |
| `IndexedFont.fromSheet(sheet, glyphs, { height, cellWidth, layer, inked })` | a one-layer font read from a sheet of glyphs in palette numbers (a font exported as a picture): `glyphs` by character `{ x, y, width, top }`, its rectangle's top left, its advance and (optional) rows down from the line; `height` the glyphs' rows; `layer` its name (default `'ink'`); `inked(value)` whether a pixel is ink (default above 0) |
