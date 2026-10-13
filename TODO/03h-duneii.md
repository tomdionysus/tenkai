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

## Status (2026-10-13)

- The emulator is the kit's C `native/a500` (real Kickstart 1.3, A500 with the trapdoor, DF0/DF1 only, a disk
  changer answering the game's disk requests; guide `amiga-tools/docs/09-a500-kickstart.md`). The original runs
  from boot to the play screen unattended: `local/duneii/tools/checks/original-play.sh <dir>` (about two minutes;
  `MORE=<commands>` adds clicks and shots). The reference screen is `local/duneii/reference/atreides1/`.
- The remake runs in a browser (Node server, Tenkai client). Its play screen at `?original` (320 x 200) matches
  the original's for Atreides mission 1, checked pixel by pixel: the top bar's own copper palette, the credits
  boxes, house colours, the shroud's edges, the construction yard selected with the original's panel, the unit
  panel and its order buttons, the message line, the pointer, the radar without an outpost. Clicks behave as the
  original's (select only; orders through the buttons).
- Left on the play screen: 7 of 150 tiles revealed differently at the start; unit facings and the structures'
  animation phases; what the panel shows while building, for other structures and for enemy things.
- Next: traces from the emulator (`peek`/`dump` of the records in `local/duneii/notes/records.md`) for the
  Monte Carlo comparison of the logic, then the other screens (mentat, map choice, intro, endings), sound.
