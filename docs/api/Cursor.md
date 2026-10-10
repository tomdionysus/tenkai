# Cursor

`lib/Cursor.js`

Draws image cursors on the canvas. Because the cursor is part of the picture, it scales with the game and
can be any image, such as a pointing hand or a forward arrow. Hide the system cursor over the canvas when
using it.

```js
import { Cursor } from 'tenkai'

var cursor = new Cursor()
cursor.define('hand', handImage, 6, 1)     // the click point is 6 pixels in, 1 down
cursor.define('forward', arrowImage, 8, 0)
game.element.style.cursor = 'none'

// last thing in a Scene's draw, so it is on top of everything:
cursor.draw(context, game.mouseX, game.mouseY, hotspots.cursorAt(game.mouseX, game.mouseY, 'hand'))
```

## Properties

| Property | Meaning |
|----------|---------|
| `hidden` | Set to `true` to draw nothing, for example during a cut-scene. |
| `cursors` | The defined cursors, by id. |

## Methods

### `define(id, image, x, y)`

Defines a cursor. `id` is any name or number. `image` is an image or canvas. `x`, `y` is the point within
the image that clicks, such as the tip of a finger, and defaults to `0, 0`.

### `draw(context, x, y, id)`

Draws cursor `id` with its click point at `(x, y)`, rounded to whole pixels. Nothing is drawn if the cursor
is hidden, the id is unknown or undefined, or the position is missing or `NaN`, for example before the
mouse has entered the canvas.
