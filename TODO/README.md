# Tenkai 2026 Update Plan

Tenkai was last worked on seriously in mid-2020 (dependency bump in Sep 2022).
This folder holds the plan to bring it up to a 2026 baseline: make it actually
run, move it onto current tooling, modernise the API, then fill in the engine
features a small game needs.

The phases are ordered so each one leaves the project in a working, releasable
state. Do them in order; within a phase, items are roughly in priority order.

| Phase | File | Outcome |
|-------|------|---------|
| 0 | [00-make-it-run.md](00-make-it-run.md) | Engine boots in a real browser; tests green on the current stack |
| 1 | [01-tooling.md](01-tooling.md) | ESM, current Node, Vitest, lint, GitHub Actions, docs built in CI |
| 2 | [02-api-modernisation.md](02-api-modernisation.md) | Promises, no mixins, no legacy deps, Web Audio |
| 3 | [03-engine-core.md](03-engine-core.md) | Fixed-step game loop, input, rendering fixes |
| 3a | [03a-animation-redesign.md](03a-animation-redesign.md) | Shared clips, game-controlled animation, fixed-step time |
| 3b | [03b-depth-sorted-tiles.md](03b-depth-sorted-tiles.md) | Tilesets with heights and solidity; characters sorted among tiled scenery |
| 3c | [03c-monkey-island-2-port.md](03c-monkey-island-2-port.md) | In progress: Monkey Island 2 on Tenkai, no SCUMM left; Tenkai gains what it needs |
| 3d | [03d-wreckers.md](03d-wreckers.md) | In progress: a remake of Wreckers (Amiga, 1991); Tenkai gains isometric scenes |
| 4 | [04-docs-and-release.md](04-docs-and-release.md) | Example game, real docs, 1.0 on npm with provenance |

## Guiding decisions

- **Target platform:** evergreen browsers only. No IE-era fallbacks
  (`attachEvent`, `DOMMouseScroll`, `mousewheel`). Node 24 LTS for tooling.
- **Module format:** ESM only. Browserify is gone from the story; consumers use
  Vite or any modern bundler, or a plain `<script type="module">`.
- **Language:** stay in JavaScript, but make the existing JSDoc load-bearing by
  type-checking it with `tsc --checkJs` and shipping generated `.d.ts` files.
  This keeps the code style and docs while giving users types. (Open question:
  a straight TypeScript port is also cheap at ~1,700 lines. Decide before
  Phase 2, since Phase 2 touches every file anyway.)
- **Zero runtime dependencies.** Everything currently pulled in (`async`,
  `moment`, `uuid`, `sprintf-js`) is either unused or replaced by the platform.
- **Small and readable over complete.** Phaser, Kaplay and PixiJS exist. The
  reason for Tenkai to exist is being an engine you can read in an afternoon.
  Resist scope creep (no physics engine, no ECS, no WebGL renderer in 1.0).
- **Breaking changes are fine.** Nothing meaningful depends on 0.1.2 on npm.
  Phase 2 is a deliberate clean break; ship it as 1.0.

## Known state at time of writing (2026-10-09)

- `GameEngine.start()` fails in a real browser (unbound `addEventListener`).
- 7 of 191 specs fail at HEAD; `spec/jsdoc/` stubs crash the runner entirely.
- npm has 0.1.2 (May 2022); repo says 0.2.0.
- Travis CI badge is dead; `docs/` HTML is committed and churns on every build.
- Working tree has ~100 spurious 644 -> 755 mode changes.
