# IndexedPictures

`lib/IndexedPictures.js`

A game's pictures in palette numbers, by name: each a rectangle of one of several sheets (an
[IndexedSurface](IndexedSurface.md) each), cut once, with the point the game places it by (its anchor: a sprite's
foot, a strip's bottom left). Where an [IndexedSheet](IndexedSheet.md) numbers its pictures, these are named, as a
remake's exported pictures are; drawn with `blit`'s options (a colour table `map`, `flip`). (For a canvas image,
[PictureAtlas](PictureAtlas.md).)

```js
const pictures = new IndexedPictures({
  pictures: { 'button.10': { sheet: 'buttons', x: 0, y: 0, w: 32, h: 15 }, 'ship.fighter': { sheet: 'ships', x: 0, y: 0, w: 16, h: 12, anchor: [8, 11] } },
  sheets: { buttons: buttonSheet, ships: shipSheet }
})
pictures.draw(frame, 'button.10', 264, 5, { map: pressedColours })   // top left at (264, 5)
pictures.place(frame, 'ship.fighter', 120, 90)                       // its anchor at (120, 90)
```

| Member | |
|---|---|
| `new IndexedPictures({ pictures, sheets })` | `pictures` by name `{ sheet, x, y, w, h, anchor }` (anchor default `[0, 0]`); `sheets` by name |
| `has(name)`, `get(name)` | whether it has one; a picture `{ surface, anchor, w, h }` |
| `draw(surface, name, x, y, options)` | with its top left at (x, y); `blit`'s options |
| `place(surface, name, x, y, options)` | with its anchor at (x, y) |
