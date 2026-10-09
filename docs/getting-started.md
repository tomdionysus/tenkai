# Getting Started

This page builds the smallest useful Tenkai game: a ball you move with the arrow keys and drop with a click.

## Install

```
npm install tenkai
npm install --save-dev esbuild
```

Tenkai is CommonJS. Any bundler that understands `require` works; this page uses esbuild.

## The page

Tenkai replaces a placeholder element with its canvas. The placeholder's `width` and `height` attributes
set the canvas size.

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>My Game</title>
  <style>body { margin: 0; background: #000 }</style>
</head>
<body>
  <div id="game" width="640" height="480"></div>
  <script src="bundle.js"></script>
</body>
</html>
```

## The game

```js
// main.js
const { GameEngine, Scene, Entity, Sheet } = require('tenkai')

class MyGame extends GameEngine {
  constructor (options) {
    super(Object.assign({
      // Turn off the wheel scrolling and zooming the engine does by default
      enableScroll: false,
      enableZoom: false,
      // Name the keys the game uses
      keys: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'] }
    }, options))

    // Declare images here; they are loaded before init() runs
    this.addAsset('ball', 'assets/ball.png')
  }

  // Build the scene tree
  init () {
    this.world = this.addScene('world', new Scene())

    // The ball is a whole image, anchored at its centre so its position is its middle
    var sheet = new Sheet({ image: this.getAsset('ball'), anchor: [11, 11] })
    this.ball = this.world.addEntity('ball', new Entity({ sheet, x: 320, y: 240 }))

    // Mouse events carry the mouse position in game coordinates
    this.on('mousedown', () => {
      this.ball.x = this.mouseX
      this.ball.y = this.mouseY
    })
  }

  // Called 60 times a second with the length of a step in seconds
  update (dt) {
    var speed = 240
    this.ball.x += this.input.axis('left', 'right') * speed * dt
    this.ball.y += this.input.axis('up', 'down') * speed * dt
  }
}

new MyGame({ targetId: 'game' }).start()
```

## Run it

```
npx esbuild main.js --bundle --outfile=bundle.js --servedir=. --serve=8000
```

Open http://localhost:8000. esbuild rebuilds the bundle on every page load.

Images must be served over HTTP, not opened from `file://`, or the browser will refuse to load them.

## What happened

1. `start()` loaded `assets/ball.png`, swapped the `<div>` for a 640x480 canvas, and called `init`.
2. `init` added a `Scene` to the engine and an `Entity` to the scene. The entity shows its sheet's one
   tile with the sheet's anchor, the ball's centre, at its `x` and `y`.
3. Sixty times a second the engine samples the keys and calls `update(dt)`; every frame it draws the tree.
   Moving the ball is just a matter of changing its `x` and `y`.

## Next steps

- Draw a background or text around your sprites with a scene's `background` and `foreground`. See
  [Scene](api/Scene.md).
- Describe a sprite sheet's frames and animations once in a [Sheet](api/Sheet.md), and play them on
  entities with `play('walk')`. See [Entity](api/Entity.md).
- Use several scenes with different `z` values as layers, such as background, play area and HUD.
- Split the game into modes (title, play, game over) with `setMode`. See [GameEngine](api/GameEngine.md).
- Read the [examples](examples.md): Arkanoid is a whole game in one short file.
- Read the [architecture](architecture.md) for time, drawing order and depth.
