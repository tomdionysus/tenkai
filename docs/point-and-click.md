# Point-and-click Adventures

Tenkai has a set of classes for slideshow-style adventures in the style of Myst: the world is a set of
pre-rendered views, and the player clicks to move between them and to work things in them.

| Class | Job |
|-------|-----|
| [BufferedScene](api/BufferedScene.md) | The view: a back buffer to compose in, a screen to show, and transitions between them. |
| [AssetCache](api/AssetCache.md) | Loads view images as they are needed. |
| [Hotspots](api/Hotspots.md) | Regions of the view that do something, with their cursors. |
| [Cursor](api/Cursor.md) | Draws the cursor images. |
| [Video](api/Video.md) | Plays movies over the view. |
| [SoundManager](api/SoundManager.md) | The background loop for each place, and sound effects. |

This page builds a small adventure with all of them.

## Layout of the game

```
index.html
main.js
views/       one image per view, and the cursor images
sounds/      background loops and effects
movies/      MP4 movies
```

The views are data. Each one names its image and background sound, and lists its hotspots:

```js
const VIEWS = {
  dock: {
    image: 'dock.jpg',
    sound: 'waves.wav',
    spots: [
      { rect: [220, 0, 420, 400], cursor: 'forward', go: 'path' },
      { rect: [0, 0, 120, 400], cursor: 'left', go: 'shore', wipe: 'wipeRight' }
    ]
  },
  shore: {
    image: 'shore.jpg',
    sound: 'waves.wav',
    spots: [
      { rect: [520, 0, 640, 400], cursor: 'right', go: 'dock', wipe: 'wipeLeft' }
    ]
  },
  path: {
    image: 'path.jpg',
    sound: 'wind.wav',
    spots: [
      { rect: [300, 120, 380, 220], cursor: 'hand', movie: { src: 'movies/gate.mp4', x: 300, y: 120 } },
      { rect: [0, 330, 640, 400], cursor: 'back', go: 'dock' }
    ]
  }
}
```

## The view and the cursor

The view is a `BufferedScene`. It draws its screen, then any movie entities, then any transition in
progress, then its `foreground`, which is where the cursor goes, on top of all of that:

```js
const { GameEngine, BufferedScene, AssetCache, Hotspots, Cursor, SoundManager, Video } = require('tenkai')

const W = 640
const H = 400
```

## The game

```js
class Adventure extends GameEngine {
  constructor (options) {
    super(Object.assign({ enableScroll: false, enableZoom: false }, options))
    this.images = new AssetCache({ base: 'views/' })
    this.sounds = new SoundManager({ base: 'sounds/' })
    this.hotspots = new Hotspots()
    this.cursor = new Cursor()
    this.busy = false
  }

  async init () {
    this.element.style.cursor = 'none'
    this.view = this.addScene('view', new BufferedScene({
      width: W,
      height: H,
      foreground: (context) => {
        var id = this.busy ? 'wait' : this.hotspots.cursorAt(this.mouseX, this.mouseY, 'arrow')
        this.cursor.draw(context, this.mouseX, this.mouseY, id)
      }
    }))

    // Cursor images, with the point that clicks
    var cursors = { arrow: [0, 0], wait: [8, 8], hand: [6, 1], forward: [8, 0], back: [8, 15], left: [0, 8], right: [15, 8] }
    for (var id in cursors) {
      var img = await this.images.image('cursor-' + id + '.png').ready
      this.cursor.define(id, img, cursors[id][0], cursors[id][1])
    }

    this.hotspots.bind(this)
    // Browsers only allow sound after a click
    this.on('mousedown', () => this.sounds.resume())

    await this.go('dock', 'none')
  }

  // Show a view: compose it, swap the hotspots, and transition from the old picture
  async go (name, type = 'dissolve') {
    var view = VIEWS[name]
    this.busy = true

    var img = await this.images.image(view.image).ready
    var before = this.view.snapshot()
    this.view.backContext.drawImage(img, 0, 0)
    this.view.copyToScreen()

    this.sounds.playBackground(view.sound, { volume: 0.6 })

    this.hotspots.clear()
    for (const spot of view.spots) {
      this.hotspots.add(Object.assign({ onClick: () => this.use(spot) }, spot))
    }

    await this.view.transition(before, { type, duration: 400 })
    this.busy = false

    // Start loading the views the player can reach from here
    this.images.preload(view.spots.filter((s) => s.go).map((s) => VIEWS[s.go].image))
  }

  async use (spot) {
    if (this.busy) return
    if (spot.go) return this.go(spot.go, spot.wipe)
    if (spot.movie) {
      this.busy = true
      var movie = this.view.addEntity('movie', new Video(spot.movie))
      await movie.play()
      movie.draw(this.view.screenContext)   // keep the last frame on the screen
      this.view.removeEntity('movie')
      this.busy = false
    }
  }
}

new Adventure({ targetId: 'game' }).start()
```

Some points about how this works:

- **Moving.** Each view change takes a snapshot of the screen, draws the new image into the back buffer,
  copies it to the screen, and then transitions from the snapshot. A sideways turn uses a wipe; anything
  else dissolves.
- **Busy.** `busy` blocks clicks during transitions and movies, and shows the wait cursor.
- **Loading.** The first visit to a view waits for its image. After arriving, the game preloads every
  neighbouring view, so most moves are instant.
- **Sound.** `playBackground` with the sound that is already playing only adjusts the volume. Walking
  between the dock and the shore keeps the waves going without a restart. Moving to the path cross-fades
  to the wind.
- **Movies.** A movie plays as an entity over the view. When it ends, its last frame is stamped onto the
  screen, and the entity is removed.

## Changing part of a view

Switches, dials and doors usually change a small part of the picture. Draw the new state into the back
buffer and copy just that rectangle to the screen:

```js
function showSwitch (game, on) {
  var r = [300, 200, 340, 260]
  var img = game.images.image(on ? 'switch-on.png' : 'switch-off.png').element
  game.view.backContext.drawImage(img, r[0], r[1])
  game.view.copyToScreen(r)
}
```

To animate the change, snapshot the screen first and pass the same rectangle to `transition`:

```js
var before = game.view.snapshot()
showSwitch(game, true)
await game.view.transition(before, { type: 'wipeDown', rect: [300, 200, 340, 260], duration: 150 })
```

Because the back buffer holds the whole composed view, a later `copyToScreen` of a larger area keeps the
switch in its new state.

## Dragging

Levers, wheels and sliders use the press, drag and release handlers. `onDrag` and `onUp` keep coming to
the hotspot that was pressed, even when the mouse leaves it:

```js
game.hotspots.add({
  rect: [370, 60, 420, 150],
  cursor: 'grab',
  onDown: () => { lever.start = game.mouseY },
  onDrag: (spot, x, y) => showLever(game, Math.max(0, Math.min(4, Math.floor((y - lever.start) / 20)))),
  onUp: () => { if (lever.position === 4) openGate() }
})
```

`cursorAt` keeps returning the pressed hotspot's cursor during the drag.

## Testing

Every one of these classes accepts its browser dependencies as options: `createCanvas` for
`BufferedScene`, `element` for `Video`, and `context` for `SoundManager`. Game logic can therefore be
tested in Node with mocks. Tenkai's own specs (`spec/BufferedScene_spec.js` and the rest) show how.
