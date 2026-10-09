# Phase 2: API Modernisation

Goal: a clean, typed, dependency-free public API. This is the breaking-change
phase; everything here lands together as 1.0.

## Async

- [ ] Replace callback APIs with Promises: `start()`, `init()`, `Asset.load()`,
      `Audio.load()` all return Promises. `init` becomes `async init()` that
      users override.
- [ ] Remove the `async` library; `Promise.all` covers the parallel asset and
      audio loading.
- [ ] Support cancellation with `AbortSignal` on loaders (useful for scene
      changes mid-load).

## Dependencies

- [ ] Remove `moment` and `uuid` (unused). If an id is ever needed,
      `crypto.randomUUID()` is available everywhere.
- [ ] Remove `sprintf-js` from `Logger`. Either use template literals or pass
      format args straight through to `console.*`, which already supports
      `%s`, `%d`, `%o`.
- [ ] Consider dropping `Logger` entirely in favour of a `debug` flag and
      `console`. The engine currently calls `console.debug` directly anyway.

## Structure

- [ ] Replace the custom `Mixin` system. It copies bound methods onto every
      instance, breaks `instanceof`, hides methods from type-checking, and
      makes static constants unreachable. Options:
  - A `Container` base class holding child scenes and entities, extended by
    `GameEngine`, `Scene` and `Entity`. Simplest, and matches how the code is
    actually used.
  - Composition: `this.children = new Children(this)`.
- [ ] Events: replace `HasEventsMixin` with native `EventTarget` (extend it, or
      own one) and `CustomEvent`. Drops another custom subsystem and makes
      `addEventListener` work the way users expect. Replace `setImmediate`
      (Node-only, needs a shim) with `queueMicrotask` where deferral is still
      needed.
- [ ] Throw `Error` subclasses instead of strings (`'Asset not found: ' + name`).
- [ ] Use `#private` fields for what is currently `_underscore` state.
- [ ] Replace `for...in` over arrays with `for...of`.
- [ ] Unify the `x/y/z/scale/rotate/visible` properties duplicated across
      `GameEngine`, `Scene` and `Entity` into the common base.

## Assets

- [ ] Load images with `fetch` + `createImageBitmap` (or `img.decode()`), so
      decoding happens off the main thread and errors surface as rejected
      Promises.
- [ ] An asset manifest: `engine.assets.add({ tiles: 'tiles.png', ... })`
      returning typed handles, instead of string lookups that throw at runtime.
- [ ] Optional load-progress event for a loading screen.

## Audio

- [ ] Move from `<audio>` elements to the Web Audio API (`AudioContext`,
      `decodeAudioData`, `AudioBufferSourceNode`). The current `playRange`
      relies on `timeupdate`, which fires only every ~250ms, so range ends and
      loops are audibly imprecise and overlapping sound effects are not
      possible.
- [ ] Handle the autoplay policy: resume the `AudioContext` on the first user
      gesture, and expose that state so games can show "click to start".
- [ ] Simple buses: master, music and sfx gain nodes.

## Done when

- `package.json` has no `dependencies`.
- Public API is fully typed with no `any` leaking from the mixin layer.
- Existing behaviour is covered by the migrated tests.
