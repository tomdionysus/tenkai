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
| 4 | [04-docs-and-release.md](04-docs-and-release.md) | Example games, real docs, 1.0 on npm with provenance |

## The games

Each game has its own `TODO/` folder in its own directory, with a `STATE.md` (where it stands, the way in, what
is next), `ACTIVE/` for the plans with open work and `COMPLETED/` for the records. The games' workflows are their
own: their gates, servers, ports and records live with them, and nothing of a game's plan is kept here. What a
game gives the engine arrives in `lib/` with specs and docs, and is recorded in the game's plans and in `docs/`.

| Game | Directory | In a line |
|---|---|---|
| Wreckers (Amiga, 1991) | `local/wreckers/TODO/` | A three-player remake over a Node server, the page a client on Tenkai 0.4.0, the client as objects; fidelity closed |
| Dune II (Amiga, 1993) | `local/duneii/TODO/` | A client/server remake from the original's code; the server mostly the original's, the client as objects; fidelity, then archive, then 1080p and multiplayer |
| Monkey Island 2 (1991) | `local/monkey2/TODO/` | Generated JavaScript on exported data, plays to Woodtick, halfway onto Tenkai; records the engine's gaps |
| Golden Axe (arcade, 1989) | `local/golden-axe/TODO/` | Rounds 1 and 2; drove the animation redesign and depth-sorted tiles; no open plan |
| Myst (1993) | `local/myst/TODO/` | Myst Island and D'ni from the user's own copy; drove the point-and-click core; no open plan |

| 1945, Arkanoid, Tim the Enchanter | [examples/1945/TODO/](../examples/1945/TODO/STATE.md), [examples/arkanoid/TODO/](../examples/arkanoid/TODO/STATE.md), [examples/tim-the-enchanter/TODO/](../examples/tim-the-enchanter/TODO/STATE.md) | The three example games; nothing open |

The local games live in `local/` (git-ignored by this repository; Wreckers, Dune II, Monkey Island 2 and the kit
are nested git repos of their own with no remote), with the reverse-engineering kit in `local/amiga-tools`.

## Guiding decisions

- **Client side only (2026-10-12).** Tenkai is a client-side framework. A game's server is the game's own code;
  Tenkai may be imported there as a library, but owns no server machinery.
- **Mechanisms in, decisions out.** A game's generic mechanism moves into `lib/` with a spec and a doc page; the
  game keeps its data and its decisions. A wrapper around a Tenkai primitive is the game's, not Tenkai's.
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

## State (2026-10-14)

- The engine is 0.4.0 (tags v0.1.0 to v0.4.0 on the remote); 501 specs pass (Jasmine, `npx jasmine`; never
  `npm test`, which uploads coverage).
- Three example games in `examples/` (1945, Arkanoid, Tim the Enchanter) and the games above, all with the
  `StartScreen`; `node tools/smoke.mjs <dir>` loads every one headless and reports page errors.
- `lib/` is 62 classes; `docs/api/` has a page for each and `docs/README.md` the index.
- Still true from 2026-10-09: npm has 0.1.2; the Travis and Coveralls files are dead (no CI); the runtime
  dependencies `async`, `moment`, `sprintf-js` and `uuid` were removed on 2026-10-12: Tenkai has none.
