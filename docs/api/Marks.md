# Marks

`lib/Marks.js`

What a strategy or tile game marks over its map, drawn on a canvas a pixel wide in a [Palette](Palette.md)'s
colours: a selected thing's outline, the corners round a selected unit, and a box crossed by both diagonals (a place
a building may not go). Coordinates are the canvas's (a scene's `foreground` draws them in the scene's own).

```js
const marks = new Marks({ palette: mapPalette })
things.foreground = (context) => {
  marks.outline(context, 32, 48, 48, 32, 28)
  marks.corners(context, tank.x - 8, tank.y - 8, 16, 16, 3, 28)
  if (!allowed) marks.crossed(context, cell.x * 16, cell.y * 16, 32, 32, 28)
}
```

| Method | |
|---|---|
| `outline(context, x, y, w, h, n)` | a rectangle's edges in colour `n` |
| `corners(context, x, y, w, h, length, n)` | its four corners, `length` pixels along each edge |
| `crossed(context, x, y, w, h, n)` | its edges and both diagonals |
| `colour(n)` | a palette number as a canvas colour |
