# IndexedTileMap

`lib/IndexedTileMap.js`

A map of tiles drawn into part of an [IndexedSurface](IndexedSurface.md): a grid of tile numbers, an
[IndexedSheet](IndexedSheet.md) of tiles, and a view onto it: the window it fills on the surface and the tile at
its top left. For top-down palette games: cells can be hidden (unexplored, fogged: drawn in one colour) and tiles
drawn through colour tables; the view scrolls by whole tiles, kept inside the map or a part of it, and finds the
cell under a point. A window larger than the original's shows more of the map.

```js
const map = new IndexedTileMap({ sheet: tiles, columns: 64, rows: 64, tileWidth: 16, tileHeight: 16 })
map.window = { x: 0, y: 40, width: 240, height: 160 }
map.limit({ x: 16, y: 16, width: 32, height: 32 })
map.centreOn(30, 25)
map.draw(frame, ground, { visible: (x, y) => seen[y][x] === '1' })
const cell = map.cellAt(game.mouseX, game.mouseY)
```

| Member | |
|---|---|
| `new IndexedTileMap({ sheet, columns, rows, tileWidth, tileHeight, window })` | |
| `window`, `x`, `y`, `limits` | where it draws; the tile at the window's top left; the part of the map the view keeps to |
| `across`, `down` | tiles the window shows (a part tile counts) |
| `limit(rect)`, `scrollTo(x, y)`, `scrollBy(dx, dy)`, `centreOn(x, y)` | the view, kept inside the limits; `scrollBy` returns whether it moved |
| `cellAt(px, py)` | the cell `{ x, y }` under a point of the surface, or null |
| `pointOf(x, y)` | a cell's top left on the surface |
| `draw(surface, tiles, { visible, hidden, map })` | the tiles under the view, clipped to the window; `visible(x, y)` false draws the `hidden` colour; `map(x, y)` a colour table for a cell |
