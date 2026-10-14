# PictureAtlas

`lib/PictureAtlas.js`

One picture holding many, each a named rectangle of it: a UI sheet's panels, portraits and frames, a map and its
route. A piece is drawn by name, whole or a part of it from its left or top (a route revealed bit by bit). Where
a [Sheet](Sheet.md) is a grid of equal tiles, an atlas's pieces are any size, where they were packed.

```js
import { PictureAtlas } from 'tenkai'

const art = new PictureAtlas({ image: game.getAsset('ui'), regions: { throne: [0, 0, 320, 224], map: [0, 224, 142, 226] } })
art.draw(context, 'throne', 0, 0)
art.draw(context, 'map', 89, 0, { width: reveal })   // the left `reveal` pixels of it
```

| Member | |
|---|---|
| `new PictureAtlas({ image, regions })` | the picture (or an Asset holding it); each piece's `[x, y, width, height]` or `{ x, y, width, height }` by name |
| `draw(context, name, x, y, { width, height })` | the piece with its top left at (x, y), rounded; `width` or `height` draws only that much of it from its left and top |
| `region(name)`, `has(name)` | a piece's place, `{ x, y, width, height }`; whether there is one |
| `element` | the image element |
