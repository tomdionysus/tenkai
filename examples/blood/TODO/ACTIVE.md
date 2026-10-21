# Blood on Tenkai: active plan

Started 2026-10-21. The goal: Blood (Monolith, 1997; shareware v1.11, episode 1 "The Way of All Flesh") remade as
a Tenkai client in the browser over a Node server, the way the other remakes went: the server is the game (no
Tenkai in it), the client draws and sounds what the server says and sends the player's input. The original is
Build-engine pseudo-3D, so the client draws through WebGL, through a Tenkai primitive written for it. The remake
should match the original (the same maps, tiles, sounds, movement and monsters), checked against the original run
in a headless emulator, and be laid out for Quake-style multiplayer (server-authoritative ticks, input commands,
snapshots, interpolation, Bloodbath spawns).

Habits: one commit per step; every check run and its whole output read before a step is called done; the game
tried on a private port, never pushed or published unasked. Done steps move to `COMPLETED.md` with what was
learned.

## Layout

```
examples/blood/
  original/     the shareware as shipped (git-ignored): blood.exe, and what tools/shr.py unpacks from it
  tools/        reverse-engineering and build tools (shr.py: the installer; dump.mjs: the formats; build.mjs: data/)
  formats/      readers for the original's files, shared by the server and the tools: rff, art, map, seq, sfx, dem
  data/         what build.mjs writes for the client (git-ignored): tile atlases, palettes, maps, sounds
  server/       the game on Node: index.mjs, game/ (world, physics, actors, weapons), net (ws)
  src/          the client on Tenkai: main.js, the renderer, HUD, menus
  fidelity/     the original run headless (js-dos), demos, comparisons
  TODO/         this plan and the record
```

## Phase 0: the original in hand (done, see COMPLETED)

## Phase 1: the formats (reverse engineering)

Read every file the shareware ships, with a dump tool that prints what each holds and checks that fit the
original's own behaviour (counts, ranges, cross-references).

- [x] 1a RFF archives (BLOOD.RFF, SOUNDS.RFF, GUI.RFF): header, encrypted directory, per-file encryption flag, the
      types in each (`formats/rff.mjs`, `tools/dump.mjs rff`)
- [x] 1b Palette and shade tables: BLOOD.PAL, the palookups (.PLU), the alternate palettes (water, beast); TABLES.DAT
- [x] 1c SHARE000.ART: tiles, sizes, picanm (animation, offsets); which tiles the maps and sequences use
- [x] 1d MAP files: Blood's encrypted v7 map (header key, sector/wall/sprite keys found by sanity), xsector/xwall/
      xsprite bitfields, the episode's maps listed in BLOOD.INI; a check that every wall's nextsector/nextwall and
      every sprite's sector agree
