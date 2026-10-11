# Tenkai 2026 Update Plan

Tenkai was last worked on seriously in mid-2020 (dependency bump in Sep 2022).
This folder holds the plan to bring it up to a 2026 baseline: make it actually
run, move it onto current tooling, modernise the API, then fill in the engine
features a small game needs.

The phases are ordered so each one leaves the project in a working, releasable
state. Do them in order; within a phase, items are roughly in priority order.

| Phase | File | Outcome |
|-------|------|---------|
| 0 | [00-make-it-run.md](00-make-it-run.md) | Done but for small fixes: engine boots in a real browser; tests green |
| 1 | [01-tooling.md](01-tooling.md) | Partly: ESM done; Node engines field, types, Vitest, lint, CI to do |
| 2 | [02-api-modernisation.md](02-api-modernisation.md) | Partly: Web Audio done; promises, dependencies, mixins to do |
| 3 | [03-engine-core.md](03-engine-core.md) | Partly: fixed-step loop, input; camera, HiDPI, pointer events to do |
| 3a | [03a-animation-redesign.md](03a-animation-redesign.md) | Done: shared clips, game-controlled animation, fixed-step time |
| 3b | [03b-depth-sorted-tiles.md](03b-depth-sorted-tiles.md) | Done: tilesets with heights and solidity; characters sorted among scenery |
| 3c | [03c-monkey-island-2-port.md](03c-monkey-island-2-port.md) | In progress: Monkey Island 2 on Tenkai, no SCUMM left |
| 3d | [03d-wreckers.md](03d-wreckers.md) | 1.0.0 (2026-10-11): Wreckers (Amiga, 1991) remade; fidelity work closed (user, 2026-10-11) |
| 3g | [03g-wreckers-remake-architecture.md](03g-wreckers-remake-architecture.md) | The Wreckers plan from here (2026-10-12): no 68k constants in the code, no god classes, agents in stations in a sector (several stations allowed), the game engine behind a WebSocket-shaped interface in the browser (the main milestone), then a real WebSocket and three players (pause and saves go); holds the order of the work |
| 3f | [03f-wreckers-on-tenkai.md](03f-wreckers-on-tenkai.md) | The Tenkai side of 3g: which mechanisms move into `lib/` as which classes, at which step; `Motion`, the frame baselines and the remake's file structure done |
| 3e | [03e-wreckers-improvements.md](03e-wreckers-improvements.md) | Open (fidelity is over): improvements beyond the original; three already made, the larger ones after 3g's step 3 |

Phases 3d to 3g are one piece of work; 3g is its plan and order, 3f the Tenkai side, 3e the improvements, 3d the record.
| 4 | [04-docs-and-release.md](04-docs-and-release.md) | Example games, real docs, 1.0 on npm with provenance |

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

## State (2026-10-11, end of day)

- The engine runs every example and port; 363 specs pass (Jasmine, `npx jasmine`).
- Games: three examples (`examples/`: 1945, Arkanoid, Tim the Enchanter) and four local ports (`local/`, not
  for release: Wreckers 1.0.0, Monkey Island 2, Golden Axe, Myst), all with the `StartScreen`.
- Frame baselines for every game: `node tools/frames/frames.mjs check <script>`, scripts and baselines in
  each game's `frames/` folder (see 3f). They need the game's dev server running (ports in each README or
  LOCAL-ONLY.md) and are tied to this machine's Chrome and fonts.
- Still true from 2026-10-09: npm has 0.1.2, the repository says 0.2.0; the Travis and Coveralls files are
  dead (no CI); the runtime dependencies `async`, `moment`, `sprintf-js` and `uuid` are still listed.
