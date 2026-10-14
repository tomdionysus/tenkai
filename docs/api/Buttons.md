# Buttons

`lib/Buttons.js`

A screen's buttons as a set shown at a time: each a box (`{ x, y, width, height }`) with what a press does
(`act`) and whatever else the game keeps on it (its words, its row), added to the screen's
[Hotspots](Hotspots.md) as `box` hotspots and drawn by the game's own painter. A window shows one set, then
another in its place: a menu's rows, then a question's Yes and No. Buttons act at the press, as the original
games' windows do, or at the release over the same button with `release`.

```js
import { Buttons } from 'tenkai'

const buttons = new Buttons({ hotspots: menu.hotspots, paint: (frame, b) => art.button(frame, b, b.text) })
buttons.show([
  { text: 'Load a game', x: 56, y: 71, width: 208, height: 15, act: () => load() },
  { text: 'Quit', x: 56, y: 158, width: 104, height: 15, act: null }
])
// in the screen's paint:
buttons.draw(frame)
```

## Constructor

`new Buttons({ hotspots, paint, release })`

| Option | Default | |
|---|---|---|
| `hotspots` | | The screen's `Hotspots`, in its own coordinates. |
| `paint` | none | `(frame, button)`: draws one button. |
| `release` | false | Act at the release over the pressed button (`onClick`) rather than at the press (`onDown`). |

## Methods

### show(buttons)

The buttons shown now, in place of any before: the hotspots are cleared and one added per button. `act` is
called with nothing; a button whose `act` is null does nothing (a feature not yet built, drawn all the same).

### draw(frame)

Every button given to the painter, in order. `buttons` is the list shown, so a painter that changes a button's
words each frame (a name being typed, a setting) may set them on the button first.
