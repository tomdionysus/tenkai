# Phase 3: Engine Core

Goal: the minimum a small 2D game needs that Tenkai does not have today. Keep
each item small; the aim is a readable engine, not a feature-complete one.

## Game loop

- [x] Fixed-timestep loop with an accumulator: `update(dt)` at a fixed rate
      (e.g. 60Hz), `draw(alpha)` once per animation frame. Phase 0 added a
      variable-dt `update(dt)` hook; make it fixed-step.
- [x] Drive `Entity` animations from game time, not from per-entity
      `setTimeout` chains. The engine calls `animate(ms)` through the tree
      after `update(dt)`, so animations pause with the game and are testable
      without a clock.
- [ ] Pause on `visibilitychange` and clamp `dt` after a long stall, so a
      backgrounded tab does not fast-forward the world on return.
- [ ] `engine.pause()` / `resume()`. (`Scene.timeScale` now scales or pauses a
      scene's animation; see [3a](03a-animation-redesign.md).)

## Rendering

- [x] Resolve the redraw model. Every frame `_tick` clears the canvas and
      calls `redraw()` on everything, so the `_doredraw` dirty flags only add
      complexity. Remove them and commit to immediate-mode drawing.
- [ ] HiDPI: size the canvas backing store by `devicePixelRatio` and scale the
      context, so games are not blurry on retina and phone screens.
- [ ] Pixel-art option: `imageSmoothingEnabled = false` (done: `pixelated`) and integer-snapped
      camera positions.
- [ ] Viewport culling in `TiledScene._drawLayer`: only draw tiles that
      intersect the visible rectangle. Currently every tile of every layer is
      drawn every frame.
- [ ] Optionally pre-render static tile layers to an `OffscreenCanvas` and
      blit that, redrawing only when the layer changes.
- [ ] Use `ResizeObserver` on the canvas container instead of a debounced
      window `resize` listener; support fixed-aspect letterboxing as well as
      fullscreen.
- [ ] Stop sorting entities on every frame unless something moved
      (`drawEntities` currently sorts `Object.values(...)` each call).

## Camera

- [ ] Pull viewport x/y/scale out of `GameEngine` into a `Camera` with
      `follow(entity)`, bounds, and screen-to-world / world-to-screen helpers.
- [ ] Make built-in wheel pan and zoom opt-in (it is on by default today, which
      is a debugging convenience rather than a game default).

## Input

- [x] Keyboard state: `input.isDown('ArrowLeft')`, `wasPressed`, `wasReleased`,
      keyed by `KeyboardEvent.code`, sampled once per `update`. Today there is
      only `document.onkeyup` assigned to `processKey`, which overwrites any
      other handler on the page.
- [ ] Pointer Events (`pointerdown` / `pointermove` / `pointerup`) instead of
      mouse events, so touch and pen work.
- [ ] `wheel` event with `{ passive: false }` instead of the removed
      `mousewheel` and `DOMMouseScroll`.
- [ ] Gamepad API polling in `update`.
- [ ] Hit-testing: which entity is under the pointer, in world coordinates.
      (`Hotspots` covers regions of the screen.)

## Point-and-click

Added for the Myst demo in `local/myst`, which uses them all, and kept general
enough for any slideshow-style adventure.

- [x] `BufferedScene`: back buffer and screen canvases, partial copies, and
      dissolve and wipe transitions that resolve on time even when nothing is
      drawing.
- [x] `Video`: an `Entity` that plays a movie, or a range of it, looped or
      backwards.
- [x] `Hotspots`: rectangle, circle or custom regions with cursors and click,
      press, drag and release handlers. Partly covers hit-testing (above).
- [x] `SoundManager`: Web Audio background loop with cross-fade, and effects,
      optionally on a single channel. Phase 2's Web Audio move for `Audio`
      should build on it.
- [x] `AssetCache`: images loaded by path on demand.
- [x] `Cursor`: image cursors drawn on the canvas.

## Collision

- [ ] AABB overlap helpers (`Util.intersects` already exists; make it part of a
      small `Rect` type).
- [ ] Tile-map collision: query solid tiles in a rectangle on a `TiledScene`.
      (`TiledScene.isSolid(x, y)` answers for one cell; see [3b](03b-depth-sorted-tiles.md).)
- [ ] No physics engine. Document how to bring your own if needed.

## Tile maps

- [ ] Import from the Tiled editor JSON format. `TiledScene`'s name invites
      this, and it is the most common way people author tile maps.

## Done when

- The example game (Phase 4) can be written without reaching into `_private`
  engine state or adding its own timers.
