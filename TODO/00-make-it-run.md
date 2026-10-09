# Phase 0: Make It Run

Goal: on the existing stack, the engine boots in a real browser and the test
suite is green. No refactoring yet; this is the baseline to compare against.

## Working tree

- [x] Revert the 644 -> 755 mode changes on ~100 files
      (`git diff -p -R --no-ext-diff --no-color | git apply` for modes only, or
      `git config core.fileMode false`).
- [x] Delete `spec/jsdoc/` (broken stubs; `lib/jsdoc/*` are typedef-only files
      with nothing to test).
- [ ] Commit the pending `lib/` doc fixes and `HasEntitiesMixin.drawEntities`
      refactor separately from the `package-lock.json` churn.

## Bugs that stop it running

- [x] `GameEngine._bindMouseWheel`: `var ael = this.element.addEventListener`
      is called unbound, which throws "Illegal invocation" in browsers. Call
      `this.element.addEventListener(...)` directly and drop the `attachEvent`
      fallback.
- [x] `Asset.load`: no `onerror` handler, so a 404 image hangs `start()`
      forever. The `onload` callback also passes a nonsense error value
      (`err.returnValue ? null : err.returnValue`). Call `callback(null, this)`
      on load and `callback(new Error(...))` on error.
- [x] `Asset` constructor ignores `options.name`, but docs and examples read
      `asset.name`.
- [x] Same `onerror` / callback audit for `Audio.load`.

## Tests

- [x] Fix or rewrite the 7 failing specs (Entity `_tick` x3, HasEntitiesMixin
      `drawEntities` x2, TiledScene `draw` / `_drawLayer`). Confirm whether each
      is a stale test or a real regression from the June 2020 perspective
      refactor before changing it.
- [x] Add a regression test that binds `GameEngine` events to a real
      `EventTarget`, so the unbound `addEventListener` bug cannot come back
      silently. A full `start()` against a real DOM is left for Vitest browser
      mode in Phase 1.
- [x] `bin/stub.js`: either fix it (handle subdirectories, correct relative
      require path, valid identifier names) or delete it. It is what generated
      the broken `spec/jsdoc/` files.

## Smaller correctness fixes

- [x] `HasEventsMixin.trigger` captured its loop variable, so with several
      listeners only the last one ran (once per listener).
- [x] Base `Scene.draw` never drew its child scenes or entities.
- [x] `addScene` / `removeScene` did not reset the cached draw order, so scenes
      added after the first frame were never drawn.
- [x] Re-adding an entity or scene to the same container deleted it.
- [x] Entity draw order used an inconsistent comparator and drew nothing when
      `perspectiveMode` was unset; now a stable sort, z order by default.
- [x] Replace Node-only `setImmediate` with `setTimeout(fn, 0)` so the engine
      runs in a browser without a shim.
- [x] `_enforceScrollLimits` uses truthiness, so a limit of `0` is ignored.
      Use `!== undefined`.
- [ ] `_enforceScrollLimits` scale maths: min limits multiply by scale, max
      limits divide, which looks inconsistent. Moves to the `Camera` work in
      Phase 3.
- [ ] `HasEntitiesMixin.PERSPECTIVE_*` constants are not reachable from outside
      because the module exports the mixin wrapper function. Use the ones on
      `Scene` everywhere and remove the duplicates.
- [x] README: fix `docs/howotos` link; remove Travis badge.
- [ ] Reconcile version: repo says 0.2.0, npm has 0.1.2.

## Added along the way (needed by the example)

- [x] `GameEngine.update(dt)` hook, called every frame before drawing.
      Variable timestep for now; Phase 3 makes it fixed-step.
- [x] `Entity` `tileOffsetX`, `tileOffsetY`, `tileSpacing` for sprite sheets
      with borders between tiles.
- [x] `examples/1945` and `npm run example:1945` (esbuild dev server).
- [x] `examples/arkanoid`.
- [x] `Entity.flipX` for sprites drawn facing one way.
- [x] Mouse coordinates relative to the canvas, allowing for CSS scaling; mousedown and mouseup set
      them too.
- [x] `Audio.load()` asks for the whole file (`preload = 'auto'`) and `Audio.play()` ignores the
      expected AbortError when playback is interrupted.

## Done when

- A blank page with one `TiledScene` and one animated `Entity` runs in Chrome,
  Firefox and Safari with no console errors. (Chrome verified with the 1945
  example; Firefox and Safari not yet checked.)
- `npm test` is green.
