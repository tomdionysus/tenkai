# ShadeTable

`lib/ShadeTable.js`

How 256-colour games darkened their world: a table of rows, one a level of light, each a map from a palette
number to the palette number nearest its colour at that light (Build's palookups, Doom's COLORMAP). A pixel is
drawn through the table at its light, then through the [Palette](Palette.md). Several tables stacked (a game's
pals: differently coloured versions of the same sprites) are rows on after each other.

`colors` turns the table into colours through a palette: one RGBA entry a cell, rows as the table's, so a shader
can look a pixel's colour up in one fetch, and the whole thing changes palette (under water, a flash) by being
made again.

```js
const table = ShadeTable.fromImage(game.getAsset('shades').element)       // a grey PNG, a row a level
const palettes = ShadeTable.palettesFromImage(game.getAsset('palettes').element)   // a palette a row
const rgba = table.colors(palettes[0])                                      // table.entries wide, table.rows high
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, table.entries, table.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba)
// in the fragment shader: texelFetch(uColors, ivec2(index, pal * 64 + light), 0)
```

## Constructor options

| Option | Default | Meaning |
|--------|---------|---------|
| `table` | zeros | The rows one after another, `entries` numbers each (a Uint8Array). |
| `rows` | from the table | How many rows. |
| `entries` | 256 | Numbers a row. |

## Methods

| Method | |
|---|---|
| `colors(palette)` | the cells as colours through a Palette (or red, green and blue for each entry in turn): RGBA, `entries` wide, `rows` high, every colour opaque |
| `ShadeTable.fromImage(image)` | a table from an image whose pixels are the numbers (the red channel), a row of the image a row of the table |
| `ShadeTable.palettesFromImage(image)` | palettes from an image with one a row, each pixel's colour an entry |
| `ShadeTable.pixels(image, createCanvas)` | an image's pixels, RGBA, read through a canvas: `{ width, height, data }` |
