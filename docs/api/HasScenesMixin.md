# HasScenesMixin

`lib/HasScenesMixin.js`. See [Mixin](Mixin.md).

A named collection of [Scenes](Scene.md), drawn in z order. [GameEngine](GameEngine.md) and every `Scene`
have it.

## Methods

### `addScene(name, scene)`

Adds a scene under `name`, sets its `name` and `parent`, and returns it. If the scene already belongs to
another container, it is removed from there first. A scene already stored under the same name is
replaced.

### `removeScene(name)`

Removes the named scene.

### `getScene(name)`

Returns the named scene. Throws `'Scene not found: <name>'` if there is none.

### `drawScenes(context, z)`

Draws the scenes in ascending z order. With `z`, it draws only the scenes at that z; `TiledScene` uses
this to place scenes between its layers.

### `getScenesAtLayer(z)`

The scenes whose `z` equals `z`, as an array.

### `sortScenesZ()`

Rebuilds the draw order. This happens automatically when scenes are added or removed. Call it yourself
after changing a scene's `z`.

### `animateScenes(ms)`

Advances the animations in every scene by `ms` milliseconds of game time.

## Notes

Scenes with equal `z` are drawn in the order they were added.
