# Architecture

## The object tree

A Tenkai game is a tree of drawable objects with a `GameEngine` at the root:

```
GameEngine                      the canvas, time, input, modes, loading
├── Scene "background"  z: 0    containers, drawn in z order
│   └── Entity "island"         sprites inside a scene
├── Scene "world"       z: 1
│   ├── Scene "effects"         scenes can contain scenes
│   └── Entity "player"
│       └── Entity "flash"      entities can contain entities
└── Entity "cursor"             the engine can hold entities directly
```

- **GameEngine** maps the game into the page. It replaces a placeholder element with a `<canvas>`, loads
  every image and sound you declared, runs the game in fixed steps, and draws it. It owns the keyboard
  (`input`), game-time timers and the current mode. You write your game as a subclass of it.
- **Scenes** group things that are drawn together and moved together, such as a background, a playfield
  or a HUD. Every scene can hold child scenes and entities, and can paint under and over them with
  `background` and `foreground`. The subclasses draw something of their own: an image
  (`BackgroundScene`), a tile map (`TiledScene`), or composed buffers (`BufferedScene`).
- **Sheets** describe images: a grid of tiles, an anchor, named animation clips, and for tilesets, what
  each tile is. A sheet is data shared by every entity and map that uses it.
- **Entities** are the sprites. An entity shows one tile of a sheet at the position of its anchor, plays
  the sheet's clips, and can hold child entities that move, scale and rotate with it. `Video` is an entity
  that draws movie frames instead.
- **Assets** and **Audio** are the resources. The engine loads them at start-up and you look them up by
  name. `AssetCache` and `SoundManager` load on demand instead, for games with too many files to list up
  front.

Children are stored by name. `addScene(name, scene)` and `addEntity(name, entity)` set the child's `name`
and `parent`, and return the child. Adding a child that already has a parent moves it, rather than
leaving it in two places. A scene or entity finds its game through its parents, as `scene.game`.

## Mixins

Containers share their behaviour through mixins, not a common base class:

| Mixin | Gives | Used by |
|-------|-------|---------|
| `HasEventsMixin` | `defineEvents`, `on`, `unon`, `trigger` | `GameEngine` |
| `HasScenesMixin` | `addScene`, `removeScene`, `getScene`, `drawScenes`, `animateScenes` | `GameEngine`, `Scene` |
| `HasEntitiesMixin` | `addEntity`, `removeEntity`, `getEntity`, `drawEntities`, `animateEntities` | `GameEngine`, `Scene`, `Entity` |

A mixin is applied in the constructor, for example `HasEntitiesMixin(this)`. This copies its methods onto
the instance, bound to it, and runs its `init`. See [Mixin](api/Mixin.md).

## Starting up

`game.start(callback)` runs these steps in order:

1. It loads every asset declared with `addAsset(name, src)` and every sound declared with
   `addAudio(name, src, type)`, in parallel.
2. `bootElement()` replaces the element with id `targetId` with a `<canvas class="gamescreen">`. The canvas
   takes the element's `width` and `height` attributes, or fills the window when `fullscreen` is set. It
   then attaches the mouse and wheel listeners.
3. It calls `init()`. Override this to build your scenes and entities. It can simply return, be `async`,
   or take a callback to call when done.
4. It sets `running`, triggers the `running` event, calls the `start()` callback, and begins running.

Declare assets in your constructor, so they are ready by the time `init` runs and `getAsset(name)` works
there.

## Time

The game runs in fixed **steps**, 60 per second by default (`stepRate`), whatever the display's frame
rate. On each animation frame the engine runs as many steps as the elapsed time holds, catching up at most
a quarter of a second so a stalled or background tab does not fast-forward the game, then draws once.

Each step:

1. **Input.** `game.input` takes the key changes since the last step, so `pressed` and `released` mean
   "in this step".
2. **Update.** `game.time` advances, and `update(dt)` runs game logic, including the current mode's.
3. **Timers.** Timers set with `after(seconds, fn)` and `every(seconds, fn)` that have come due run.
4. **Animation.** Every entity in every scene advances its clip by one step, scaled by its scene's
   `timeScale`.

Logic, timers and animation therefore advance together. They stay in step at any frame rate, pause
together when the game is not running, and can be driven step by step in tests with `game.step()`.

Some things follow other clocks:

- `Video` follows the movie's own playback time.
- `SoundManager` follows the audio hardware.
- `BufferedScene` transitions run on the wall clock and finish on a timer, so code that awaits them does
  not hang when nothing is being drawn.

## Modes

Most games have states: a title screen, play, a pause, game over, an editor. A **mode** is an object for
one of them. `game.setMode(mode)` switches, calling the old mode's `exit()` and the new one's `enter()`;
each step the engine calls `mode.update(dt)`, and each frame `mode.draw(context)` after everything else.
Anything a mode needs beyond that, such as a `click` method, is the game's own.

Golden Axe's screens (title, character select, play, map, game over), 1945's title, play and game-over
states, and Tim the Enchanter's play and edit modes are all modes.

## Input

