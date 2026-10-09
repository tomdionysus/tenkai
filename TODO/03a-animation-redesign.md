# Phase 3a: Animation Redesign

Goal: entity animation that a real game uses instead of working around. Part
of Phase 3, and done together with its fixed-step loop.

## Outcome

Done, and both games ported, along with Tim the Enchanter. Where the build differs from the design below:

- **Clips live on a `Sheet`** (see [3b](03b-depth-sorted-tiles.md)), which also carries the grid and the
  anchor, rather than being free-standing objects. `play` takes a clip's name or a clip.
- **State is `clip`, `frame`, `animating` and `done`.** `animating` rather than `playing`, because `Video`
  already uses `playing` for the movie.
- **`play` also takes `loop`**, overriding the clip, which Golden Axe needs.
- **Delays are in milliseconds, not steps.** Steps were proposed so Golden Axe's "8 steps per frame" would
  be exact. Instead its clips have a delay of one step and it plays them at `speed: 1 / 8`, which is exact
  within a small tolerance, and every other game keeps thinking in milliseconds.
- **`Entity.animate(ms)` and `animateScenes`/`animateEntities` stay.** They are how the engine advances
  animation each step, and how an entity outside a scene is advanced by hand.
- **Verification.** 1945's explosions, surfacing and diving were traced frame by frame and match the old
  build exactly. Golden Axe's scripted run matched for its first 245 steps, which cover the intro, the
  cutscene and idle animation. Beyond that the baseline was invalid: it ran the old game code on the new
  engine, which took each step's key presses twice. Hit-stops were then checked directly: in every step
  inside one, every fighter keeps its frame and position.

## Why

The animation system (`addAnimation`, `animateStart`, `animateStop`) was
designed for exactly what the Golden Axe demo in `local/` needs, yet Golden Axe
runs its own animation in its `Sprite` class and only uses `Entity` to draw a
tile. 1945 does use the built-in, but works around it. The gaps:

1. **The game cannot own the clock.** Golden Axe runs its logic in fixed 60 Hz
   steps and freezes the battlefield for a few steps on every hit
   (`stage.hitStop`). Its frames are counted in steps (`play('walk', 8)`
   means 8 steps per frame). Built-in animations advance on the engine's
   display `dt`. During a hit-stop everyone would keep walking, and at display
   rates other than 60 Hz sprites drift against attack timing. Nothing can
   pause, scale or drive one scene's animations.
2. **No control from game logic.** Attacks hold frame 0 through the wind-up,
   then the last frame through the active and recovery steps. Jumps choose
   the frame from vertical speed. Golden Axe does this with `setFrame(n)` and
   speed 0 meaning hold. The built-in cannot show frame N or hold, and setting
   `tile` by hand fights a running animation.
3. **No state to query.** Golden Axe polls `done` ("collapse finished, now lie
   down") and asks whether `walk` is already playing, so it does not restart
   it every step. The built-in only offers `onStop`. Its state is private
   (`_currentanimation`), and `animateStart` always restarts from frame 0.
4. **Definitions are per entity.** `addAnimation` stores frame lists on each
   entity. Games define an animation once per sprite sheet and share it; 1945
   re-adds an animation called `'current'` before every play.
5. **It carries what nobody uses.** `dx`/`dy` movement and the
   `minX`/`maxX`/`minY`/`maxY` stop boundaries put movement into the
   animation system. Both games move entities in their own logic, where
   movement belongs.

## Design

### Clips

A clip is plain data, defined once and shared by any number of entities:

```js
const WALK = { frames: [[0, 1], [1, 1], [2, 1], [3, 1]], delay: 8, loop: true }
const DIE = { frames: [[0, 4], [1, 4], [2, 4, 30]], delay: 6 }   // a frame may give its own delay
```

- `frames`: `[tileX, tileY]`, or `[tileX, tileY, delay]` to override.
- `delay`: how long each frame is shown, in fixed steps (see below).
- `loop`: `true` to loop forever.

### Entity API

- [x] `play(clip, { restart, speed, onComplete })`
  - Does nothing if `clip` is already playing, unless `restart` is set.
  - `speed` scales the delays: 2 is twice as fast, and 0 holds the current
    frame.
  - `onComplete(entity)` is called in the game step in which a non-looping
    clip finishes.
- [x] `setFrame(n)`: show frame `n` of the current clip. Combine it with
  `speed: 0` for frames chosen by game logic.
- [x] `stop()`: stop animating, leaving the current tile.
- [x] Public, read-only state: `animation` (the clip or `null`), `frame`,
  `playing`, `done`.
- [x] Keep the frame rule: every frame, the last included, is shown for its
  delay before the clip moves on, loops or completes. A frame with delay 0 is
  shown for one step.

### Time

- [x] Fixed-step loop in `GameEngine` (from [Phase 3](03-engine-core.md)): an
  accumulator runs `update()` at a fixed rate (default 60 Hz, option
  `stepRate`), at most a few steps per display frame, then draws once.
  Golden Axe's hand-written accumulator moves into the engine.
- [x] Animations advance once per step, after `update()`, through the scene
  tree, so they stay in lock-step with game logic.
- [x] `Scene.timeScale` (default 1): scales the animation of everything in the
  scene; 0 pauses it. A hit-stop is `world.timeScale = 0` for a few steps.
- [x] Delays are in steps. Provide `GameEngine.seconds(s)` (or similar) for
  games that think in time rather than steps.

### Removed

- [x] `addAnimation`, `animateStart`, `animateStop`, the `STOPSTATUS_*`
  constants, and `onStop(err, entity, status)`.
- [x] `dx`/`dy` per-frame movement and the `minX`/`maxX`/`minY`/`maxY`
  boundaries.
- [x] `Entity.animate(ms)` and the `animateScenes`/`animateEntities` mixin
  methods, replaced by the per-step advance.

Breaking change. Nothing outside the examples uses Tenkai.

## Porting

- [x] Golden Axe (`local/golden-axe`): `Sprite` keeps the atlas-to-clip
  mapping and `place()`; its animation stepping goes. Hit-stop becomes
  `world.timeScale = 0`, and its accumulator is removed in favour of the
  engine's fixed step.
- [x] 1945: `Actor.play` becomes a direct `play` call. Its game-time timers
  can count steps.
- [x] Verify both frame by frame against their current behaviour, on a
  simulated clock, as was done for the frame-rule change.

## Open questions

- Should the fixed-step loop land in the same change? Recommended: yes.
  Without it, Golden Axe keeps its own accumulator and animations cannot
  follow its steps exactly.
- Drop `dx`/`dy` and the boundaries outright, or keep them as an optional
  add-on? Recommended: drop them.

## Done when

- Golden Axe and 1945 animate only through `Entity.play`, with identical
  frame-by-frame output to before.
- Docs (`docs/api/Entity.md`, `docs/architecture.md`) describe clips, the
  fixed step and `timeScale`.
