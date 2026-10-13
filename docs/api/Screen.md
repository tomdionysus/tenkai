# Screen

`lib/Screen.js`. Extends [Scene](Scene.md).

A screen shown over the game: a menu, a map, a dialogue, a choice of character. It is drawn as any scene is, over
everything else while it is shown, and it takes the player's clicks before the game does and has a step of its
own. The engine keeps a stack of screens (`showScreen`, `hideScreen`, `topScreen` on [GameEngine](GameEngine.md)):

- the top visible screen is given each click first; when its `click` returns true the game does not see the click;
- every visible screen is stepped after the game's own `update`, in stack order;
- the screens are drawn over the scenes, entities and mode, bottom first.

A hidden screen (`visible` false) stays on the stack but is neither drawn, given clicks nor stepped: a game can keep
a screen on the stack while something else is shown over the whole page.

```js
const menu = new Screen({
  background: (context) => context.drawImage(menuPicture, 0, 0),
  click: (x, y) => {
    if (x > 268 && y < 24) game.hideScreen(menu)
    return true
  },
  update: (dt, input) => { if (input.pressed('quit')) game.hideScreen(menu) }
})
game.showScreen(menu)
```

## Options

As a [Scene](Scene.md)'s, and:

| Option | |
|---|---|
| `click(x, y)` | a click in the game's coordinates (the engine's `mouseX`, `mouseY`); return true when the screen took it |
| `update(dt, input)` | one step while the screen shows, after the game's update |
| `under` | drawn under the game's `drawOver` (a HUD stays over it) and before the other screens; it still takes clicks in its place on the stack |
| `hotspots` | a [Hotspots](Hotspots.md), in the screen's own coordinates (from its `x`, `y`): the default `click` gives each click to them (`Hotspots.click`), so a screen of buttons needs no `click` of its own; put each screen's buttons in a group to switch them together |
| `release` | its buttons are pressed, dragged and released, as most games' are (`Hotspots.mouseDown`, `mouseMove`, `mouseUp`): the engine passes the top visible screen its moves and releases |
| `modal` | it takes every click while it shows, so nothing under it sees one |
| `width`, `height` | its size, for `centre` |

## Methods

| Method | |
|---|---|
| `local(x, y)` | a point in the game's coordinates in the screen's own |
| `centre(width, height)` | puts it in the middle of an area that size (the block, the window) |
| `mouseMove(x, y)`, `mouseUp(x, y)` | the engine's moves and releases while it is on top, given to a pressed button |
| `letGo()` | forgets a pressed button without acting on it, as the screen goes |

A modal message box (hints, messages clicked away in turn) keeps its messages in a [MessageQueue](MessageQueue.md).

## Methods to override

### `click(x, y)`

Returns whether the screen took the click (default false: the game sees it).

### `update(dt, input)`

One step while the screen shows (default nothing).
