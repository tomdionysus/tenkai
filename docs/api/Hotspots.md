# Hotspots

`lib/Hotspots.js`

Clickable regions of the screen, for point-and-click games. Each hotspot has a shape, an optional cursor,
and handlers for click, press, drag and release. `enabled` and `cursor` may be functions, so hotspots can
follow game state without being rebuilt.

```js
import { Hotspots } from 'tenkai'

var hotspots = new Hotspots()
hotspots.add({ rect: [214, 0, 525, 332], cursor: 'forward', onClick: () => goTo('path') })
hotspots.add({ circle: [320, 222, 74], cursor: 'hand', enabled: () => !doorOpen, onClick: openDoor })
hotspots.add({
  rect: [370, 60, 420, 150],
  cursor: 'grab',
  onDown: () => lever.grab(),
  onDrag: (spot, x, y) => lever.pull(y),
  onUp: () => lever.release()
})
hotspots.bind(game)
```

## Hotspot fields

| Field | Meaning |
|-------|---------|
| `rect` | `[left, top, right, bottom]`; right and bottom are exclusive. |
| `circle` | `[x, y, radius]`, instead of `rect`. |
| `contains` | `(x, y) => boolean`, instead of `rect` or `circle`, for any other shape. |
| `cursor` | A cursor id, or a function returning one. Optional. |
| `enabled` | `true`/`false`, or a function returning one. Defaults to enabled. |
| `onClick(spot, x, y)` | Called on release over the same hotspot that was pressed, if it is still enabled. |
| `onDown(spot, x, y)` | Called on press. |
| `onDrag(spot, x, y)` | Called on every mouse move while this hotspot is pressed, wherever the mouse is. |
| `onUp(spot, x, y)` | Called on release, wherever the mouse is. If a hotspot has `onUp`, its `onClick` is not called. |

A hotspot is an ordinary object, so you can keep your own data on it, such as a destination or an item.

## Methods

### `add(spot)`

Adds a hotspot and returns it. Where hotspots overlap, the one added first wins.

### `clear()`

Removes every hotspot and forgets any press. Call it when the view changes, then add the new view's
hotspots.

### `at(x, y)`

The first enabled hotspot containing the point, or `null`.

### `cursorAt(x, y, defaultCursor)`

The cursor to show. While a hotspot is pressed, this is that hotspot's cursor, so the cursor stays
consistent during a drag. Otherwise it is the cursor of the hotspot under the point. In either case it is
`defaultCursor` if the hotspot has no cursor or there is no hotspot.

### `mouseDown(x, y)` / `mouseMove(x, y)` / `mouseUp(x, y)`

Feed mouse input to the hotspots. A press records the hotspot under the mouse. Moves go to the pressed
hotspot, and the release goes to it as well. Each method returns whatever the handler returns, so an async
handler's promise can be awaited.

### `bind(engine)`

Feeds the engine's `mousedown`, `mousemove` and `mouseup` events to the hotspots, using `engine.mouseX` and
`engine.mouseY`.

## Notes

- Coordinates are whatever you pass in. With `bind`, they are game coordinates. If your view is a scene at
  an offset, either give the hotspots matching rectangles or call the mouse methods yourself with
  adjusted coordinates.
- Hotspots have no notion of a game being busy. To ignore input during a cut-scene, either don't call
  `mouseDown`, or check a flag inside the handlers.
- To act on release wherever the mouse ends up, which is how Myst behaves, use `onUp`. For the usual
  button behaviour, where releasing outside cancels, use `onClick`.
