# PixelRegions

`lib/PixelRegions.js`

Regions of a picture's pixels, for cutting art out of a picture (a captured panel, a screen's frame): what a flood
fill reaches, the islands of joined pixels, the hollows inside solid parts. It works on pixel indexes
(`y * width + x`) and tests the game gives it (black, opaque, a palette number), so it serves RGBA image data, an
[IndexedSurface](IndexedSurface.md)'s numbers or any mask.

```js
// The black joined to the picture's edges made clear (the backing round a captured panel)
const d = image.data
const black = (i) => d[i * 4 + 3] > 0 && d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] === 0
const regions = new PixelRegions(image.width, image.height)
const reached = regions.flood((i) => regions.edge(i), black)
for (let i = 0; i < reached.length; i++) if (reached[i]) d[i * 4 + 3] = 0
```

| Member | |
|---|---|
| `new PixelRegions(width, height)` | |
| `edge(i)` | whether pixel i is on the border |
| `flood(start, through, { diagonal })` | a `Uint8Array`, 1 for each pixel `through` lets in that is joined (side by side, or at the corners too with `diagonal`) to a starting pixel |
| `islands(solid, { diagonal })` | the islands of solid pixels, each a list of indexes (joined at the corners too unless `diagonal` is false) |
| `hollows(solid, r)` | a `Uint8Array`, 1 for each pixel of a hollow: not solid, out of the outside's reach once the parts are grown by `r` (gaps up to 2r closed), less those within `r` of the outside |
