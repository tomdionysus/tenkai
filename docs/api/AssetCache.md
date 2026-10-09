# AssetCache

`lib/AssetCache.js`

Loads images by path when they are first asked for, and keeps them. It is for games with too many images
to declare up front with `addAsset`, such as the hundreds of pre-rendered views in a point-and-click
adventure.

```js
const { AssetCache } = require('tenkai')

var images = new AssetCache({ base: 'images/' })

// Start loading the next few views in the background
images.preload(['dock.jpg', 'path.jpg'])

// Draw one when it is ready
var img = await images.image('dock.jpg').ready
if (img) view.backContext.drawImage(img, 0, 0)
```

## Constructor options

| Option | Default | Meaning |
|--------|---------|---------|
| `base` | `''` | Prefix added to every path. |

## Methods

### `image(src)`

Returns `{ element, ready }` for the image at `base + src`, starting to load it the first time it is asked
for:

- `element` is the `<img>`. It may not have loaded yet.
- `ready` is a promise that resolves with the element once loaded, or with `null` if loading failed. It
  never rejects.

Asking again for the same path returns the same object.

### `preload(srcs)`

Starts loading several images. Returns a promise that resolves, once all of them have loaded or failed,
with an array of elements, using `null` for each one that failed.

### `loaded(src)`

Whether the image has finished loading successfully. Use it to draw without waiting when the image is
already there, and to fall back to `ready` when it is not.

## Notes

- Loading uses the image's `onload` event rather than `decode()`, because browsers may put off `decode()`
  indefinitely in a background tab.
- Nothing is ever removed from the cache.