`game.input` is the keyboard, sampled once per step. Keys are bound to named actions with the engine's
`keys` option, such as `{ jump: ['KeyX', 'KeyS'] }`. Game code asks `down('jump')`, `pressed('jump')`,
`released('jump')`, `doubleTapped('right')`, `latest('up', 'down', 'left', 'right')` or
`axis('left', 'right')`. See [Input](api/Input.md).

The mouse arrives as events. `mousedown`, `mouseup` and `mousemove` are triggered on the engine, with
`game.mouseX` and `game.mouseY` already in game coordinates. [Hotspots](api/Hotspots.md) turn the mouse
into clickable and draggable regions.

## Drawing

Each frame the engine clears the canvas to black, applies the viewport (`scale`, then `translate(x, y)`,
then `globalAlpha`), and draws its scenes in z order, its own entities, the current mode, and the debug
HUD if `showHUD` is set. Everything is redrawn every frame; to show a change, set a property such as `x`,
`tile` or `visible`.

### Transforms

Every container draws inside `context.save()` and `context.restore()`, and applies its own transform
before drawing its children:

```
Scene:   translate(x, y)              -> scale -> rotate           -> background, content, foreground
Entity:  translate(x, y - elevation)  -> scale -> rotate -> flip   -> its tile at -anchor, then children
```

A child's `x` and `y` are relative to its parent, and a parent's scale and rotation apply to all of its
children. An entity's position is its **anchor**: rotation, scaling and flipping happen about it, and
children are positioned from it. A ship anchored at its centre turns about its middle; a character
anchored at its feet stands on its position and flips in place. `elevation` raises an entity on screen,
for jumping or standing on something, without moving where it stands.

### Order

Within a container:

- **Scenes** are drawn in ascending `z`.
- **Entities** are drawn in ascending `z`. In a container whose `perspectiveMode` is
  `PERSPECTIVE_DEPTH`, they are drawn in depth order instead: by where they stand (`y`), then by
  `elevation`, so things lower on the screen are in front.
- Scenes or entities that tie keep the order they were added in.

What a container draws, in order:

| Container | Order |
|-----------|-------|
| `GameEngine` | scenes, its own entities, the mode, the HUD |
| `Scene` | background, child scenes, entities, foreground |
| `BackgroundScene` | background, its image, child scenes, entities, foreground |
| `TiledScene`, overhead | background, layers and child scenes in one z order, entities, foreground |
| `TiledScene`, depth | background, flat tiles, upright tiles and entities in depth order, child scenes, foreground |
| `BufferedScene` | background, its screen canvas, child scenes, entities, any transition, foreground |
| `Entity` | its tile, then child entities |

### Depth

A `TiledScene` in `PERSPECTIVE_DEPTH` sorts its tiles in with its entities. The sheet says which tiles are
flat (floor, rugs: always underneath) and which are upright (walls, furniture), how high each is, and
which row each one's object stands in. Characters then pass behind a chair, stand on its seat under its
back, and walk in front of it, with no special code. See [TiledScene](api/TiledScene.md).

## Coordinates

- The canvas is the size of the target element's `width` and `height` attributes, or the window in
  fullscreen mode. CSS may scale it on the page; Tenkai allows for that when mapping the mouse.
- `game.width` and `game.height` are the visible area in game pixels: the canvas size divided by
  `scale`.
- The viewport offset `game.x` and `game.y` is added to everything, so a positive `x` moves the world to
  the right. With `enableScroll` and `enableZoom` (both on by default), the mouse wheel changes `x` and `y`,
  and shift with the wheel changes `scale`. Most games turn both off.
- `game.mouseX` and `game.mouseY` are the last mouse position in game coordinates.

## Events

`GameEngine` defines five events: `running`, `mousedown`, `mouseup`, `mousemove` and `resize`. Handlers
are added with `on(event, fn)` and removed with `unon(event, fn)`. They run just after the DOM event has
finished, so read `engine.mouseX` and `engine.mouseY` rather than the DOM event's coordinates.

## Point-and-click support

Six classes support games built from pre-rendered views, such as Myst. Each can be used alone.

- `BufferedScene` keeps a back buffer and a screen. You compose the next view in the back buffer, copy all
  or part of it to the screen, and animate between a snapshot of the old screen and the new one.
- `Video` entities play movies over the screen.
- `Hotspots` maps the mouse to regions with cursors and click or drag handlers.
- `Cursor` draws image cursors on the canvas.
- `SoundManager` handles background loops, effects and music.
- `AssetCache` loads view images as they are needed.

[Point-and-click adventures](point-and-click.md) shows them working together.

## Repository layout

```
index.js            exports every public class
lib/                the engine, one class per file
lib/jsdoc/          JSDoc type definitions (Rectangle, Tile, Frame) for the API comments
spec/               Jasmine specs, one per class, with a fake DOM in spec/helpers and mocks in spec/mocks
examples/           runnable example games, bundled with esbuild
docs/               these pages
TODO/               the modernisation plan
```

The code is CommonJS in JavaScript Standard style. Bundle a game for the browser with any CommonJS-aware
bundler; the examples use esbuild. Run the specs with `node node_modules/jasmine/bin/jasmine.js`, or
`npm test` for coverage.
