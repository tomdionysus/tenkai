# GameEngine

`lib/GameEngine.js`. Uses [HasEventsMixin](HasEventsMixin.md), [HasScenesMixin](HasScenesMixin.md) and
[HasEntitiesMixin](HasEntitiesMixin.md).

The top-level container. It replaces a page element with a canvas, loads assets and audio, runs the game
in fixed steps and draws it every frame. It owns the keyboard (`input`), game-time timers and the current
mode. Write your game as a subclass.

```js
const { GameEngine, Scene } = require('tenkai')

class MyGame extends GameEngine {
  constructor (options) {
    super(Object.assign({
      enableScroll: false,
      enableZoom: false,
      pixelated: true,
      keys: { left: ['ArrowLeft'], right: ['ArrowRight'], fire: ['Space'] }
    }, options))
    this.addAsset('sprites', 'assets/sprites.png')
  }

  init () {
    this.world = this.addScene('world', new Scene())
  }

  update (dt) {
    // game logic, run 60 times a second
    super.update(dt)
  }
}

new MyGame({ targetId: 'game' }).start()
```

## Constructor options

| Option | Default | Meaning |
|--------|---------|---------|
| `targetId` | required | Id of the element to replace with the canvas. Its `width` and `height` attributes size the canvas. |
| `stepRate` | `60` | Game steps per second. |
| `keys` | none | Key bindings for [`input`](Input.md): `{ action: ['KeyCode', ...] }`. |
| `pixelated` | `false` | Draw images without smoothing, and ask the page to scale the canvas without smoothing, for pixel art. |
| `fullscreen` | `false` | Size the canvas to the window, and follow window resizes. |
| `showHUD` | `false` | Draw a debug line with the viewport, zoom, mouse position and limits. |
| `scale` | `1` | Zoom; 2 draws everything twice the size. |
| `x`, `y` | `0` | Viewport offset in game pixels, added to everything drawn. |
| `minScale`, `maxScale` | none | Limits for zooming with the wheel. |
| `minX`, `minY`, `maxX`, `maxY` | none | Limits for the viewport offset. |
| `globalAlpha` | `1` | Opacity for everything drawn. |
| `enableScroll` | `true` | The mouse wheel pans the viewport. |
| `enableZoom` | `true` | Shift with the mouse wheel zooms. |

## Properties

| Property | Meaning |
|----------|---------|
| `element` | The canvas, after start-up. |
| `width`, `height` | The visible area in game pixels: the canvas size divided by `scale`. |
| `mouseX`, `mouseY` | The last mouse position in game coordinates. |
| `input` | The keyboard, an [Input](Input.md). |
| `time` | Game time in seconds: the steps run so far. |
| `stepTime` | The length of a step in seconds. |
| `mode` | The current mode (see `setMode`). |
| `x`, `y`, `scale`, `globalAlpha` | The viewport. Change them at any time. |
| `assets`, `audio` | The loaded `Asset` and `Audio` objects, by name. |
| `running` | Whether the game is running. |

## Time

The game runs in fixed **steps**, `stepRate` per second, whatever the display's frame rate. Each animation
frame, the engine runs as many steps as the time since the last frame holds (catching up at most a
quarter of a second, so a stalled or background tab does not fast-forward the game), then draws once.

Each step:

