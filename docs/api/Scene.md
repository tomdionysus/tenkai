# Scene

`lib/Scene.js`. Uses [HasScenesMixin](HasScenesMixin.md) and [HasEntitiesMixin](HasEntitiesMixin.md).

A container for child scenes and entities, drawn together: a layer of a game, such as a background, a
playfield or a HUD. To draw something of its own, a scene paints under its children in `background` and
over them in `foreground`, given as options or overridden in a subclass.

```js
game.addScene('board', new Scene({
  z: 1,
  background: (context) => {
    context.fillStyle = '#1c2340'
    context.fillRect(0, 0, 640, 480)
  },
  foreground: (context) => context.fillText('SCORE ' + game.score, 16, 40)
}))
```

## Constructor options

| Option | Default | Meaning |
|--------|---------|---------|
| `x`, `y` | `0` | Position relative to the parent. |
| `z` | `0` | Drawing order among the parent's scenes; higher is drawn later, on top. |
| `scale` | `1` | Scale for this scene and everything in it. |
| `rotate` | `0` | Rotation in radians for this scene and everything in it. |
| `visible` | `true` | Invisible scenes and their children are not drawn. |
| `perspectiveMode` | `Scene.PERSPECTIVE_OVERHEAD` | How entities are ordered (see below). |
| `timeScale` | `1` | Speed of animation for everything in the scene; 0 pauses it. |
| `background` | none | `(context) => {}`, drawn under the children. |
| `foreground` | none | `(context) => {}`, drawn over the children. |
| `clip` | none | A polygon, `[[x, y], ...]` in the scene's coordinates: nothing of the scene is drawn outside it. For a view inside a shaped frame, as many games framed their play area. |

`z` is read when the parent sorts its scenes, which happens when a scene is added or removed. If you change
`z` afterwards, call `parent.sortScenesZ()`.

## Properties

| Property | Meaning |
|----------|---------|
| `game` | The [GameEngine](GameEngine.md) this scene belongs to, found through its parents. |

## Methods

### `draw(context)`

Applies the scene's transform (translate, scale, rotate), then draws `background`, the content, and
`foreground`, all in the scene's own coordinates.

### `background(context)` / `foreground(context)`

Override these, or pass them as options, to paint under and over the scene's children.

### `visibleBounds(context)`

The part of the scene that can be seen, in its own coordinates, as `[left, top, right, bottom]`, worked out
from the context's current transform and its canvas. Call it while drawing, with the scene's transform
applied, to skip what is off screen (as [TiledScene](TiledScene.md) does). Null when the context cannot tell,
in which case draw everything.

### `drawContent(context)`

The content between background and foreground: child scenes in z order, then entities. Subclasses
replace it to draw something of their own, such as a tile map, and call `super.drawContent(context)` for
the children.

### `applyTransform(context)`

Applies the scene's position, scale and rotation.

### `animate(ms)`

Advances the animations of every child scene and entity by `ms` milliseconds of game time, scaled by
`timeScale`. The engine calls this every step.

### From the mixins

- `addScene`, `removeScene`, `getScene`, `drawScenes`, `getScenesAtLayer`, `sortScenesZ`, `animateScenes`.
- `addEntity`, `removeEntity`, `getEntity`, `sortedEntities`, `drawEntities`, `animateEntities`.

## Perspective

- `Scene.PERSPECTIVE_OVERHEAD` (1): entities are drawn in order of `z`.
- `Scene.PERSPECTIVE_DEPTH` (2): entities are drawn in depth order: by where they stand (their `y`, which
  is their anchor), then by `elevation`. Things nearer the bottom of the screen are in front. In a
  [TiledScene](TiledScene.md), upright tiles are sorted in with them.

## Pausing and slowing

`timeScale` affects only animation in the scene. Golden Axe sets its world scene's `timeScale` to 0 for a
few steps on every hit, so the fighters freeze in the pose of the blow while the rest of the game
carries on.

## Subclasses

- [BackgroundScene](BackgroundScene.md): one image.
- [TiledScene](TiledScene.md): a tile map, drawn flat or in depth.
- [BufferedScene](BufferedScene.md): composed buffers with transitions.
