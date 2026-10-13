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

Where it stands (all in `local/duneii`, a nested git repo):

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

1. **Tenkai mechanisms: done (2026-10-13).** Each generic mechanism the client held is in `lib/` with a spec and a
   page in `docs/api`; Dune keeps its data and decisions; every step checked old against new in the page, pixel
   for pixel (the play screen, a scripted battle frame with explosions and shots, the factory window with a button
   pressed and released, a hint, the top bar mid-roll, a 520 x 330 frame):
   - `Shroud` (the fog of war over a TiledScene), used by `MapView`;
   - `IndexedSprites` (an indexed sheet's pictures as Sheets in colour tables, mirrored, made once and kept) and
     `IndexedSurface.table`, used by `MapCanvases` and `HouseColours`;
   - `Facings` (the picture for a facing: mirrored halves, shared pictures, frames) and `Roster` (an entity for each
     thing of a changing collection): units are `UnitEntity` (an Entity with its turret and spray as children),
     structures, shots and explosions are kept by Rosters;
   - `CommandList` (an animation as a list of commands), used by `Explosions`. `StructureAnimator` stays the
     server's (Tenkai is client-only; its pauses draw on the battle's shared random numbers);
   - `Screen` grown: buttons in its own coordinates acting on release (the engine passes the top screen its moves
     and releases), `modal`, `centre`, `letGo`; `MessageQueue` (a modal message box's messages in turn, each held
     before a click dismisses it), used by `ModalScreen` and `HintBox`;
   - `MessageLine` (messages by importance, held, scrolled in) and `RollingCounter`, used by `TopBar` and
     `CreditsCounter`;
   - `Marks`, `Minimap`, `SoundBoard` and `IndexedSurface.repeat`, used by `MapMarks`, `Radar`, `GameSounds` and
     `ScreenFrame`;
   - `Placement` merged into `BuildLocation`. `GameState` and `Place` stay in the game's server code: Tenkai is
     client-only by the user's rule, so they do not move.
2. **Fidelity left on what exists.** Playtest (user, 2026-10-13, later): the harvester moves off the refinery too
   quickly, and can skip over units when it does (fixed: the client slid it from inside the refinery to its exit
   tile over one tick; now it shows on the tile at once, as the original's does; whether it also leaves too soon is
   still to check against `original-refinery.mjs`). Harvesters and the other heavy vehicles should kill foot
   soldiers by driving over them (done: enemies only, as the original; remains left for 600 ticks; the soldier's
   death cry is UNIT.EMC's sound 6, while the PC's crush animation also plays a squish, voice 35, whose Amiga
   counterpart is not known yet). Heavy vehicles leave tracks (done: on bare sand and dunes, fading). The Harvest
   order on a harvester did nothing (fixed: the order book dropped it). The harvester's spray and "harvesting"
   status stayed on off spice (fixed: decided each tick as the original's). Soldiers too strong against harvesters (fixed: every
   gun reloaded about five times too fast; now the original's fireDelay x 2 movement ticks, with the second shot of
   units that fire twice, Troopers' missiles at three quarters, and the computer's harvesters driving at soldiers
   who shoot them). Still the remake's: shots land at once (the original flies a bullet that bursts where the
   target was); turrets' guns are provisional. Attack on bare ground (done: as the original, the tile is the
   target; bursts big enough to damage tiles, rockets and the heavy guns, take the spice down and leave craters;
   small arms and tanks' shells do not, as in the original). The credits boxes' edge columns and red marks (29 pixels); the refinery pad's
   red lamp (4 pixels); the yard hint's last full stop, which the original drops; two stray blitter pixels by
   pictures; the just-built structure animation (unchecked); 7 of 150 tiles revealed differently at the start;
   the harvester's exit tile (the original's is east of the pad) and the deployed text over the map; the carryall
   fetching harvesters; foot soldiers' deaths; the explosion table and unit deaths from the Amiga's own code (now
   OpenDUNE's table, and deaths by movement type).
   Playtest (user, 2026-10-13, latest): windtraps need the original's power display in the panel (the house's
   power needed and output, as the original's windtrap panel shows it). Enemy structures should be selectable to view
   them and their health (the original's panel for a structure not one's own: name, picture and health, no buttons).
3. **Sound.** A Paula capture in the emulator (log AUDx in `native/a500`) to check every effect's pitch and
   volume (the user hears the Attack acknowledgement as wrong; by the Amiga's action table it is effect 1, three
   times); explosion sounds; the in-game ambient track (DUNEGAME track 19, an MX sequencer); the intro and finale.
4. **Logic from the original.** UNIT.EMC on the script machine in place of UnitBrain; the original's route finder;
   turrets (BUILD.EMC's turret functions); the AI teams (TEAM.EMC); carryalls, the starport, repair, upgrades;
   reinforcements and the sandworm; checked against emulator traces (the plan in `notes/logic.md`).
5. **Screens.** The single-player campaign runs client/server (the user, 2026-10-13: the original's whole game,
   written so allied, PvP or mixed multiplayer can follow): the server's `Campaign` holds the phase, the house, the
   mission, the regions done and the map's offer; the page only shows each phase and sends the choice. Done: the
   herald's house choice, the Bene Gesserit's introduction (Yes/No), each Mentat's briefing and word after the
   battle (Proceed/Repeat), checked pixel for pixel against the emulator. The map of Dune (`MapScreen`, OpenDUNE's
   `GUI_StrategicMap_Show`): the frame and emblems, the planet and Dune after the first win, each house's regions
   with the new ones dissolving in (Tenkai's `Dissolve`) and told in the strip, the flashing arrows, a click
   blinking the region and choosing the next scenario. Not checked against the original: the emulator hangs in an
   input wait after the Hall of Fame (`$1aee6` to `$351b8`), so there is no capture of the map yet; the strip's
   text colour (black), the arrows' flash colours and the planet's colours (beside the map's, 32-63) are guesses.
   Players (the user, 2026-10-13): the game does not care who drives a house; the computer is an automated
   player. Single player is a multiplayer battle under the hood (one person, the computer's players, the campaign's
   screens around it); multiplayer has none of the campaign, a chosen map, and may mix people and computer players.
   A house is capabilities, a player picks their colour. Done: ComputerPlayer (seated at every house no person plays,
   its house's view in, the page's orders out: repair below half, keep factories busy, rebuild and re-place lost
   structures); houses on teams (the campaign's: the player's, the computer's, the Fremen with the Atreides); the
   original's computer handicaps a house setting (computerRules). Still to do: colours by player, not house; the
   team AI (TEAM.EMC) in ComputerPlayer; a computer player taking over a person's seat when they leave.
   The game timer (settled 2026-10-13): stepping the emulator a frame at a time in a battle, the original's timer
   ($45784) goes up exactly 1 a frame, 50 a second, as the remake's; reference/refinery's logs counted frames
   wrongly (the frames spent moving the pointer and clicking were not counted).
   A server started on `MAPA2W` (house letter, mission, W/L) opens on the map. Still to do: Options (on the modal
   screen), the intro and finale, the score and the Hall of Fame, music.
6. Archive; then 1080p and multiplayer.
