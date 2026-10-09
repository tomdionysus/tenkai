# Input

`lib/Input.js`

The keyboard, sampled once per game step. Keys are bound to named actions, so game code asks about
`'jump'` rather than `'KeyX'`, and one action can have several keys. Every [GameEngine](GameEngine.md)
has one, as `game.input`, and samples it at the start of each step.

```js
class MyGame extends GameEngine {
  constructor (options) {
    super(Object.assign({
      keys: { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], fire: ['Space'] }
    }, options))
  }

  update (dt) {
    this.player.x += this.input.axis('left', 'right') * 300 * dt
    if (this.input.pressed('fire')) this.shoot()
  }
}
```

Keys are named by
[`KeyboardEvent.code`](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values),
which names the physical key: `'KeyZ'`, `'ArrowLeft'`, `'Space'`, `'Enter'`.

## Within a step

| Method | Meaning |
|--------|---------|
| `down(action)` | Whether the action is held. |
| `pressed(action)` | Whether it went down since the previous step. |
| `released(action)` | Whether it came up since the previous step. |
| `doubleTapped(action)` | Whether it was pressed this step, within `doubleTapSteps` steps (default 14) of its previous press. Golden Axe uses this for running. |
| `latest(...actions)` | Of the given actions, the held one pressed most recently, or `null`. With the four directions, a newly pressed direction wins while an earlier one is still held. |
| `axis(negative, positive)` | -1, 0 or 1, as in `axis('left', 'right')`. |

A tap that starts and ends between two steps still counts as pressed, and released, in the next step.
Key repeat does not count as a press. Losing the window's focus releases everything.

A key that is not bound can be asked about by its code: `input.pressed('KeyQ')`.

## Methods

### `bind(bindings)`

Binds keys to actions, adding to existing bindings: `{ action: ['Code', ...] }`. The engine's `keys`
option does this. The browser's default action is prevented for bound keys only, so arrow keys stop
scrolling the page while other keys behave normally.

### `keyDown(event)` / `keyUp(event)`

Feed input by hand, with any object that has a `code`. On-screen buttons can call these to act as keys.

### `releaseAll()`

Releases everything.

### `beginStep()`

Takes the key changes since the last step. The engine calls this; call it yourself only when using an
Input outside an engine.

## Constructor options

| Option | Default | Meaning |
|--------|---------|---------|
| `target` | `window` | Where to listen for keys. |
| `bindings` | none | Initial bindings. |
