# Blood on Tenkai: active plan

Blood (Monolith, 1997; shareware v1.11, episode 1) remade as a Tenkai client in the browser over a Node server. The
server is the game (no Tenkai in it); the client draws and sounds what the server says and sends the player's
input, nothing more. The world is drawn through WebGL. The remake must match the original, checked against
BLOOD.EXE run headless in js-dos, and is laid out for Quake-style multiplayer.

Rules that hold for all of it:

- Every mechanism is found in the original before it is written: BLOOD.EXE disassembled (`tools/disasm.mjs`), its
  tables read (`formats/exe.mjs`), the running game probed (`fidelity/probe.mjs`, `trace.mjs` with STEP=1). Wikis
  and memories of other source ports only say where to look. Code and commits name the address ported.
- The client is only a client: the server sends the whole of what can change; the client keeps no state of its own
  beyond the map's fixed shape and the view the player points.
- What the user reports seeing is taken as correct and investigated as reported.
- One commit per step, no attribution lines; every check run and read before a step is called done.

Finished work is recorded in `COMPLETED.md`.

## Running it

`npm run data` (once) builds `data/` from `original/`; `npm run build` bundles the client; `npm start` serves the
game and the client at http://127.0.0.1:8053/ (`--mode single|coop|bloodbath`, `--map e1m1`, `--difficulty 0-4`,
`--monsters on|off`, `--cheats`). `npm test` soaks E1M1 and replays BLOOD000 against the original's trace.

## Where fidelity stands

| Demo | Map | Random draws match to | Next divergence |
|---|---|---|---|
| BLOOD000 | E1M1 | the end (tick 1255) | none |
| BLOOD001 | E1M6 | tick 2305 | 2306: a gargoyle moves forward that the original's does not (the player's air speed drifts from 2129) |
| BLOOD002 | E1M5 | tick 398 | 399: a zombie killed by a blast; the original gibs it (24 pieces) where the remake does not |

Comparison tools live in the session scratchpad (remakerand, cmp, heapany, dcmp, pvcmp); worth moving into
`fidelity/` so they survive.

## Open, in the order to take them

### Fidelity

- [ ] F1 BLOOD001 at 2129: the player stepping off a ledge gets a different drag from the original (its height
      above the floor at the drag, BLOOD.EXE 0x35b0d, reads as about 47 where the remake has 98: which floor the
      original's MoveDude has there). Then the gargoyle at 2306 should follow.
- [ ] F2 BLOOD002 at 399: after the zombie's death draws, the original draws 24 pieces of a GibFX at random places
      on the sprite; find which GibSprite call makes them (probe 0x7bff0 with its return address).
- [ ] F3 Monsters still to port from the exe: the stone gargoyle's blast callback, the hand, the spiders, the
      hell hound and the rest of the episode's cast.
- [ ] F4 A slide along a wall moves one unit a tick more than the original's (BLOOD001's steps at 124 and 223).
- [ ] F5 The view against the original's screenshots at the same eye, for every map's start.
- [ ] F6 Move the comparison scripts from the scratchpad into `fidelity/` with a README.

### Game

- [ ] G1 Powerups' effects as the original applies them: crystal ball, beast vision (the palette), cloak, death
      mask, jumping boots; the pack's items' durations from the exe's powerup table, not the remake's 30 s.
- [ ] G2 The inventory bar's layout checked against the exe's viewDrawPack (its offsets were not taken from it).
- [ ] G3 Menus on the client: name, skill, mode; death and restart in single player; the automap.
- [ ] G4 Voxels: drawn as meshes; check against the original's look.
- [ ] G5 `formats/README.md`: each file's layout as found.

### Client

- [ ] C1 Frame rate on the Pi in the user's own window: GPU about 22 ms a frame at 1920x903 in the E1M1 crypt; the
      largest cost is a linked ceiling's portal pass (the walk from the linked sector is not cut vertically).
- [ ] C2 Client-side prediction: deliberately not done (the brief keeps game logic off the client); the protocol
      is ready (numbered inputs, the server's ack, snapshots, interpolation). The user's call.

## Open decisions

- Music: rendered from the MIDI to MP3 (done); a soundfont in the browser instead, or not.
- Prediction: see C2.
