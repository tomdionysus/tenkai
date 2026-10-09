# Entity

`lib/Entity.js`. Uses [HasEntitiesMixin](HasEntitiesMixin.md).

A sprite: one tile of a [Sheet](Sheet.md), drawn at a position, which can play the sheet's animation clips
and hold child entities that move, scale and rotate with it.

An entity's position is where its **anchor** is: a point within the tile, such as a character's feet or the
middle of a ship, taken from the sheet unless the entity has its own. Rotation, scaling and flipping happen
about the anchor, and children are positioned relative to it.

```js
const cat = new Sheet({
  image: game.getAsset('cat'),
  tileWidth: 64,
  tileHeight: 64,
  anchor: [32, 64],                                     // the bottom middle: where the cat stands
  clips: { walk: { row: 2, columns: [0, 1, 2, 1], delay: 100, loop: true } }
})

const gallagher = scene.addEntity('gallagher', new Entity({ sheet: cat, x: 224, y: 320 }))
gallagher.play('walk')
gallagher.flipX = true   // face the other way
```

## Constructor options

| Option | Default | Meaning |
|--------|---------|---------|
| `sheet` | none | The [Sheet](Sheet.md) whose tiles the entity shows. |
| `image` | none | Instead of a sheet: a single image ([Asset](Asset.md), image or canvas) shown whole. |
| `tile` | `[0, 0]` with a sheet | The tile to show, `[column, row]`. `null` draws only the children. |
| `anchor` | the sheet's | `[x, y]` within the tile that the position refers to. |
| `x`, `y` | `0` | Where the anchor is, relative to the parent. |
| `z` | `0` | Drawing order among the parent's entities, in overhead mode. |
| `elevation` | `0` | Pixels above the ground. The entity is drawn this much higher, and in depth order it sorts above lower things standing on the same line. |
| `scale` | `1` | Scale about the anchor, for the entity and its children. |
| `rotate` | `0` | Rotation in radians about the anchor, for the entity and its children. |
| `flipX` | `false` | Mirror horizontally about the anchor, children included. |
| `visible` | `true` | Invisible entities and their children are not drawn. |

All of these are plain properties; change them at any time. Swapping `sheet` swaps the picture, as
Arkanoid does for a cracked brick.

## Properties

| Property | Meaning |
|----------|---------|
| `width`, `height` | The size of one tile. |
| `origin` | The anchor in use. |
| `game` | The [GameEngine](GameEngine.md) the entity belongs to, found through its parents. |
| `clip` | The clip playing or last played, or `null`. |
| `frame` | The index of the frame showing in that clip. |
| `animating` | Whether the clip is advancing. |
| `done` | Whether a clip that does not loop has finished. |

## Animation

### `play(clip, options)`

Plays one of the sheet's clips, by name, or a clip object.

| Option | Default | Meaning |
|--------|---------|---------|
| `restart` | `false` | Start again from the first frame even if this clip is already playing. |
| `speed` | `1` | Scales the frame delays: 2 is twice as fast. 0 holds the current frame. |
| `loop` | the clip's | Loop or not, overriding the clip. |
| `onComplete` | none | Called with the entity when a clip that does not loop has finished. |

Asking for the clip that is already playing only updates its options, so it is safe to call every step:
`player.play(moving ? 'walk' : 'idle')` keeps the walk cycle going rather than restarting it.

### `setFrame(n)`

Shows frame `n` of the current clip and starts its delay afresh. With `speed: 0`, game logic chooses
the frames: Golden Axe holds the first frame of an attack through its wind-up, then jumps to the last.

### `stop()`

Stops animating, keeping the current tile.

### How frames advance

- The first frame is shown at once.
- Every frame, the last included, is shown for its delay before the clip moves on, loops back to the
  first frame, or finishes.
- A frame with a delay of 0 is shown for a single game step, for a tile that should only flash up.
- When a clip that does not loop finishes, `done` becomes true, the last frame stays, and `onComplete` is
  called straight away, in the same game step, before anything is drawn.

Time comes from the game: the [GameEngine](GameEngine.md) advances every entity in its scenes by one
step's worth of time after each [update](GameEngine.md#updatedt), scaled by each scene's `timeScale`. So
animation stays in step with game logic, pauses with the game, and can be frozen for one scene, as
Golden Axe does for its hit-stop.

### `animate(ms)`

Advances the animation, and those of child entities, by `ms` milliseconds of game time. The engine does
this every step; call it yourself only for entities outside the engine's scenes, or in tests.

## Drawing

### `draw(context)`

Applies the entity's transform (see `applyTransform`), draws its tile with the anchor at the origin,
then draws its children.

### `applyTransform(context)`

Translates to the position (raised by `elevation`), then scales, rotates and flips. After it, `(0, 0)`
is the anchor. Subclasses that draw something other than a tile use it; [Video](Video.md) does.

## From the mixin

`addEntity`, `removeEntity`, `getEntity`, `drawEntities`, `animateEntities`: child entities, positioned
relative to this entity's anchor and drawn after its tile.

## Example: a one-shot explosion

```js
const boom = new Sheet({
  image: sprites,
  tileWidth: 64,
  tileHeight: 64,
  anchor: [32, 32],
  // Each tile for 70 ms, the last only flashing up for one step
  clips: { explode: { frames: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0, 0]], delay: 70 } }
})

scene.addEntity('boom', new Entity({ sheet: boom, x, y }))
  .play('explode', { onComplete: (e) => scene.removeEntity(e.name) })
```
