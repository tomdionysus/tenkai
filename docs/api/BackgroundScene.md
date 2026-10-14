# BackgroundScene

`lib/BackgroundScene.js`. Extends [Scene](Scene.md).

A scene that draws a region of an image beneath its children. Move it with `x` and `y`, or pan within a
larger image with `offsetX` and `offsetY`.

```js
var sky = new BackgroundScene({ asset: game.getAsset('sky'), width: 640, height: 480, z: 0 })
game.addScene('sky', sky)

// in update(dt): scroll the picture
sky.offsetX = (sky.offsetX + 20 * dt) % 1280
```

## Constructor options

All [Scene](Scene.md) options, plus:

| Option | Default | Meaning |
|--------|---------|---------|
| `asset` | required | The loaded [Asset](Asset.md) to draw. |
| `offsetX`, `offsetY` | `0` | Top-left of the region of the image to draw. |
| `width`, `height` | the image's size | Size of the region, and of what is drawn. |

| `repeatX` | `false` | Repeat the region across the scene's span: a parallax strip. `offsetX` then scrolls within the strip (any amount, either way), which starts at `sourceX`, `sourceY` of the image. |
| `sourceX`, `sourceY` | `0` | With `repeatX`, where the strip is on the image. |
| `span` | the game's width, else the region's | With `repeatX`, how far across to cover. |
| `fill` | none | A colour painted over the span before the image: the sky behind a strip. |

If you leave out `width` or `height`, they are read from the image when the scene is created, so the asset
must already be loaded. Assets from `getAsset` in `init` are.

```js
// A parallax strip at half the camera's speed, the sky behind it
const far = new BackgroundScene({ asset: game.getAsset('level1'), repeatX: true, sourceY: 224, width: 800, height: 104, fill: '#5a6ea8', z: 0 })
// each step:
far.offsetX = camera.x * 0.5
```

## Drawing order

The image, then child scenes, then entities, as in `Scene`.
