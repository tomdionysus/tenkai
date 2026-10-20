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
- [ ] 1e SEQ (sprite animation sequences) and QAV (weapon animations), SFX descriptors and RAW sounds, MID music,
      DEM demos (the input record: the fidelity test's gold), the others (.KVX voxels, .TXT)
- [ ] 1f A format record in `formats/README.md`: each file's layout as found

## Phase 2: the data built for the client

- [ ] 2a `tools/build.mjs`: everything the client loads in a standard format (the user's rule, 2026-10-21: bitmaps
      as PNG, sounds as WAV, music as WAV or MP3, so Tenkai's own classes load them). Tiles packed into atlas pages
      as two PNGs each: a true-colour one for Tenkai's `Sheet` (HUD, menus) and an 8-bit grey one whose pixel
      values are the palette numbers, for the shader; palettes and shade tables as PNGs; sounds as WAV; the
      MIDIs rendered through a soundfont (js-synthesizer; no synth is installed here) to WAV or MP3; maps and
      sequences as JSON (the server reads the originals through formats/ directly)
- [ ] 2b A look at the tiles and maps in the browser (an atlas viewer page) to confirm the readers by eye

## Phase 3: drawing the world (client)

- [ ] 3a Tenkai: a `WebGLScene` primitive (a scene with its own WebGL canvas, drawn into the engine's canvas at its
      place and size, with the engine's pixelated setting), spec and doc
- [ ] 3b Build geometry renderer: sectors' floors and ceilings (sloped too), walls (one-sided, two-sided with upper
      and lower parts, masked), parallax sky, shading by sector shade and distance through the palookup in a
      shader (indexed tiles, palette and shade table as textures), visibility by sector portals from the eye
- [ ] 3c Sprites: face, wall and floor sprites, with their flags (flipped, translucent, one-sided), sorted; voxels
      as their face tile for now
- [ ] 3d A fly-through page of each map (no server) to check the drawing against the original's screenshots
- [ ] 3e The HUD in palette numbers (IndexedSurface, IndexedFont from the ART font tiles): status bar, messages,
      weapon in hand (QAV)

## Phase 4: the game on the server

- [ ] 4a The world: map loaded, sectors and sprites as live objects, the Build tables (sin, clip), engine
      queries (getzrange, cansee, hitscan, clipmove, pushmove) ported with checks
- [ ] 4b The player: Blood's movement (input → velocity, friction, gravity, jump, crouch, swim), 30 ticks a second,
      kicked by the original's constants; a demo played through the server as the check
- [ ] 4c Sector effects (xsector): doors, lifts, switches, triggers, teleports, water, the sprite effects
- [ ] 4d Weapons: pitchfork, flare gun, shotgun, Tommy gun, dynamite ...; hitscans, projectiles, damage
- [ ] 4e Monsters: cultists, zombies, gargoyles, hell hounds, rats, bats, spiders ...: SEQ-driven states, AI
      (sight, hearing, chase, attack), from the original's behaviour
- [ ] 4f Items, keys, powerups, secrets, level end, episode flow
- [ ] 4g The net: `ws` server, join/input/tick as GameClient speaks, snapshots as StateDiff patches, per-player
      views, several players, Bloodbath spawns and respawn

## Phase 5: the client as a game

- [ ] 5a StartScreen (the Tenkai landing page) → connect (ServerFinder) → the server's lobby → play
- [ ] 5b Input: keys and mouse look (pointer lock) sent as held input; the view from the state, interpolated
- [ ] 5c Sound: SoundBoard from the RAW sounds, positional by the state; music (MIDI: a soundfont, or skipped)
- [ ] 5d Menus, the automap, messages, the end of a level

## Phase 6: fidelity

- [ ] 6a The original headless: js-dos `emulators` under Node with the shareware, driven by keys, screenshots out
- [ ] 6b Demos: BLOOD000-002.DEM parsed; played in the emulator and through the server; positions compared per tick
- [ ] 6c Monte-carlo: random input scripts played in both, compared; the differences listed and closed
- [ ] 6d Screenshots of the same view compared (the renderer against the original)

## Open decisions

- Voxels: drawn as voxels (a mesh built from KVX) or as their 2D tiles. Start with tiles.
- Music: the MIDI through a soundfont in the browser, or none. Start with none.
- Client prediction: later; the first client only interpolates.
