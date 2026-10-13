# Shroud

`lib/Shroud.js`

The fog of war over a [TiledScene](TiledScene.md): one layer of the scene's map that covers the cells the player
has not seen with a tile of their own, and edges seen ground where it meets unseen ground with a tile picked by
which of its four neighbours are seen: north 1, east 2, south 4, west 8. A cell seen all round (15) is left clear.
Cells off the map count as seen (or as unseen, with `edge: 'unseen'`).

The game keeps what has been seen; `update` asks it, for the whole map or only the cells in view. Put the layer
above the ground and the scene's things (a child scene at a lower `z`), so it hides them too.

```js
const shroud = new Shroud({
  scene: battlefield, layer: 1, columns: 64, rows: 64,
  unseen: [0, 5],                          // a black tile
  edges: (mask) => [1 + mask, 5]           // the sheet's edge tiles, in mask order
})
shroud.update((x, y) => seen[y][x], { x: view.x, y: view.y, width: 15, height: 10 })
```

| Member | |
|---|---|
| `new Shroud({ scene, layer, columns, rows, unseen, edges, edge })` | makes the layer, all unseen |
| `update(seen, area)` | `seen(x, y)` says whether a cell has been seen; `area` `{ x, y, width, height }` limits it to those cells |
| `mask(seen, x, y)` | a cell's seen neighbours as a mask |
| `grid` | the layer's placements |
