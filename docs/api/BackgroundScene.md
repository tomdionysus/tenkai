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

If you leave out `width` or `height`, they are read from the image when the scene is created, so the asset
must already be loaded. Assets from `getAsset` in `init` are.

## Drawing order

The image, then child scenes, then entities, as in `Scene`.
