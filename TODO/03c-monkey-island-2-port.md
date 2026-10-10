# Phase 3c: Monkey Island 2 Port (in progress)

Goal: Monkey Island 2 running on Tenkai, with no SCUMM code and no SCUMM data formats left, and Tenkai improved by
everything the port needs. Part of Phase 3: a large, real adventure game is the test of whether the engine core
is enough.

The second aim matters as much as the first. Every place Tenkai falls short is recorded in
`local/monkey2/TENKAI-GAPS.md`, and the fix goes into `lib/` as a general feature with docs and specs, not into
the game.

## Where it is

`local/monkey2/`. It is git-ignored and stays local: the game's data is copyrighted (from the GOG Special
Edition), and so is everything derived from it. That folder has its own `git init` only so basemind can index
it; it has no remote. `local/monkey2/PLAN.md` is the detailed log, and `LOCAL-ONLY.md` says how to run it.

## Status (2026-10-10)

The game plays from the opening through Woodtick in the browser. It no longer runs SCUMM bytecode or reads SCUMM
files while playing, but the engine underneath is still a SCUMM engine written in JavaScript, and much of the
exported data is still SCUMM's structures. About halfway.

### Done

- **Scripts as JavaScript.** All 2,937 scripts are decompiled and generated as JavaScript generator functions
  (`build/game/scripts.js`, 3.1 MB): structured loops and ifs, cutscene overrides as `try` blocks, and 28 that
  do not structure as state machines. The browser runs these, not bytecode.
- **Assets out of SCUMM files.** `tools/export.js` writes rooms, objects, costumes, fonts and song timing as JSON
  and PNG (9.3 MB). The game loads only these. Images are palette indices with a palette, on purpose: colour
  cycling and fades need them.
- **Sound.** The Special Edition's music, effects and speech, converted to `.m4a` (232 MB), with layered music
  cues and speech timed to the text.
- **Fidelity proven.** A harness hashes the game state every frame. The generated scripts on the exported data
  match the original interpreter on the original files exactly, through the opening recording and 24 seeded
  random-play runs of 20 to 30 minutes each.
- **Stage 5 begun: the engine onto Tenkai.** Before it started, per-frame hashes were saved from seven
  recordings (46,000 frames, `tools/baseline.js`); every step must leave them identical. So far:
  - **Indexed colour:** `Palette`, `IndexedSurface` and `IndexedScene` added to Tenkai. The game's frame,
    overlays, palette, colour cycles, fades and shadow table use them. Baselines identical.
  - **ES modules:** Tenkai and the port converted, with Jasmine 7 and c8. Baselines identical.
  - **Sound, nearly done:** `SoundManager` gained handles, layered sounds with seeking, channels with their own
    volumes, and a voice for spoken lines. The port's own Web Audio player has been replaced by it.

### Still SCUMM

- **The engine.** `src/engine.js` (2,270 lines), with `actor.js`, `costume.js`, `boxes.js`, `charset.js` and
  `runtime.js`: script slots, numbered global variables, SCUMM's verb and sentence system, walking, text and
  camera, modelled on ScummVM.
- **The scripts are translated, not rewritten.** They call SCUMM operations one for one (`game.print`,
  `game.animateActor`, `game.startScript`, ...) and use variables by number.
- **Data in SCUMM's shapes.** Costumes are SCUMM animation command tables, walk boxes and the box matrix are
  SCUMM's, and songs are iMUSE timing data.
- **The interpreter.** `opcodes.js`, `resources.js`, `gfx.js`, `data.js` and `midi.js` remain as the reference
  every comparison is checked against, and for re-exporting. Play does not need them, except for the
  `?original` mode.

## Remaining work

1. **Finish stage 5: the engine onto Tenkai.** One piece at a time, each a general Tenkai feature, with the game
   moved onto it and its data converted to match, and baselines identical after each:
   - sound (finish: browser check with real audio);
   - a coroutine scheduler for generator scripts (sleeping, waiting, freezing, killing, nesting, a defined
     order);
   - bitmap fonts (glyph sheet and metrics, colour remapping, line breaking), with the fonts' data moved to them;
   - multi-limb sprites (limbs animating independently, mirroring, scaling), with costumes converted from
     command tables to clips;
   - walk areas (connected regions, routing, nearest walkable point, per-region scale), with boxes converted;
   - occlusion masks (entities drawn behind a chosen mask plane).
2. **Scripts on Tenkai's terms.** Generate the scripts against Tenkai-level operations instead of SCUMM's, and
   give the numbered variables names: mechanically where use makes them clear, by hand for the rest.
3. **Full playthrough.** Recordings to the end of the game, every divergence fixed.
4. **Remove SCUMM.** Drop the interpreter and the original files once the playthrough recordings no longer need
   them as the reference.

## Open questions

- **Promises.** Proposed conventions for Tenkai's async APIs (handles with `stop()` and a `done` that always
  settles, rejecting only for loading, game-time `game.wait()`, plain state alongside every Promise, the
  `async` library removed) to be decided before the coroutine scheduler, since scripts will wait on these
  handles. Ties in with Phase 2's "Promises, no legacy deps".
- **Saving.** Generator state cannot be serialised. Either replay the input log at full speed on load (exact,
  simple, slower to load), or generate scripts as resumable state machines (serialisable, less readable).
- **Naming.** How readable names reach the scripts: object and actor names come from the data; global variables
  are numbers until inferred from use or named by hand.

## Verification

Every step is checked against the saved baselines (`node tools/baseline.js check`, about 11 seconds), and larger
changes also against fresh seeded random play (`node tools/fuzz.js`). A step is done when the baselines are
identical, Tenkai's specs pass, and the game runs in the browser.
