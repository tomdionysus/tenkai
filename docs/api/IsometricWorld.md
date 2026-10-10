# IsometricWorld

`lib/IsometricWorld.js`

The game's model of a 3D space, kept apart from how it is drawn: where things can stand and move, what is in
the way, and which part of the world a point is in. Game logic, movement and AI use the world; an
[IsometricScene](IsometricScene.md) shows it. Positions are world coordinates (x, y, and z for height), as an
[IsometricProjection](IsometricProjection.md) uses.

It holds three kinds of thing:

- **Regions**: named boxes such as rooms, corridors or decks. A point is in the first region whose box
  contains it. Regions also scope colliders, so a large world stays fast.
- **Colliders**: boxes with a `type`, such as walls, doors, lifts and consoles. A move into one is decided by
  the handler for its type; without a handler it blocks.
- **Bodies**: things that move, each with a size, that block one another.

Boxes include their low edges and exclude their high ones (x from `x0` up to but not including `x1`). A box
without `z0` and `z1` spans every height.

This is how Wreckers (Amiga, 1991) models its station: each deck is a set of rooms and corridors, each with a
list of typed rectangles for walls, doorways, consoles and lifts, independent of the pre-drawn art.

```js
const world = new IsometricWorld()
world.addRegion({ name: 'bridge', x0: 0, x1: 200, y0: 0, y1: 120, z0: 0, z1: 100 })
world.addCollider({ region: 'bridge', x0: 0, x1: 200, y0: 0, y1: 8, type: 'wall' })
world.addCollider({ region: 'bridge', x0: 90, x1: 110, y0: 110, y1: 120, type: 'door', open: false })
world.on('door', (body, door) => door.open)

const officer = world.addBody({ x: 100, y: 60, z: 0, size: [8, 8, 32] })
const result = world.move(officer, 0, -4)    // { moved, collider, blocker, region }
```

## Regions

### addRegion(region) / regionAt(x, y, z)

Add `{ name, x0, x1, y0, y1, z0, z1, ... }` (anything else is kept for the game), and find the region
containing a point. Without `z`, height is ignored. `regions` lists them.

## Colliders

### addCollider(collider)

Add `{ x0, x1, y0, y1, z0, z1, type, region, ... }`. `region` is the name of the region it belongs to: only
moves into that region meet it. Leave it out for colliders that apply everywhere. `colliders` lists them all.

### collidersAt(x, y, z, region)

The colliders containing a point: those of the point's region (or of `region`, given as a region or its
name), then those in no region, each in the order added.

### collidersIn(region, withUnscoped)

The colliders belonging to a region (a region or its name), in the order added; with `withUnscoped` true,
followed by those in no region. For tests other than a point, such as a projectile's path.

### on(type, fn)

Decide what a move into a collider of `type` does: `fn(body, collider, world, to)` returns true to allow the
move and false to stop it. It may also change things: open a door, move the body elsewhere by changing `to`
(the destination, `{ x, y, z }`), start a lift.

## Bodies

### addBody(body) / removeBody(body)

Add `{ x, y, z, size: [sx, sy, sz], solid, ... }`. The box is centred on x and y and stands on z; `solid`
(default true) bodies block one another. `bodies` lists them.

### bodiesAt(body, x, y, z)

The solid bodies other than `body` whose boxes would overlap its box at a position.

### move(body, dx, dy, dz)

Move a body if it may go: the colliders at the destination are asked in turn through their types' handlers,
then other bodies. Returns `{ moved, collider, blocker, region }`: when stopped, the collider or body that
stopped it; `region` is where the body is afterwards.

## Static methods

### IsometricWorld.contains(box, x, y, z)

Whether a box contains a point, by the rules above.
