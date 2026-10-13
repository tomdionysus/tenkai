# 03h: Dune II (Amiga, 1993) on Tenkai

Dune II: The Building of a Dynasty (Westwood / Virgin, Amiga 1993), remade on Tenkai from the original's own code
and data, in `local/duneii` (private, local only). Started 2026-10-13.

## Goals and order (user, 2026-10-13)

1. A faithful remake on Tenkai, checked against the original.
2. Archive that version (a standalone snapshot, as `~/devroot/Wreckers2026` was).
3. Then: 1080p-capable display and networked multiplayer.

"Might be worth starting with a client/server architecture from scratch this time. But the experience should be
seamless from the original - except for resizable screens." So the game is server-authoritative from the first
line: the game logic in plain classes with no drawing, no DOM and no timers of its own (a Node server ticks it),
the page a client that sends orders and draws state. It must play exactly like the original: no added latency,
no visible network seams. Resizable screens are the one difference allowed from the start.

## Architecture (from what Wreckers ended up with)

- `remake/src/` game logic: `Game` (Tenkai GameState: houses, map, units, structures, teams, the clock, the
  seeded random), each thing an agent owning and snapshotting its state, ticked at the original's rate. The EMC
  script machine (units, structures and teams run the original's scripts, as on the PC) is a class of its own.
  No 68k addresses or constants in the code: provenance goes in notes, tables in the class that uses them or in
  data JSON.
- `remake/server/`: the Node server (reusing Wreckers' hardened pieces: TickClock, GameServer, WebSocketConnection,
  StaticFiles, StatusReport, Logger).
- `remake/client/`: Tenkai screens drawing the state (the map view with its scrolling, sidebar, radar, mentat,
  menus, the intro and endings), sending orders; resizable from the start.
- An RTS suits this well: players send orders, not keystrokes, and Dune II's game tick is slow (the PC runs logic
  at 60 Hz timers but units move on a much coarser scale), so a server on the same machine or LAN adds nothing
  visible. Smoothness comes from drawing between ticks (Tenkai Trails / GameClient.fraction).

## Steps

1. Data out of the disks (in progress): formats decoded (`local/duneii/notes/formats.md`), readers in the kit
   (`amiga-tools/tools/westwood/`). Still to do: fonts, the binary scenario files, the compressed texts, music
   and sound (MX, MXTX), palettes per scene; then exporters into `remake/data`.
2. The program: unpacked (`tools/unpack.py`); disassemble with rd.py into `listings/`, name routines after
   OpenDUNE's (same Westwood C code base); find the tick, the unit and structure tables, the random generator.
3. The emulator: serve dos.library (Open, Read, Seek, Close, Lock), exec memory, and enough graphics and intuition
   for the game to open its screen; save states, scripted input, per-tick traces of the game state (as
   Wreckers' stationtrace).
4. The remake's logic, checked tick by tick against the traces: map and scenario loading, the EMC machine, units,
   structures, harvesting and credits, combat, the AI teams, the sandworm, reinforcements and win/lose.
5. The client: every screen of the original, then the intro, mentat, map choice, endings, music and sound.
6. Archive. 7. 1080p and multiplayer.

## Status (end of 2026-10-13)

Where it stands (all in `local/duneii`, a nested git repo; last commit c83e6f8):

- **Tools.** The original runs in the kit's C emulator (`amiga-tools/native/a500`, real Kickstart 1.3, DF0/DF1, a
  disk changer; `poke` for cheats): `tools/checks/original-play.sh` boots to Atreides mission 1;
  `original-trace.mjs` logs the battle's records; `original-refinery.mjs` scripts a game to a docked harvester.
  The remake's screen at `?original` is shot headless with `tools/checks/screenshot.mjs` (it always kills its
  Chrome, and has a time limit) and compared with the captures in `reference/`. `build-check.mjs` compares building
  with the original's log; `battle.mjs` runs a battle headless. Test servers on 8061; the user's game is on 8060
  (restart it after server changes: `node local/duneii/remake/server.mjs 8060 127.0.0.1`).