- [x] 1e SEQ (sprite animation sequences) and QAV (weapon animations), SFX descriptors and RAW sounds, MID music,
      DEM demos (the input record: the fidelity test's gold), the others (.KVX voxels, .TXT)
- [ ] 1f A format record in `formats/README.md`: each file's layout as found

## Phase 2: the data built for the client

- [x] 2a `tools/build.mjs`: everything the client loads in a standard format (the user's rule, 2026-10-21: bitmaps
      as PNG, sounds as WAV, music as WAV or MP3, so Tenkai's own classes load them). Tiles packed into atlas pages
      as two PNGs each: a true-colour one for Tenkai's `Sheet` (HUD, menus) and an 8-bit grey one whose pixel
      values are the palette numbers, for the shader; palettes and shade tables as PNGs; sounds as WAV; the
      MIDIs rendered through a soundfont (js-synthesizer; no synth is installed here) to WAV or MP3; maps and
      sequences as JSON (the server reads the originals through formats/ directly)
- [x] 2b A look at the tiles and maps in the browser (an atlas viewer page) to confirm the readers by eye

## Phase 3: drawing the world (client)

- [x] 3a Tenkai: a `WebGLScene` primitive (a scene with its own WebGL canvas, drawn into the engine's canvas at its
      place and size, with the engine's pixelated setting), spec and doc
- [x] 3b Build geometry renderer: sectors' floors and ceilings (sloped too), walls (one-sided, two-sided with upper
      and lower parts, masked), parallax sky, shading by sector shade and distance through the palookup in a
      shader (indexed tiles, palette and shade table as textures), visibility by sector portals from the eye
- [x] 3c Sprites: face, wall and floor sprites, with their flags (flipped, translucent, one-sided), sorted; voxels
      as their face tile for now
- [x] 3d A fly-through page of each map (no server) to check the drawing against the original's screenshots
- [x] 3e The HUD in palette numbers (IndexedSurface, IndexedFont from the ART font tiles): status bar, messages,
      weapon in hand (QAV)

## Phase 4: the game on the server

- [x] 4a The world: map loaded, sectors and sprites as live objects, the Build tables (sin, clip), engine
      queries (getzrange, cansee, hitscan, clipmove, pushmove) ported with checks
- [x] 4b (movement) The player: Blood's movement (input → velocity, friction, gravity, jump, crouch, swim), 30 ticks a second,
      kicked by the original's constants; a demo played through the server as the check
- [x] 4c Sector effects (xsector): doors, lifts, switches, triggers, teleports, water, the sprite effects
- [x] 4d Weapons: pitchfork, flare gun, shotgun, Tommy gun, dynamite ...; hitscans, projectiles, damage
- [x] 4e (first pass) Monsters: cultists, zombies, gargoyles, hell hounds, rats, bats, spiders ...: SEQ-driven states, AI
      (sight, hearing, chase, attack), from the original's behaviour
- [x] 4f Items, keys, powerups, secrets, level end, episode flow
- [x] 4g The net: `ws` server, join/input/tick as GameClient speaks, snapshots as StateDiff patches, per-player
      views, several players, Bloodbath spawns and respawn

## Phase 5: the client as a game

- [x] 5a StartScreen (the Tenkai landing page) → connect (ServerFinder) → the server's lobby → play
- [x] 5b Input: keys and mouse look (pointer lock) sent as held input; the view from the state, interpolated
- [x] 5c Sound: SoundBoard from the RAW sounds, positional by the state; music (MIDI: a soundfont, or skipped)
- [ ] 5d Menus, the automap, messages, the end of a level

## Phase 6: fidelity

- [x] 6a The original headless: js-dos `emulators` under Node with the shareware, driven by keys, screenshots out
- [ ] 6b Demos: BLOOD000-002.DEM parsed; played in the emulator and through the server; positions compared per tick
- [ ] 6c Monte-carlo: random input scripts played in both, compared; the differences listed and closed
- [ ] 6d Screenshots of the same view compared (the renderer against the original)

## Now (2026-10-21, evening)

Playable: `node server/index.mjs` serves the client and the game at http://127.0.0.1:8053/ (`--mode single|coop|bloodbath`,
`--map e1m1`, `--difficulty 0-4`, `--monsters on|off`, `--cheats` for the test warp). E1M1 to E1M8 load and run; the
level's end leads to the next by BLOOD.INI. Open, in the order to take them:

- [x] F1 Thing physics and explosions matched to the original (BLOOD000 departs at tick 340 where its thrown TNT
      goes off): Blood's MoveThing, the explosion table, actRadiusDamage's knock
- [ ] F2 The monsters from the original's own AI states and functions (server/game/ai.mjs): the zombies, the
      cultists and the rats done (thinks, callbacks, activation, recoil, aiDamageSprite's and actKillDude's parts);
      gargoyles and statues (server/game/aigarg.mjs: the stone one's blast callback still to port), the bat
      (aibat.mjs) and the bone eel (aieel.mjs) ported; the hand and the spiders to do
- [x] F3 Blood's random numbers found (Watcom rand); Monte-Carlo runs of random inputs in both, compared
- [x] F3b The drift of one draw in six ticks: Blood's CalcGameChecksum (found by logging rand()'s callers)
- [ ] F3c The draws part: BLOOD000 (E1M1) matches the original whole: its random draws through the demo and the
      player's place every tick (`npm test` replays it all). BLOOD001 matches its draws to 1215 and its positions
      to 1462 (its dive into the lake: the water's drag, the bubbles, the view's spring toward the body's speed, a
      cultist's fall into the water and its bubbles; the gargoyles, the bat and the eel ported from the exe;
      ProcessTouchObjects, Build's table ksqrt, the player's air and choking, every dude dragged and carried by a
      panning floor each frame, effects put in the sector they are given, clipmove's 32-bit products, sector lists
      in the order sprites entered them; fidelity/statlist.mjs reads the original's lists);
      BLOOD002 its draws to 398 and positions to 399 (a big gib event at 399): the gargoyles, bats, hand and eel to
      port (F2)
- [ ] F4 BLOOD001 (E1M6) and BLOOD002 (E1M5) traced and replayed (`replay.mjs --steps` compares each tick's move).
      Done: the TNT bundle (lit on fire, thrown on letting go, lobbed if let go before the fuse catches, goes off on
      what it hits), Blood's explosion (fixed damage once, the concussion's damage) and actFireThing. Open: a slide
      along a wall moves one unit a tick more than the original's; BLOOD001's falls and steps at ticks 124 and 223
- [ ] F5 The view against the original's screenshots at the same eye, for every map's start
- [ ] G1 Sector damage (618: lava, fire), water (swimming, the water links), the hand's choke
- [ ] G2 Powerups' effects (crystal ball, beast vision, cloak, death mask, jump boots), the pack's use keys
- [ ] G3 Menus on the client: name, skill, mode; the death and restart in single player
- [x] V1 (the exploder traps, 459, now hidden) Flame and torch sprites drawn stretched; voxels (KVX) drawn as their 2D tiles for now
- [ ] N1 Client-side prediction: deliberately not done. The brief keeps game logic off the client; prediction would run
      the movement there. The protocol is ready for it (numbered inputs, the server's ack, snapshots, interpolation);
      it is the user's call. Done instead: the server latches presses between ticks, so taps are not lost.

## Open decisions

- Voxels: drawn as voxels (a mesh built from KVX) or as their 2D tiles. Start with tiles.
- Music: the MIDI through a soundfont in the browser, or none. Start with none.
- Client prediction: later; the first client only interpolates.
