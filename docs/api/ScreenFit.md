# ScreenFit

`lib/ScreenFit.js`

Where a screen of a fixed size (an old game's 320 by 200) goes in a window of any size: as large as fits, keeping
its shape, and where in the window it sits. The old screens were shown on 4:3 monitors with pixels taller than
wide (320 by 200 filled a 4:3 screen, so each pixel was 1.2 times as tall as wide): `pixelAspect` keeps that
look, so what was drawn for the original's screen comes out the shape it had.

```js
const f = ScreenFit.fit({ width: 320, height: 200 }, { width: 1920, height: 1080 }, { pixelAspect: 1.2, align: 'bottom' })
// f.scaleX 4.5, f.scaleY 5.4, f.x 240, f.y 0: the screen is 1440 by 1080, centred across, at the bottom
context.drawImage(statusBar, f.x + 34 * f.scaleX, f.y + 187 * f.scaleY, 68 * f.scaleX, 26 * f.scaleY)
```

A point (x, y) on the screen is at (`f.x + x * f.scaleX`, `f.y + y * f.scaleY`) in the window. A HUD drawn in the
original's coordinates over a 3D view that fills the window uses it as its frame.

### `ScreenFit.fit(screen, window, { pixelAspect, align, integer })`

| Argument | |
|---|---|
| `screen` | `{ width, height }` in the screen's own pixels |
| `window` | `{ width, height }` the space to fit it in |
| `pixelAspect` | how much taller than wide a screen pixel is shown (default 1) |
| `align` | where the screen sits when the window is taller than it: `'middle'` (default), `'top'` or `'bottom'` |
| `integer` | scale by whole numbers only, never under 1 (default false): sharper for pixel art, with a border |

Returns `{ x, y, width, height, scaleX, scaleY, scale }`: where the screen is in the window and its size there,
the scales of its pixels across and down, and `scale` (the one across, the one `integer` applies to).
