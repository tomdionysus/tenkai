# MouseLook

`lib/MouseLook.js`

The mouse as a first-person game reads it: how far it moved since the last frame, to turn and look by, and its
buttons. The game has the mouse once the player clicks on it (or from the start, after a start screen's click):
it then asks the browser for the pointer (pointer lock), so the cursor stays put and the mouse turns without
limit. Where the browser will not give the pointer, the mouse still turns while it moves over the game and the
page has the focus. Escape, leaving the page or hiding the tab lets the mouse go; a click takes it again. The
click that takes the mouse only takes it; later clicks press the buttons.

```js
const mouse = new MouseLook({ elements: [game.element], held: true })   // held: the start screen's click gave it
// each drawn frame (not each step: a frame holds none, one or two steps, and turning by the frame is smooth):
const { dx, dy } = mouse.read()
look.yaw += dx * 0.002
look.pitch -= dy * 0.002
if (mouse.buttons.left) fire()
```

## Constructor options

| Option | Default | Meaning |
|--------|---------|---------|
| `elements` | none | The canvas or canvases the game is drawn in: a click on one takes the mouse, and the pointer is asked on whichever is shown (a [WebGLScene](WebGLScene.md) presented over the game's canvas, say). |
| `held` | false | Whether the game has the mouse from the start. |
| `sensitivity` | 1 | A factor on the movement read. |
| `document`, `window` | the page's | For tests. |

## Methods

| Method | |
|---|---|
| `read()` | `{ dx, dy }`: how far the mouse moved since the last read, times the sensitivity; then nothing until it moves again |
| `take()` | the game takes the mouse, and asks for the pointer |
| `release()` | lets it go: the buttons up, the pointer given back |
| `lock()` | asks the browser for the pointer on the shown element (only from a click or a key: the browser's rule) |
| `shown()` | the element shown now (not hidden by its style) |
| `attach()` / `detach()` | listen to the page (the constructor attaches when there is a document) or stop |

## Properties

| Property | Meaning |
|----------|---------|
| `held` | Whether the game has the mouse. |
| `locked` | Whether the browser has given the pointer to one of the elements. |
| `buttons` | `{ left, right, middle }`, each true while held. |