- **Server (`remake/src`, the game's own code).** Ported from the Amiga program and OpenDUNE: the game timer
  (50 ticks a second) and game speed; the structure, house and production loops (building checked against the
  original: 0 differing); BUILD.EMC on the script machine (states, delivery, refining); structure animations;
  power and storage; unit speed and movement ticks; the harvesting rate and spice; the refinery calling, docking
  and unloading a harvester; friendly fire; win and lose (WinFlags, LoseFlags, the 7200-tick minimum). Still the
  remake's own: the route finder (A*), unit behaviour (UnitBrain instead of UNIT.EMC), turrets, combat damage.
- **Client (`remake/client`, on Tenkai).** The battlefield a TiledScene (ground and shroud) with structures, units,
  shots and explosions as Entities; the panels an IndexedScene; the factory window and hints Screens; a Cursor;
  50 steps a second; SoundVoices. Pixel for pixel with the original: the play screen, the factory window, the
  placing panel and cursor, the hints. Sound: effects and speech from DUNEGAME.ENG (`notes/sound.md`).
- **Screen** fixed at 320 x 200, centred, 3x, for now. No edge scrolling with the pointer (by request).

## Open, in order

1. **Tenkai mechanisms (the user's priority, 2026-10-13).** The client wraps Tenkai in Dune-only classes that hold
   generic mechanisms. Move each into `lib/` (a spec, run with `npx jasmine`; a page in `docs/api`), Dune keeping
   only its data and decisions, and check the screen against `reference/` after each:
   - a shroud / fog of war layer for TiledScene (unseen black, edge tiles by seen neighbours), from `MapView`;
   - sprites by facing (pictures per facing, mirrored halves, turrets as children) and Entities that are the
     game's things (units as Entity subclasses, not sprite slots set each frame), from `UnitSprites` and
     `StructureSprites`;
   - palette variants of a sheet (house colour tables, a blink's white) cached as canvases, from `MapCanvases`
     and `HouseColours`;
   - command-list animations (show, wait, wait at random, loop, stop) for explosions and structure animations,
     from `Explosions` and `StructureAnimator`;
   - Screens used as Tenkai means them (the mouse routing, centring and pause now in `ModalScreen`), and a modal
     message box, from `HintBox`;
   - status widgets: a message line with importance and hold, and a rolling counter, from `MessageLine` and
     `CreditsCounter`;
   - selection marks and a footprint cursor (`MapMarks`); a radar / minimap of a tile map (`Radar`); a sound
     table with phrases and voices taking turns (`GameSounds`); a frame whose middles repeat (`ScreenFrame`).
   - Ask the user before moving server machinery: `GameState` and `Place` are copied from Wreckers (Tenkai is
     client-only by the user's rule). Merge `Placement` into `BuildLocation`.
2. **Fidelity left on what exists.** Playtest (user, 2026-10-13, later): the harvester moves off the refinery too
   quickly, and can skip over units when it does. The credits boxes' edge columns and red marks (29 pixels); the refinery pad's
   red lamp (4 pixels); the yard hint's last full stop, which the original drops; two stray blitter pixels by
   pictures; the just-built structure animation (unchecked); 7 of 150 tiles revealed differently at the start;
   the harvester's exit tile (the original's is east of the pad) and the deployed text over the map; the carryall
   fetching harvesters; foot soldiers' deaths; the explosion table and unit deaths from the Amiga's own code (now
   OpenDUNE's table, and deaths by movement type).
3. **Sound.** A Paula capture in the emulator (log AUDx in `native/a500`) to check every effect's pitch and
   volume (the user hears the Attack acknowledgement as wrong; by the Amiga's action table it is effect 1, three
   times); explosion sounds; the in-game ambient track (DUNEGAME track 19, an MX sequencer); the intro and finale.
4. **Logic from the original.** UNIT.EMC on the script machine in place of UnitBrain; the original's route finder;
   turrets (BUILD.EMC's turret functions); the AI teams (TEAM.EMC); carryalls, the starport, repair, upgrades;
   reinforcements and the sandworm; checked against emulator traces (the plan in `notes/logic.md`).
5. **Screens.** Mentat, Options (on the modal screen), map choice, intro, briefing, end of mission and score.
6. Archive; then 1080p and multiplayer.
