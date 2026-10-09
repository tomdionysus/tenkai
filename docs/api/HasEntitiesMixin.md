# HasEntitiesMixin

`lib/HasEntitiesMixin.js`. See [Mixin](Mixin.md).

A named collection of [Entities](Entity.md), drawn in z order. [GameEngine](GameEngine.md), every
[Scene](Scene.md) and every `Entity` have it.

## Methods

### `addEntity(name, entity)`

Adds an entity under `name`, sets its `name` and `parent`, and returns it. If the entity already belongs
to another container, it is removed from there first. An entity already stored under the same name is
replaced, so use a unique name for each one; a counter works well.

### `removeEntity(name)`

Removes the named entity.

### `getEntity(name)`

Returns the named entity. Throws `'Entity not found: <name>'` if there is none.

### `sortedEntities()`

The entities in drawing order:

- Normally, by ascending `z`.
- If the container's `perspectiveMode` is `PERSPECTIVE_DEPTH`, by where they stand (`y`), then by
  `elevation`. Entities lower on the screen are drawn in front.

Entities that tie keep the order they were added in. The list is sorted on every call.

### `drawEntities(context)`

Draws the entities in that order.

### `animateEntities(ms)`

Advances every entity's animation by `ms` milliseconds of game time.
