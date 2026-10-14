# Camera

`lib/Camera.js`

The scroll of a flat scene that follows a target: a side-scroller's view that keeps the player a lead ahead of
its left edge, moves at most so far a step, scrolls forward only (as the arcade's belt-scrollers did) or both
ways, stops at a limit (where an event holds it) and at the stage's end, and eases the other axis after the
target on a stage taller than the view. It is numbers only: give a scene `-camera.x` and `-camera.y` each step,
or an [IsometricScene](IsometricScene.md) its `camera`.

```js
import { Camera } from 'tenkai'

const camera = new Camera({ width: 1536, height: 224, viewWidth: 320, viewHeight: 224, lead: 150, speed: 2, forwardOnly: true })
// each step:
camera.follow(player, waves.limitX)
world.x = -Math.round(camera.x)
if (camera.offscreen(enemy.x, 30)) enemy.remove()
```

| Member | |
|---|---|
| `new Camera({ width, height, viewWidth, viewHeight, lead, leadY, speed, forwardOnly, ease })` | the stage's size and the view's; how far ahead of the left edge and below the top the target is kept (default centred); how far across a step at most (default any); forward only (default false); the fraction of the way down or up each step (default 1) |
| `follow(target, limitX)` | one step after `{ x, y }`, no further across than `limitX` |
| `snap(x, y)` | put there at once |
| `offscreen(x, margin)` | whether x is beyond the view's edges by more than `margin` (negative: inside them by that much) |
| `x`, `y`, `maxX`, `maxY` | the scroll, and how far it can go |
