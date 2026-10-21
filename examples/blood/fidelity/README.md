# Fidelity: the remake against the original

The original Blood (shareware v1.11, `original/`) runs headless under js-dos's DOSBox in Node (`emulators` from
npm), and its memory is read while it plays: the remake's server replays the same inputs and the two are compared.

## The pieces

| File | What it does |
|---|---|
| `emu.mjs` | Starts the original: the shareware's files, a BLOOD.CFG with its keys bound, keys in, screenshots out |
| `mem.mjs` | Reads the original's RAM inside the emulator's WebAssembly heap: the player's sprite, Blood's sector, wall and sprite arrays (found from the map) |
| `trace.mjs` | Lets attract mode play a demo (its own, or one given in place of BLOOD000.DEM) and samples the player and its velocity, the demo's tick count, the random state (and with `DUDES=1` every monster and every sprite made) |
| `randlog.mjs` | Patches the original's rand() in memory to log each caller and the tick it was in (`../tools/randcalls.py --json` names the callers' source files) |
| `findvel.mjs` | Finds Blood's velocity arrays in the original's memory (the words that follow the player's step), for the trace |
| `replay.mjs` | Plays a demo's inputs through the server's game and compares with a trace, tick by tick (`--steps`: each tick's move) |
| `random.mjs` | Compares the remake's random draws with the original's (both Watcom's `rand()`), tick by tick |
| `dudes.mjs` | For each monster: when it stirs, where it ends, its tile, in the original and the remake |
| `views.mjs` | The original's screen at chosen ticks beside the remake's view from the server's state at those ticks |
| `montecarlo.mjs` | Writes demos of random input, has the original play each, traces, replays and scores (`--score dir` re-scores stored runs) |
| `soak.mjs` | Every map run by the server with a random player, for anything that throws, and how long a tick takes |
| `../tools/randcalls.py` | Where BLOOD.EXE calls `rand()`, placed by source file through its LE fixups to the asserts' file names |

## Running

```
node fidelity/trace.mjs /tmp/t.json 45                       # the attract demo (E1M1), 45 seconds of it
node fidelity/replay.mjs /tmp/t.json 400                     # the first 400 ticks compared
node fidelity/random.mjs fidelity/trace-blood000-rng.json 175
DUDES=1 node fidelity/trace.mjs /tmp/t.json 25 && node fidelity/dudes.mjs /tmp/t.json 700
node fidelity/montecarlo.mjs 4 360 /tmp/mc                  # 4 runs of 360 random ticks
node fidelity/soak.mjs 1800                                   # every map, 1800 ticks each, two skills
```

`views.mjs` needs the fly-through served (`python3 -m http.server 8471` in `examples/blood`).

## What the traces showed

See `../TODO/COMPLETED.md`: the movement's constants (acceleration, drag, the stance's tiles), the sector types'
numbering, the start's coffin and its room-over-room link, the gate that opens when run into, the random
generator and the monsters' thinking schedule, the buried zombies' sequences, the thrown TNT and its explosion,
the gibs, the velocities and the air drag, every random draw in BLOOD000 to tick 351 (the network checksum's,
the effects', the gibs'). See `../TODO/ACTIVE.md` for what still parts them.

The stored traces: `trace-blood000.json` (the player, BLOOD000), `trace-blood000-rng.json` (with the random
state), `trace-blood000-dudes.json` (with the monsters). Traces of the longer demos are tens of megabytes and are
kept out of git.
