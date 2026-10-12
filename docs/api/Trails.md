# Trails

`lib/Trails.js`

Where things were at the last two ticks, by key, to draw them between ticks. A game whose logic moves in steps (its
own fixed step, or a server's ticks, see [GameClient](GameClient.md)) draws each thing part of the way from where
it was at the tick before to where it is now, so it moves smoothly at any frame rate, one tick behind the logic.

```js
const trails = new Trails()
// after each tick: every thing's position now
trails.tick(characters.map((c) => [c.id, c.body]))
// each frame, a the fraction of the way to the next tick (0 to 1)
entity.world = trails.between(c.id, c.body, a)
```

A thing seen for the first time is drawn where it is; a thing not given at a tick is forgotten. Positions are
copied, so a body moved later does not move its trail.

| Method | |
|---|---|
| `tick(pairs)` | a tick has run: `[key, { x, y, z }]` pairs, every thing's position now (`z` defaults to 0) |
| `between(key, p, a)` | the thing's position `a` of the way from where it was at the tick before to `p`, where it is now |
| `from(key, p)` | where it was at the tick before, or `p` if it is not known |
| `clear()` | forget everything: the next frames draw things where they are (a new level, a jump) |
