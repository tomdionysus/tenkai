# BitmapFont

`lib/BitmapFont.js`

Text drawn from a sheet of glyphs: an image divided into equal cells, as old games stored their fonts. It maps
characters to cells, recolours the glyphs (once per colour, cached), breaks lines at a line-break character or
by width, measures text, and can draw into a clipped window such as a status line.

```js
const font = new BitmapFont({
  image: game.getAsset('font'),
  cellWidth: 8,
  cellHeight: 8,
  characters: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ .',
  upperCase: true,
  lineBreak: '#'
})
// In draw(context):
font.draw(context, 'WARNING#PLASMODIAN WAVE', 40, 32, { colour: '#cc0000' })
```

## Constructor

`new BitmapFont(options)`

| Option | Default | |
|---|---|---|
| `image` | | The glyph sheet: an image, a canvas, or an Asset holding one. |
| `cellWidth`, `cellHeight` | | Size of a glyph cell. |
| `columns` | image width / cellWidth | Cells to a row of the sheet. |
| `characters` | | The character of each cell in order (a string), or an object mapping characters to cell numbers. |
| `widths` | cellWidth | Advance per cell (array) or per character (object), for proportional fonts. |
| `spacing` | 0 | Extra pixels between characters. |
| `lineHeight` | cellHeight + 2 | Pixels from one line to the next. |
| `lineBreak` | none | A character that breaks lines as `\n` does (many old games used `#`). |
| `upperCase` | false | Draw lower case with the upper-case glyphs. |
| `ink` | `'#ffffff'` | The colour in the sheet that `colour` replaces; other colours (an outline, say) stay. |

A character with no glyph, such as a space, takes a cell's width and draws nothing.

## Methods

- `draw(context, text, x, y, options)`: draw with the top left at (x, y). Options: `colour` (recolour the ink),
  `maxWidth` (wrap to this width), `align` (`'left'`, `'center'` or `'right'` of x), `clip` (`{ x, y, width,
  height }`, draw only inside). Returns the size drawn, as `measure` does.
- `measure(text)`: `{ width, height, lines }` in pixels.
- `wrap(text, width)`: the lines of text no wider than `width`, broken at spaces where possible.
- `lines(text)`: the text split at its line breaks.
- `glyph(character)`, `advance(character)`, `lineWidth(line)`: the pieces the above use.
- `tinted(colour)`: the sheet with its ink recoloured (a canvas, made once per colour). Without a canvas (in
  tests, say) it returns the sheet as it is.