1. `input` takes the key changes since the last step.
2. `time` advances by one step.
3. [`update(dt)`](#updatedt) runs your game logic, and the mode's.
4. Timers that have come due run, in the order they were due.
5. Animations advance, in every scene and entity.

Because logic, timers and animation all advance together in steps, they stay in step with each other,
pause together, and behave the same at any frame rate.

## Methods to override

### `init(callback)`

Called once after assets and audio have loaded and the canvas exists. Build your scenes and entities
here. It can be written three ways:

- taking no arguments, and simply returning;
- as an `async` method, for loading more data first;
- taking `callback`, and calling it when done, or with an error to abort the start.

### `update(dt)`

Called once per step with the step's length in seconds. Put game logic here. The default runs the current
mode's `update(dt)`; call `super.update(dt)` from your own to keep that.

## Modes

A game usually has states: a title screen, play, a pause, game over. A **mode** is an object for one of
them, with any of these optional methods:

| Method | Called |
|--------|--------|
| `enter(previous)` | When the game switches to it. |
| `exit()` | When the game switches away. |
| `update(dt)` | Every step, by the default `update`. |
| `draw(context)` | Every frame, after the scenes and entities, in game coordinates. |

Anything else on it is up to the game, such as a `click` method the game calls from its mouse handler.

### `setMode(mode)`

Switches mode: calls the old one's `exit`, then the new one's `enter`.

```js
class Title {
  constructor (game) { this.game = game }
  update () { if (this.game.input.pressed('start')) this.game.setMode(new Play(this.game)) }
  draw (context) { context.fillText('PRESS START', 120, 100) }
}
```

## Timers

Timers run on game time, so they pause with the game and stay in step with movement.

### `after(seconds, fn)`

Calls `fn` after `seconds` of game time. Returns the timer, which has `cancel()`.

### `every(seconds, fn)`

Calls `fn` every `seconds` of game time. Returns the timer, which has `cancel()`.

### `clearTimers()`

Cancels every timer.

## Other methods

### `start(callback)`

Loads assets and audio, boots the canvas, calls `init`, then starts the game and triggers `running`. The
optional `callback(err)` is called when this has finished or failed.

### `stop()`

Stops the game after the current frame.

### `step(dt)`

Runs one step (see [Time](#time)). The frame loop calls this; call it yourself to drive the game in tests,
step by step, without a clock.

### `draw(context)`

Draws a frame: clears to black, then draws the scenes, the engine's own entities and the mode through the
viewport, then the HUD.

### `addAsset(name, src)` / `getAsset(name)`

`addAsset` declares an image to load at start-up. `getAsset` returns the loaded [Asset](Asset.md), and
throws `'Asset not found: <name>'` if there is none. Declare assets in the constructor so they are
available in `init`.

### `addAudio(name, src, type)` / `getAudio(name)`

The same for [Audio](Audio.md). `type` is the MIME type, such as `'audio/mpeg'`.

### `setGlobalAlpha(alpha)`

Sets `globalAlpha`.

### Lower-level methods

`start()` calls these, and you rarely need them yourself:

- `loadAssets(callback)` loads all declared assets.
- `loadAudio(callback)` loads all declared audio.
- `bootElement(callback)` creates the canvas and attaches the mouse listeners.
- `recomputeFullScreen()` resizes the canvas to the window and triggers `resize`.

### From the mixins

- Scenes: `addScene`, `removeScene`, `getScene`, `getScenesAtLayer`.
- Entities drawn directly on the engine, over all scenes: `addEntity`, `removeEntity`, `getEntity`.
- Events: `on`, `unon`, `addEventListener`, `removeEventListener`, `trigger`.

## Events

| Event | Arguments | When |
|-------|-----------|------|
| `running` | `(engine)` | The game has started. |
| `mousedown` | `(engine, event)` | A mouse button was pressed on the canvas. |
| `mouseup` | `(engine, event)` | A mouse button was released on the canvas. |
| `mousemove` | `(engine, event)` | The mouse moved over the canvas. |
| `resize` | `(engine)` | The canvas was resized to the window, in fullscreen mode. |

`mouseX` and `mouseY` are updated before the event is triggered. Handlers run just after the DOM event, so
use `engine.mouseX` rather than the event's own coordinates.

## Mouse details

- Mouse positions allow for where the canvas is on the page, CSS scaling of the canvas, `scale`, and the
  viewport offset.
- The wheel pans by the wheel delta when `enableScroll` is on. With shift held, it zooms about the centre
  of the view when `enableZoom` is on. Both keep within the configured limits. While either is on, wheel
  events over the canvas do not scroll the page.
- `mouseup` is only seen if the mouse is released over the canvas.
