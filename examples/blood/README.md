# Blood

Blood (Monolith Productions, 1997) remade on Tenkai from the shareware's own files: a Node server runs the game, and
the browser is a Tenkai client that draws what the server says and sends the player's keys. The levels, pictures,
sounds, music, animations, monsters' numbers and weapons' timings are the original's, read out of its archives and
its executable; the movement is checked against the original running headless in DOSBox, tick by tick.

The shareware is not in this repository. `original/` is git-ignored: put the shareware's `blood.exe` (the 1997
self-extracting installer, Blood Shareware v1.11) there and unpack it as below.

## Build and run

```
cd examples/blood
npm install
python3 tools/shr.py original/blood.exe            # see below: unpacks into original/
node tools/build.mjs                               # data/: tiles, palettes, maps, sequences, QAVs, sounds as PNG, JSON and WAV
node tools/music.cjs                               # data/music/: the MIDIs rendered to MP3 (FluidSynth, a GM soundfont)
../../node_modules/.bin/esbuild src/main.js --bundle --outfile=bundle.js
node server/index.mjs                              # http://127.0.0.1:8053/
```

`tools/shr.py` reads the installer's SHARE.SHR: unpack `blood.exe` (a PKZIP self-extractor) with `unzip` into a
folder, then run `python3 tools/shr.py <folder>/SHARE.SHR extract original` (see the script's usage). The music
needs a General MIDI soundfont (by default `/usr/share/sounds/sf2/TimGM6mb.sf2`).

The server takes `--port`, `--map e1m1`, `--mode single|coop|bloodbath` (Bloodbath has no monsters unless
`--monsters on`), `--difficulty 0-4` (Still Kicking to Extra Crispy; 2 is Lightly Broiled) and `--cheats` (a test
warp, for the checks in `fidelity/`). Several players join the same server from their browsers: open the page on
another machine at the server's address, or give it `?server=ws://host:8053/game`.

## Controls

Click the view to take the mouse (it turns and looks). W, A, S, D or the arrows move; Shift walks; Space jumps;
C or Ctrl crouches; E or Enter opens and uses; the left button or F fires, the right button or X fires the other way;
1 to 0 choose a weapon; Page Up, Page Down and End look up, down and ahead; Tab shows the scores.

## How it is built

- `formats/`: readers for the original's files, as found by reading them: RFF archives (an XORed directory), maps
  (v6.03 with Blood's bit-packed extras), ART tiles, SEQ and QAV animations, SFX, DEM demos, and the tables inside
  BLOOD.EXE (monsters, hitscans, missiles, pickups).
- `common/`: the Build engine's queries (clipmove, getzrange, hitscan, cansee, neartag) in Build's integer
  arithmetic, and the sector links; shared by the server and the client.
- `server/`: the game (no Tenkai): `game/` the level, the player's movement, triggers (Blood's channels, busy
  motions, sliding and turning sectors), sequences, weapons, pickups, combat, missiles, monsters; `net/` the
  snapshots and their patches; `index.mjs` the WebSocket server at `/game` and the page.
- `src/`: the client on Tenkai: `StartScreen` (the engine's `startScreen`), `ServerFinder` and `GameClient` for the
  server, `BuildView` (a `WebGLScene`, added to Tenkai for this game) drawing the map in palette numbers through
  Blood's shade tables, the status bar and weapon through `PictureAtlas`, sounds and music through `SoundManager`.
- `fidelity/`: the original under js-dos's emulator in Node: `trace.mjs` reads its memory as it plays a demo,
  `replay.mjs` plays the same inputs through the server and compares, `random.mjs` compares the random draws,
  `montecarlo.mjs` writes demos of random input for the original to play and scores both.
- `TODO/`: the plan (`ACTIVE.md`) and the record of what was found (`COMPLETED.md`).

## Credits

Blood is © 1997 Monolith Productions; its data comes from the user's own copy of the shareware and is not
distributed here.
