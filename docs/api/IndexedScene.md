# IndexedScene

`lib/IndexedScene.js`

Extends [Scene](Scene.md). Shows an [IndexedSurface](IndexedSurface.md) through a [Palette](Palette.md):
each frame it turns the surface's indices into colours and draws the result as its background, under any
child scenes and entities. The game draws into the surface and changes the palette; the scene only presents
them, so a palette change (a fade, a cycle) shows on the next frame without redrawing anything.

Small surfaces can be laid over the picture as **layers**, such as a cursor drawn in the game's own
colours. Layers are composed only into what is shown, never into the surface, so game code that reads the
surface back does not see them.

The picture is drawn at one canvas pixel per surface pixel. Use the scene's or the engine's `scale` to
enlarge it, with the engine's `pixelated` option for sharp pixels.

```js
const frame = new IndexedSurface({ width: 320, height: 200 })
const palette = new Palette({ colors: roomColors })
const pointer = { surface: cursorSurface, x: 0, y: 0, visible: true }
game.addScene('screen', new IndexedScene({ surface: frame, palette, layers: [pointer] }))
// Later, move the pointer layer with the mouse
pointer.x = game.mouseX - hotspotX
```

## Constructor

`new IndexedScene(options)` takes the [Scene](Scene.md) options, and:

| Option | Default | |
|---|---|---|
| `surface` | | The picture. |
| `palette` | | Its colours. |
| `layers` | none | Surfaces over it, each `{ surface, x, y, visible, palette }`, first lowest. A layer's own `palette` is optional. |
| `createCanvas` | a DOM canvas | Makes the offscreen canvas, as `createCanvas(width, height)`; for tests or workers. |

`surface`, `palette` and `layers` are properties and can be swapped at any time.

## Methods

### render()

Turn the surface and its layers into colours, in an ImageData kept between frames, and return it. The scene
calls it when drawing; call it yourself to take a screenshot.

### background(context)

Draws the rendered picture at the scene's origin.
