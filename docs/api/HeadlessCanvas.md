# HeadlessCanvas

`lib/HeadlessCanvas.js`

A canvas that draws nothing, for running a game where there is no page (a check in Node): its 2D context takes every
call and does nothing, answers `createImageData` and `getImageData` with blank images of the size asked, and
`measureText` with a width of 0. Its `addEventListener` keeps the listeners in `listeners`, so a check that gives it
to the engine ([GameEngine](GameEngine.md)`.attach`) can send the mouse by calling them.

```js
HeadlessCanvas.install()
const canvas = new HeadlessCanvas(320, 200)
game.attach(canvas)
game.step(1 / 50)
game.draw(canvas.getContext('2d'))
canvas.listeners.mousedown({ x: 40, y: 60, button: 0 })
```

| Member | |
|---|---|
| `new HeadlessCanvas(width, height)` | |
| `getContext()` | the do-nothing 2D context (its `canvas` is this) |
| `addEventListener(name, fn)`, `listeners` | the last listener for each event, by name |
| `HeadlessCanvas.install()` | where there is no `document`, one whose `createElement` answers headless canvases, for the classes that make their own ([IndexedScene](IndexedScene.md), `IndexedSurface.toCanvas`) |
