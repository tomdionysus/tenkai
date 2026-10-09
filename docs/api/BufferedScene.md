# BufferedScene

`lib/BufferedScene.js`. Extends [Scene](Scene.md).

A scene for slideshow-style games, where the picture is composed rather than redrawn every frame. It keeps
two canvases the size of the scene:

- the **back buffer**, where the next picture is put together;
- the **screen**, which is what the player sees.

You draw into either one, copy all or part of the back buffer to the screen, and animate from a snapshot of
the old screen to the new one with a dissolve or a wipe. Entities, such as a [Video](Video.md), are drawn
over the screen.

```js
var view = game.addScene('view', new BufferedScene({ width: 544, height: 333 }))

async function show (image) {
  var before = view.snapshot()                // what the player sees now
  view.backContext.drawImage(image, 0, 0)     // compose the next view
  view.copyToScreen()                         // put it on the screen
  await view.transition(before, { type: 'dissolve', duration: 300 })
}
```

## Constructor options

All [Scene](Scene.md) options, plus:

| Option | Default | Meaning |
|--------|---------|---------|
| `width`, `height` | required | Size of both canvases, in pixels. |
| `createCanvas` | `document.createElement('canvas')` | Function that returns a new canvas. Pass one for tests or OffscreenCanvas. |

## Properties

| Property | Meaning |
|----------|---------|
| `back`, `screen` | The two canvases. |
| `backContext`, `screenContext` | Their 2D contexts. |
| `transitioning` | Whether a transition is in progress. |

## Methods

### `copyToScreen(rect)`

Copies the back buffer to the same place on the screen. `rect` is `[left, top, right, bottom]` and defaults
to everything. Copying only the part that changed lets you update one switch or dial without disturbing
the rest of the view.

### `snapshot()`

Returns a new canvas holding a copy of the screen as it is now. Take it before changing the screen, then
pass it to `transition`.

### `transition(before, options)`

Animates from `before` (usually a snapshot) to the current screen. It returns a promise that resolves when
the transition has finished.

| Option | Default | Meaning |
|--------|---------|---------|
| `type` | `'dissolve'` | `'dissolve'`, `'wipeLeft'`, `'wipeRight'`, `'wipeUp'`, `'wipeDown'` or `'none'`. |
| `rect` | everything | `[left, top, right, bottom]` to animate. The rest shows the new screen at once. |
| `duration` | `250` | Milliseconds. |

A wipe reveals the new picture moving in the named direction: `wipeRight` uncovers it from the left edge
towards the right. `'none'`, or a missing `before`, resolves at once.

Transitions run on the clock, not on frames. The promise resolves after `duration` even if nothing is
being drawn, as in a background tab, so game code awaiting it never hangs. Starting a new transition ends
the previous one and resolves its promise.

### `draw(context)`

Draws the screen canvas at the scene's position, then child scenes and entities in z order, as `Scene`
does, then the old picture of any transition in progress over them, then the `foreground`. Pass a
`foreground` option for overlays such as messages or a cursor, which then stay over transitions too.

## Notes

- The scene's `width` and `height` are its canvas size. They are independent of the engine's size, so
  you can centre a small view in a large window by setting the scene's `x` and `y`.
- Draw images into the buffers with your own `drawImage` calls. [AssetCache](AssetCache.md) is a
  convenient way to load them.
