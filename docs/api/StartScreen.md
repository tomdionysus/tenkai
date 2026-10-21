# StartScreen

`lib/StartScreen.js`

The screen a game shows before it starts: its title, the original publisher and year, a gently pulsing "Click
or press any key to start", and Tenkai's logo in the bottom right corner. Browsers let a page play sound only
after the player has clicked or pressed a key, so the game waits here for that first touch.

Most games use it through the engine's `startScreen` option, which shows one before `init` and unlocks audio
when the player starts (see [GameEngine](GameEngine.md#sound-and-the-start-screen)):

```js
class Wreckers extends GameEngine {
  constructor () {
    super({
      targetId: 'game',
      startScreen: { title: 'WRECKERS', year: 1991, publisher: 'Audiogenic Software' }
    })
  }
}
```

It fits whatever it is shown on. On a page it draws on a canvas of its own, laid over the window (or, with
`fit: 'canvas'`, over the game's canvas where it shows in the window), at the screen's pixel density so text
is sharp, and lays itself out again whenever the window or the game changes size. Sizes follow the shorter
side, so a tall narrow window keeps the same proportions as a wide one; a title too wide for the window
shrinks to fit; the logo stays in the corner. Without a page (in tests) it draws on the game's canvas.

Tab and modifier keys on their own do not start the game, so keyboard users can move focus without starting
it.

## Options

| Option | Default | Meaning |
|--------|---------|---------|
| `title` | the page's title | Large text in the middle; `''` for none. |
| `year`, `publisher` | none | The line under the title: "1991  Audiogenic Software". |
| `subtitle` | the year and publisher | The line under the title, written out instead. |
| `prompt` | `'Click or press any key to start'` | The line asking the player to start. |
| `logo` | Tenkai's logo | An image, or its URL, for the bottom right corner; `null` for none. |
| `cover` | none | Cover art (the game's box), an image or its URL, above the title in the middle of the screen; the cover, title, subtitle and prompt are centred on the screen together. Without it the screen is as before. |
| `coverHeight` | 0.5 | The cover's height as a share of the shorter side; it is kept within the window's width and the space the lines leave. |
| `logoColor` | the text colour | Draw the logo all in this colour; `''` for its own colours. |
| `logoHeight` | a seventh of the shorter side | The logo's height in pixels; its width follows. |
| `background`, `color` | `'black'`, `'#e8e8e8'` | Fill and text colours. |
| `fontFamily` | `'sans-serif'` | The family for the title, the line under it and the prompt. |
| `titleFont`, `subtitleFont`, `font` | sized from the screen | Whole CSS fonts instead, fixed in size. |
| `fit` | `'viewport'` | `'viewport'` covers the window; `'canvas'` covers the game's canvas. |

## Methods

### `show({ element, window, document, onStart })`

Shows the screen until the player clicks, taps or presses a key, then takes it away and calls
`onStart(event)`. `element` is the game's canvas. Returns the start screen.

### `hide()`

Takes the screen away without starting.

### `layout(width, height)`

Where everything goes on a screen of that size in CSS pixels: `{ unit, title, subtitle, prompt, cover, logo,
margin }`, each line with its font `size` and centre `y`, the cover and the logo as `{ x, y, width, height }`
(or `null` when there is none, or until its image has loaded).

### `draw(context, width, height, now)`

Draws the screen on a 2D context of that size, with the prompt's pulse at `now` milliseconds.

## Properties

| Property | Meaning |
|----------|---------|
| `showing` | Whether it is on screen. |

`TenkaiLogo` (also exported) is the logo as a data URL, for games that want it elsewhere.
