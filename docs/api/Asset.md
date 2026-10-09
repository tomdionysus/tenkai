# Asset

`lib/Asset.js`

An image: a sprite sheet, tile sheet or background. It wraps an HTML `<img>` element.

Normally you do not create assets yourself. Declare them on the engine, and look them up by name once the
game has started:

```js
// in your GameEngine constructor
this.addAsset('sprites', 'assets/sprites.png')

// in init() or later
var sheet = this.getAsset('sprites')
```

`start()` loads every declared asset before calling `init`. If any fails to load, the start fails with an
error naming the file.

## Using one directly

```js
const { Asset } = require('tenkai')

var asset = new Asset({ name: 'tiles', src: 'assets/tiles.png' })
asset.load((err, asset) => {
  if (err) return console.error(err.message)
  // asset.element is the loaded <img>
})
```

## Constructor options

| Option | Meaning |
|--------|---------|
| `name` | The asset's name. |
| `src` | The image URL. |

## Properties

| Property | Meaning |
|----------|---------|
| `name`, `src` | As given. |
| `element` | The `<img>` element, created by `load()`. |

## Methods

### `load(callback)`

Creates the image element and starts loading it. The callback is called as `callback(null, asset)` once it
has loaded, or `callback(error, asset)` if it fails.

## See also

[AssetCache](AssetCache.md), for images loaded by path when first needed rather than all at start-up.
