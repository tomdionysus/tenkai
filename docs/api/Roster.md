# Roster

`lib/Roster.js`

Keeps one [Entity](Entity.md) in a scene for each thing of a collection that changes: the units of a game's state,
the players in a room. Each `update` makes an entity for each new thing, shows every thing on its entity, and takes
off the entities of things that are gone. The entity can be the game's own subclass of Entity that knows how to show
its thing.

```js
const units = new Roster({ scene: things, name: 'unit', make: (id, unit) => new UnitEntity(unit) })
// each frame:
units.update(Object.entries(state.units), (entity, unit) => entity.show(unit))
```

| Member | |
|---|---|
| `new Roster({ scene, make, name })` | `make(id, thing)` returns a new entity; entities are named `name + id` |
| `update(pairs, each)` | `[id, thing]` pairs, every thing to show; `each(entity, thing, id)` shows one |
| `get(id)`, `size`, `clear()` | |
