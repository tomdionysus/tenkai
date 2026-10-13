# Minimap

`lib/Minimap.js`

A tile map drawn small, as strategy games' radars show it: part of the map (its playable area) a few pixels a
tile, scaled up by whole pixels to fill a rectangle of an [IndexedSurface](IndexedSurface.md), each cell in a colour
the game picks, dots for things, and the outline of what the main view shows, clipped to the rectangle; and the
cell under a point, for a click that moves the view there.

```js
const radar = new Minimap({ rect: { x: 256, y: 136, width: 64, height: 64 }, background: 0, outline: 28 })
radar.draw(frame, {
  area: map.limits,
  colour: (x, y) => seen(x, y) ? ground(x, y).radarColour : null,
  dots: units.map((u) => ({ x: u.tileX, y: u.tileY, colour: houseColour(u) })),
  view: { x: map.x, y: map.y, width: map.across, height: map.down }
})
const cell = radar.cellAt(mouseX, mouseY, map.limits)
```

| Member | |
|---|---|
| `new Minimap({ rect, background, outline })` | `background` (default 0, null leaves what is there), `outline` the view's colour |
| `draw(surface, { area, colour, dots, view })` | `colour(x, y)` returns a colour or null for each cell of `area` |
| `scale(area)` | pixels a cell |
| `cellAt(px, py, area)` | the cell `{ x, y }` under a point, or null |
