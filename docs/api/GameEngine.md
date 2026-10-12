# GameEngine

`lib/GameEngine.js`. Uses [HasEventsMixin](HasEventsMixin.md), [HasScenesMixin](HasScenesMixin.md) and
[HasEntitiesMixin](HasEntitiesMixin.md).

The top-level container. It replaces a page element with a canvas, loads assets and audio, runs the game
in fixed steps and draws it every frame. It owns the keyboard (`input`), game-time timers and the current
mode. Write your game as a subclass.

```js
import { GameEngine, Scene } from 'tenkai'

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
| `minScale`, `maxScale` | none | Limits for zooming with the wheel; `maxScale` also caps the `block` layout's scale. |
| `block` | none | With `fullscreen`: `{ width, height }`, a block of game pixels kept whole and centred in the window at the largest whole scale that fits (see [The window and the block](#the-window-and-the-block)). |
| `minX`, `minY`, `maxX`, `maxY` | none | Limits for the viewport offset. |
| `globalAlpha` | `1` | Opacity for everything drawn. |
| `enableScroll` | `true` | The mouse wheel pans the viewport. |
| `enableZoom` | `true` | Shift with the mouse wheel zooms. |
| `startScreen` | none | Before `init`, show a [StartScreen](StartScreen.md) asking the player to click or press a key, so sound can play: `true`, or its options (`{ title, year, publisher, prompt, logo, ... }`). See [Sound and the start screen](#sound-and-the-start-screen). |
| `audioContext` | none | An `AudioContext` to share, instead of the one `unlockAudio` creates. |

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
| `audioContext` | The shared `AudioContext`, once `unlockAudio` has run (the start screen runs it). |
| `audioUnlocked` | Whether the player has clicked or pressed a key to let sound play. |

## Sound and the start screen

Browsers do not let a page play sound until the player has interacted with it: a click, a tap or a key
press. Before that, a Web Audio `AudioContext` stays suspended and `<audio>` elements refuse to play, so a
game that starts its music in `init` would start in silence.

The `startScreen` option deals with this. After loading, the engine shows a screen with the game's title and
a gently pulsing "Click or press any key to start", and waits. When the player clicks, taps
or presses a key, it creates or resumes the shared `audioContext`, sets `audioUnlocked`, triggers
`audiounlocked`, and only then calls `init`, so the game can start its sound straight away:

```js
class MyGame extends GameEngine {
  constructor (options) {
    super(Object.assign({ startScreen: { title: 'My Game' } }, options))
  }

  init () {
    this.sounds = new SoundManager({ context: this.audioContext })
    this.sounds.playMusic('music/theme.mp3')
  }
}
```

The screen is a [StartScreen](StartScreen.md): the title, the year and publisher under it, the prompt and
Tenkai's logo in the corner, covering the window and laid out again as it changes size. Its options are
listed there.

Tab and modifier keys on their own do not start the game, so keyboard users can move focus without
starting it. A game without sound needs no start screen. A game that wants its own title screen can leave
the option out and call `unlockAudio()` from its own click or key handler instead.

### `unlockAudio()`

Creates the shared `audioContext` if there is none, resumes it, sets `audioUnlocked` and triggers
`audiounlocked`. Call it from inside a click, tap or key handler: browsers only allow it there. Returns the
context, or `null` in a browser without Web Audio.

### `showStartScreen(callback)`

Shows a [StartScreen](StartScreen.md) with the `startScreen` options (as `startScreenView`) and calls
`callback` once the player has clicked or pressed a key and audio is unlocked. `start()` calls it when the
`startScreen` option is set.

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

## The window and the block

A game that draws fixed screens at a fixed size (a 320 by 200 original, say) but wants the rest of a large window
too gives `fullscreen` and `block: { width, height }`. On every resize the engine picks the largest whole scale at
which the block fits (at least 1, at most `maxScale`), sizes `width` and `height` to the window in game pixels, and
sets `x` and `y` so the block is centred: the game's coordinates are the block's, and its fixed screens drawn there
stay centred and the same size. `windowRect` is the whole window in those coordinates (`{ x, y, width, height }`,
x and y 0 or less), for a scene that should fill it; `fitBlock()` redoes the fit, and `resize` is triggered after.

```js
const game = new GameEngine({ targetId: 'game', fullscreen: true, block: { width: 320, height: 200 }, maxScale: 3 })
game.on('resize', () => {
  const w = game.windowRect
  view.x = w.x
  view.y = w.y
})
```

## Screens

Screens ([Screen](Screen.md)) shown over the game, in a stack: the top visible one takes each click first, the
visible ones are stepped after `update` and drawn over everything else.

### `showScreen(screen)`

Shows a screen on top (moving it to the top if it was shown already); returns it.

### `hideScreen(screen)`

Takes a screen off the stack.

### `topScreen`

The top visible screen, or null. `screenStack` lists them all, bottom first.

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

Loads assets and audio, boots the canvas, shows the start screen if there is one and waits for the player,
calls `init`, then starts the game and triggers `running`. The
optional `callback(err)` is called when this has finished or failed.

### `stop()`

Stops the game after the current frame.

### `step(dt)`

Runs one step (see [Time](#time)). The frame loop calls this; call it yourself to drive the game in tests,
step by step, without a clock.

### `draw(context)`

Draws a frame: clears to black, then draws the scenes, the engine's own entities and the mode through the
viewport, then the screens marked `under`, then `drawOver`, then the other screens, then the HUD.

### `reportError(error)`

An error thrown in a frame (a step or the drawing) does not stop the game: the frame loop catches it, resets the
canvas's transform, and reports it here, once for each different message, to the `onError` option
(`onError(error)`) or the console. The next frame runs as usual.

### `drawOver(context)`

The game's own drawing over its scenes and under its screens, in the viewport's coordinates: a status panel that
a menu screen covers. Does nothing; override it.

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
| `audiounlocked` | `(engine)` | The player clicked or pressed a key, so sound may play (see `unlockAudio`). |

`mouseX` and `mouseY` are updated before the event is triggered. Handlers run just after the DOM event, so
use `engine.mouseX` rather than the event's own coordinates.

## Mouse details

- Mouse positions allow for where the canvas is on the page, CSS scaling of the canvas, `scale`, and the
  viewport offset.
- The wheel pans by the wheel delta when `enableScroll` is on. With shift held, it zooms about the centre
  of the view when `enableZoom` is on. Both keep within the configured limits. While either is on, wheel
  events over the canvas do not scroll the page.
- `mouseup` is only seen if the mouse is released over the canvas.
