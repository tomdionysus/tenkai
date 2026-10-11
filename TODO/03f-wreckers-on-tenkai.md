# Phase 3f: Wreckers on Tenkai

Wreckers 1.0.0 (tag `1.0.0`, branch `original` in `local/wreckers`) plays as the original does, but it uses
little of Tenkai: 12 of the 26 exports, five of them in one file each. About 10,400 lines of the remake build
their own indexed pictures, palettes, fonts, click regions, screen switching and game clock, most of which
Tenkai has or should have. This phase refactors the remake onto Tenkai and folds what is general back into
Tenkai, where every example and port can use it.

This file is the Tenkai side: which mechanisms move into `lib/`, as which classes, and what each step gives the
other games. The remake's own end state (no 68k constants, no god classes, agents that own their state, the game
state in a server with the browser as a client) and **the order of all the work** are in
[03g](03g-wreckers-remake-architecture.md). Where the two say different things, 03g wins.

## Rules

- **Behaviour changes only on purpose.** Every step ends with the same frames, the same sounds at the same ticks
  and the same state as before it, proven by the gates below, not by eye. A change that improves on the original
  ([03e](03e-wreckers-improvements.md)) re-saves the baselines it alters, with the reason noted.
- **Mechanisms move, decisions stay.** Anything another game would need with different data or different
  decisions (actors, motion, behaviours, contacts, pooling, screens, drawing, fonts, hotspots) goes into
  `lib/`, leaving 2D games working as they do. What stays in the remake is what makes it Wreckers: the
  original's decisions, numbers, tables, random number generator, text expansion and layouts.
- **Extend rather than change.** Tenkai gains by new classes, new subclasses and new options whose defaults
  keep today's behaviour, so every other game's frame baseline stays identical without touching the game. A
  change to what an existing class does is allowed only when the other games are adapted to it (or improved
  by it), each with its baseline re-saved on purpose and the reason written down.
- **Each Tenkai change** comes with specs and API docs, as every `lib/` change does.
- **The other games are checked after every Tenkai change** (the examples' gates below), and then looked at
  for whether the new feature would simplify them. Adopting it in an example is a separate step with its own
  baseline check, taken only where it removes code without changing behaviour.
- Work on `main` in `local/wreckers`; `original` keeps 1.0.0.
- **Structure (the user's rules, 2026-10-11), for the remake and for Tenkai:** one file per class, named after
  the class (it may hold code that belongs only to that class); no free functions beyond trivial private
  helpers; no god classes; **inversion of control** throughout: a class is given its collaborators (constructor),
  never reaches for them through `window.game`, a shared `game` object, a module-level singleton, or fields
  patched in after construction. The aim is that every class can be built in a spec with stand-ins, so the
  remake's rules get unit tests alongside the station checks.

## Gates

Run all of them before and after each step. A step is done when every gate passes unchanged.

Wreckers (already exist):

- Station checks: `for t in build/mc/station-*.json; do node tools/stationcheck.mjs $t; done`, all 12 identical.
- Move checks: `TRACE=build/mc/move-<s>.json node tools/movecheck.mjs <s>` for 11-14, identical.
- Screen checks against the emulator: `tools/screens_probe.mjs` (map and info screens),
  `tools/menu_scanner_probe.mjs` (menu, scanner), the terminals and letter checks, `tools/battlepod_clip.py`.

New, built in step 0:

- **Frame baselines.** The game run headless with a fixed clock and scripted input; every frame's pixels and
  each tick's sound calls hashed and compared with a saved baseline. One set of scripts per game:
  - Wreckers, four scripts so far: `title` (the start screen and the title sequence); `play` (Tweddell
    woken, walking, firing, the map, View Droid, an order from a slot, the archive, pause, the menu's RS and
    RL, the scanner, quick save and load); `battlepod` (bay 0 in, firing, the scanner from the pod, docking);
    `death` (death, the commander screen, Hambleton, the end sequence, the high score table and name entry).
    The `play` and `death` scripts cover pause, the saves and the switch of officer on death, which 03g removes
    (step 2); they are re-saved then, with those steps taken out.
    **Not covered yet:** lifts, hatches, the airlock and the outside, cryo pods, terminals and the letter,
    bulb consoles, the factory, the menu's other buttons, Knight. Scripts for these must be added, with
    baselines saved on 1.0.0's code, before the step that touches each system (lifts and the outside before
    step 1).
  - The examples: 1945, Arkanoid, Tim the Enchanter (seeded `Math.random` where they use it).
  - The local ports: Monkey Island 2 (its own `tools/baseline.js` already does this for state), Golden Axe,
    Myst.

## A constraint the gates impose

The station and move checks run the remake's logic in Node with no DOM: `tools/checks/station.js` imports
`Aliens.js`, `Droids.js`, `Shots.js`, `Mover.js`, `StationRules.js` and `StationTick.js` directly, builds an
`IsometricWorld`, and ticks them. So an actor's logic (body, motion, behaviour, contacts, pooling) must run with
no sheet, canvas or document. 03g makes this structural: the logic is the server's and the drawing is the
client's, so Tenkai's `Actor` is the logic side only (a body in a `World`, a `Motion`, a `StateMachine`, no
`Entity`), and an `ActorView` (an `Entity` that follows an actor's reported state, interpolated between ticks)
is the drawing side. The same `Actor` runs in the headless checks, in Tenkai's specs, in the browser through the
loopback transport, and in the Node server.

## What moves, what stays

The line is not "rules stay, drawing moves". Most of what the remake's characters are made of is general
machinery that a game engine should own; only the decisions are Wreckers'. The test for each piece: would
another game need the same mechanism with different data or different decisions? Then it goes into Tenkai.

### The classes

Tenkai's classes today: `Entity` (a drawn thing: a tile of a sheet or an image, a transform, children,
animation clips; `Video` extends it), `Scene` and its kinds (`Background`, `Buffered`, `Tiled`, `Indexed`,
`Isometric`), `IsometricWorld` (bodies, colliders, regions, `move`), `GameEngine`, and the stand-alone
helpers (`Sheet`, `BitmapFont`, `Palette`, `IndexedSurface`, `Hotspots`, `Cursor`, `Input`, `SoundManager`,
`StartScreen`). Three games have built their own actor around `Entity` because Tenkai has none: 1945's
`actor.js`, Golden Axe's `sprite.js` and `fighter.js`, and Wreckers' records (a record, a world body and a
view entity kept in step by hand in `main.js`). That is the class to add, and the rest follows from it.

```
Logic (the server's; runs with no DOM)

Agent                       a thing with tick(commands), snapshot(), restore(snapshot)                NEW (interface)
  Actor                     + a body in a World; a Motion; a StateMachine of behaviours; contact       NEW
                              events; facing; no Entity, no sheet
    Projectile              + a lifetime; hits bodies or walls, then bursts                          NEW
    (games)                 Wreckers: Officer, Droid > Fighter | Cleaner | Medic, Alien, Plasmozomb, Shot
                            Golden Axe: Fighter; 1945: its actor; Tim: the cat
  (games)                   Wreckers: Lift, Door, Bulb, Systems, Waves, Factory, Score, GameClock, ...

Place                       one place: its own World, its agents in phase order, its own Random        NEW
                              (seeded from the game's seed and its number); tick, snapshot, restore;
                              reports what happened, knows nothing of players or other places
                            Wreckers: Station
GameState                   the whole game: places ticked in a fixed order, players (each in a place),  NEW
                              a clock and a tick count, the game's own rules; tick(commands) routes
                              each player's commands to their place; snapshot, restore,
                              diff(previous); the tick's events out, addressed to all, a place or one
                            Wreckers: Sector (holds the stations, the shared score, win and loss)

World                       bodies, colliders, regions, move; contact events to both bodies; nearest   NEW (abstract)
                              and sight-line queries; a Population (pooling) hook
  IsometricWorld            (exists; becomes a World with its projection and depth)
  (later) TileWorld         a tile map's solidity as a world, for Tim and Golden Axe

Motion                      the script runner: a table (animation, command) -> scripts of steps; a     DONE (from Mover)
                              step moves the body, names a frame, is tested by the World, holds when
                              blocked; scripts end with events; ghost and carried modes
StateMachine, Behaviour     states with enter, tick, exit and hold counters; behaviours composed onto    NEW
                              an Actor's states (plain objects, not the old Mixin)
Population                  characters as data everywhere, live Actors only near the view, taken in    NEW
                              and put away as it moves; coarse off-screen updates in rotation
Random                      a seedable generator                                                       NEW

Server and client

GameServer                  owns a GameState and a clock; ticks at the logic rate, always; up to N     NEW
                              connections, each a numbered player; collects each tick's commands in
                              player order; sends a snapshot on join and a delta plus events per tick
                              to each player, the player's own place in full; runs in the page, in a
                              Worker, or under Node
GameClient                  written against the WebSocket surface only: a socket, a player number,     NEW
                              a command queue stamped with the tick, the last two states,
                              interpolation between them for drawing, its events to sound and screens
LocalSocket                 a connection to a GameServer in the same page with the browser             NEW
                              WebSocket's surface (send, onopen, onmessage, onclose, onerror, close,
                              readyState); strings both ways, delivered on a later task
WorkerSocket                the same surface over a Worker's message port                              NEW
                            (a real WebSocket needs no class: GameClient is given one)

View (the client's)

Entity                      a drawn thing: sheet or image, transform, children, animation clips  (exists)
  Video                                                                                           (exists)
  ActorView                 + follows one actor's reported state, interpolated between ticks,         NEW
                              with depth from its position

Scene                       a drawn layer                                                              (exists)
  Screen                    + takes keys and clicks first while on top; says what of the HUD shows;     NEW
                              the engine keeps a stack (a screen never stops a GameServer's clock)
  IndexedScene              + palette regions (different palettes for ranges of lines)                  extend
GameEngine                  + the Screen stack; a GameClient as an option for games behind a server    extend
IndexedSurface              + blits (opaque, masked, recoloured), lines, plane masks; palette fades     extend
BitmapFont                  + glyph indexes, opaque or ink-only cells, fixed advances, a cursor,        extend
                              typed-out text
Hotspots                    + groups switched together, routed through the Screen stack                extend
SoundManager                + voices: fixed channels where a new sound replaces the old, priorities    extend
```

Every "extend" is a new option or method whose absence leaves the class as it is. `World` is the one
structural change: `IsometricWorld` keeps its API and gains a parent; nothing calling it changes. A
single-page game (every example and port today) uses `GameServer` and `GameClient` through `LocalSocket` in the
same page, or ignores them and ticks its agents itself; nothing obliges a game to have a server.

| Mechanism (Tenkai) | Today in Wreckers | Decisions (stay in Wreckers) |
|---|---|---|
| `Actor`, `ActorView` | records + bodies + view entities synced in `Wreckers.js` (`showAliens`, `showDroids`, the officer's `from`/`last`) | each character's sheet, size, colours |
| `Agent`, `Place`, `GameState` | fields of `Wreckers`, `Droids`, `Aliens`, the world's bodies; `SaveGame` reading 25 fields | `Station`: which agents, in the original's phase order; `Sector`: the stations, the shared score, when the game is lost |
| `GameServer`, `GameClient`, `LocalSocket` | nothing: the page is the game | the messages (a player's stick, fire, orders, factory choices; sounds, texts, score); which officer a player is (03g section 6) |
| `Motion` | `Mover`, used by all three kinds | the original's script tables and event numbers (`remake/data/`) |
| `StateMachine`, `Behaviour` | `onScreen`'s switch, `Aliens`' states, the officer's flags | the classes and mixins below, the original's transitions and numbers |
| `World` contact events | `StationRules`' handlers, `Droids`' and `Aliens`' `bump` | the characters' bump answers, the door and lift rules |
| `Place` tick phases | `StationTick` calling each module in turn | the phase list and order (the original's main loop) |
| `Population` | `takeNear`, `releaseFar`, `offScreen`, the pool records | pool sizes, the view's reach, what off-screen characters do |
| `World` sight lines | `fight`'s `nearest` and `LOOKS` | who counts as a target |
| `Projectile` | `Shots` | damage tables, burst rules |

### Wreckers' characters as classes, sharing behaviour through mixins

The remake gets a class for each kind of character, built on Tenkai's actor, with what several kinds do in
common written once as a Wreckers mixin and composed onto each class that needs it. Today that sharing is
done by hand: the droids' queue code in `droids.js` serves all eight models; the officer's lift riding in
`main.js` and `lifts.js` repeats boarding and riding; walking towards a point (`towards`) is shared by
reaching into `aliens.js`.

| Class | Mixins (Wreckers) |
|---|---|
| `Officer` (Tweddell, Hambleton, Knight) | RidesLifts, Shoots, Rests (cryo pods), Falls (collapse, corpse, rise), Breathes (outside: suit, oxygen) |
| `Droid`, with `Fighter` (models 1-6), `Cleaner`, `Medic` | Walks (towards a point, one axis then the other), FollowsRoute (zone graph), QueuesForLift, RidesLifts, Patrols, Retreats, Recharges (the pad), Falls (destroyed spin); `Fighter`: Shoots, GoesRogue; `Cleaner`: Swallows; `Medic`: Tends |
| `Alien` (one class; its states are the original's: falling as a spore, eating the hull, wandering, migrating, hunting in the big form, dying) | Walks, FollowsRoute (stepping over the elevator), Spits (hunting), Sprouts (landing), SwarmsSystems (wearing a system down) |
| `Plasmozomb` (a dead officer, entities 11-13: the jelly monster) | Walks, Hunts, Grabs |
| `Shot` | Flies, Bursts |

Which droids queue for lifts: all eight models, so QueuesForLift goes on `Droid`. Who rides: droids and the
officer, but by different code in the original (droids queue for car 0 and board through the shaft floor,
`droids.js`; the officer boards any car by standing in its doorway, `lifts.js` with `main.js`'s `liftTick`),
so RidesLifts is shared only as far as the original's routines are the same (being carried, arrival, getting
off); the rest stays in each class. The car's rules (follow the officer only while no droid heads the queue)
stay in the lift system, which both talk to. Aliens never use the lifts.

Each class also has its off-screen form (`offScreen` in `droids.js`, the six-a-tick coarse updates in
`aliens.js`): the same states run by coarser rules while the character has no record. Those go into the same
classes and mixins as the "away" side of each behaviour, not into a separate system.

The mixins keep the original's order of work exactly: where a behaviour draws random numbers, how many and
in what order, is part of it, and the tick's phases still run the actors in slot order. They are extracted
from the code as it stands, one at a time, with the station traces checked at each.

Tenkai provides the means, not these behaviours: the `Actor`, a state machine, and a way to compose
behaviour mixins onto actor classes (a small, explicit one: Tenkai's old `Mixin` copies bound methods and is
due to be replaced in phase 2). If another game later needs one of Wreckers' mixins (a lift queue, a route
over a zone graph), it is promoted into Tenkai then, with that game as the second user.

### Screens: built on Tenkai

| Files | Keeps | Gives up to Tenkai |
|---|---|---|
| `menu.js`, `scanner.js`, `screens.js`, `terminals.js` | layouts, rules, texts | the `ViewPicture` buffer, font drawing, hotspot tests, show/hide flags |
| `ending.js`, `title.js`, `indexed.js` | the sequences and their timing | the indexed 320 x 200 screen, palette fades, fonts |
| `hud.js`, `slots.js`, `ticker.js`, `archive.js` | what the HUD shows | the palette split at line 135, recolouring, the clipped text window |
| the commander screen, bulb console, factory desk, the Battlepod's view | what is drawn | their own canvases and hit tests |
| `sound.js` | the effect and tune tables, the original's channel rules | voice channels with "a new sound replaces the old" |

### The station and the glue

- `lifts.js`, `doors.js`, `bulbs.js`, `factory.js`: the cars become actors (they carry riders: the motion
  system's carried mode) in a lift system; the doors are map tiles patched over eight pictures and stay a
  station system, as do the bulbs and the factory, all ticked in their phase.
- `Wreckers.js` (about 1,900 lines) goes down to the game's set-up and wiring (03g section 2 says where the rest
  goes).
- `ScreenText.js`, `Speech.js` (what is said), the data and its tools: stay. `SaveGame.js` goes (03g section 6:
  no saving in a multiplayer game); what it gathered becomes the station's snapshot within the sector's, each
  agent saving and restoring itself, used for joining and for the checks. 1.0.0's save files are retired.

## How Tenkai improves

| Tenkai gains | From | Also helps |
|---|---|---|
| **`Actor`** (logic) and **`ActorView`** (drawn where the actor is, interpolated, with depth) | the records, bodies and view entities | 1945's `actor.js` and Golden Axe's `sprite.js` are already this, each written by hand; Tim's cat; Monkey2's actors |
| **`Agent`, `Place`, `GameState`** with tick, snapshot and restore | the fields of three classes, `SaveGame` | games with several places (levels, rooms, maps) ticking at once; joining a running game; saves where a game wants them; headless checks and specs for any game's logic |
| **`GameServer`, `GameClient`, `LocalSocket`, `WorkerSocket`** (one WebSocket-shaped interface) | nothing: the page is the game | multiplayer for any game (Wreckers: three officers, three players); a headless server for checks; a native client later; any game that wants its logic off the page |
| **Motion scripts** with collision-tested steps and events | `Mover` | Golden Axe (moves with root motion), Tim (hops), Monkey2 (walk boxes) |
| **`StateMachine` and `Behaviour`** | the state switches | Golden Axe's fighters (idle, walk, attack, hit, fall are a state machine in `fighter.js`), 1945's enemies, every game's NPCs |
| **`World`** as a base with contact events | `rules.js`, the `bump`s; `IsometricWorld` as its first kind | a `TileWorld` later gives Tim and Golden Axe the same bodies and contacts |
| **Ordered agents and phases** on the logic tick | `tick.js` | any port that must match an original tick for tick (Golden Axe, Monkey2) |
| **`Population`** | take, release, off-screen | open or large worlds; any game with many characters |
| **Sight lines and nearest queries** on worlds | `fight`, `nearest` | shooters, stealth, AI generally |
| **`Screen`** (a `Scene` that takes input) and the engine's stack | `main.js`'s flags | Golden Axe (title, map, game over), Tim's editor, 1945's title and game over, Monkey2's own screens |
| **Indexed drawing and palette regions** | `ViewPicture`, `indexed.js`, the HUD | Monkey2, any palette game |
| **Fonts:** glyph indexes, opaque or ink-only cells, fixed advances, typed-out text | five font codes | Monkey2, Golden Axe |
| **Hotspots with groups** | hand-written rectangles | Myst, Monkey2 |
| **Interpolation between two states** (`ActorView`; the old `logicRate` idea, on the client) | `moveClock`, `STEP` | Golden Axe (arcade 60 Hz logic at any display rate) |
| **Sound voices, seeded random** | `sound.js`, `Math.random` | most games |
| Done in this phase: `StartScreen`, `TenkaiLogo`, `Input` keys in several actions, `IsometricWorld` overlap, `tools/frames/` | | every game |

Not for Tenkai: the original's decisions, numbers, tables, random number generator, text expansion and
screen layouts, and the Amiga reverse-engineering tools (`local/amiga-tools/`).

A note on 3a: it took movement out of animation clips ("movement belongs in game logic"). Motion scripts do
not undo that: clips stay pure animation; a motion script is logic that moves a body step by step and names
the frame to show, run by the logic tick, not by the animation clock.

## What Tenkai gains at each step of 03g's order

The order of work is 03g's "Order". This is what `lib/` gains at each of its steps, each with specs and API docs,
and which other games are then reviewed for it (adopted only where it removes code without changing what they do,
each with its own baseline check).

| 03g step | Tenkai gains | Then reviewed in |
|---|---|---|
| Before 03g (done) | `Motion` (from `Mover`), `StartScreen`, `TenkaiLogo`, `Input` keys in several actions, `IsometricWorld` overlap, `tools/frames/` | every game has the start screen and baselines; Golden Axe and Tim still to go onto `Motion` |
| 1. Constants out of the code | nothing in `lib/`; `lib/` is checked against the same rules (one class per file, no free functions, data named for what it is) | |
| 2. Agents, stations and the sector | `Agent`, `Place` (with its tick phases in an order and its own seeded `Random`), `GameState` (places, players, commands in, events out); `World` over `IsometricWorld` with contact events, nearest and sight-line queries; `Actor` on `World` with `StateMachine`, `Behaviour` and a way to compose behaviour mixins; `Projectile`; `Population` | 1945's `actor.js`, Golden Axe's `sprite.js` and `fighter.js`, Tim's cat and Monkey2's actors onto `Actor`; Monkey2's rooms and Golden Axe's stages as places; snapshots anywhere a game wants a save or a check |
| 3. The engine behind a socket, in the browser (the main milestone) | `GameServer`, `GameClient` (against the WebSocket surface only), `LocalSocket`; `ActorView` interpolating between the last two states (this is 03f's old `GameEngine.logicRate` idea, done on the client side) | Golden Axe (arcade 60 Hz logic at any display rate) |
| 4. Worker, then Node and a real WebSocket | `WorkerSocket`, a Node entry point for `GameServer` serving real WebSocket connections; the frames tool's connection option | any game run headless for its checks |
| 5. Three players | players on `GameServer` (numbers, join and leave, refusal past N, events per player and per place, commands in player order), several `GameClient`s in one page for the frame scripts | Golden Axe's two-player mode; any game with more than one player |
| 6. Client work | `Screen` and the engine's stack; `IndexedScene` palette regions; `IndexedSurface` blits, lines, masks, fades; `BitmapFont` glyph indexes, cells, advances, typed-out text; `Hotspots` groups; `SoundManager` voices | Golden Axe and 1945 (title, game over), Tim's editor, Monkey2 (screens, indexed drawing, fonts, hotspots), Myst (hotspots) |

The station and move checks matter most in step 2: they prove the random numbers and the order of work are
untouched while the classes change shape. Expected result: the rules files down to their decisions, `Wreckers.js`
down to set-up and wiring, the screens down to their layouts and behaviour.

## Status

**Since 2026-10-11 (the user):** fidelity work is over ("we're beyond fidelity now", "no need for any more
fidelity tests"). No new checks against the original or the emulator. The gate is the frame baselines (the remake
against itself); the station and move checks (Node, seconds) still run as quick regression checks. Changes that
improve on the original go in, with any baseline they alter re-saved on purpose (03e lists them). Keep effort
proportionate: build, show in the user's tab, refine. The end state and the order of work are 03g's (2026-10-11).

**Done:**

- Determinism and baselines: `tools/frames/` (headless frame baselines on a virtual clock) for every game. Scripts run inside the
  page (`tools/frames/runner.js`): steps with goals (`press` ... `until`, `wait`, `check`, `do`, `eval`, a
  `prelude`), page events sent as Chrome sends them; one call per script; live in a visible tab through
  `tools/frames/serve.mjs` (port 8070) and `__framesRunner.live(script)`. Web Audio pinned at 48000 Hz and its
  real contexts suspended (no load on coreaudiod); a page reloading mid-run resumes.
- Motion scripts: `lib/Motion.js`; Wreckers' `Mover` (`remake/src/Mover.js`) is a subclass.
- The droid-fire fix and the officer dossier (03d), three improvements (03e).
- Structure: one class per file, named after it, in `remake/src` (`main.js` is only the entry point; the game is
  `Wreckers.js`); the free-function modules are classes (`StationRules`, `StationTick`, `SaveGame`, `JsonFile`,
  `ScreenText`, `BackBuffer`, `OriginalFont`, `AmigaColour`, `FrontendAssets`, `IndexedGlyphs`; the high score
  rules are `HiScores` statics; the terminal helpers `TerminalScreen` statics); the dead `ConsoleCounter` went;
  `StatBars` is shared by the information screen and the dossier.
- Inversion of control so far: the collaborators `Wreckers` patched in after construction are constructor
  arguments (`Lifts`' droid queue, `Aliens`' droids and cleaner); `PlayerOfficer` (stats, hits, death, corpse,
  shots, targets, how the drawing sees him) is out of `Wreckers`, and the station check uses it instead of its
  own stand-in.

**Baselines:** every Wreckers baseline was identical after the last inversion-of-control change. Since then the droid faces
moved one pixel right (03e), so all Wreckers baselines but `consoles` need re-saving once (`consoles` was
re-saved for the factory text, before the faces moved, so it needs it too): `node tools/frames/frames.mjs save
local/wreckers/frames/*[!e].json` (run two or three at a time; the user's laptop overheated with more).

**Next:** 03g's order, step 1 (the constants out of the code), starting with `Outside.js`. The rest of the
inversion-of-control work (`StationRules` and `StationTick` given only what they use, the string event bus into
the tick's event list, the god classes into agents) is 03g's step 2, which begins by removing pause and the saves.

**Known differences kept for now:** `Aliens`' `droids()` lists all records in the station check but leaves out
destroyed droids in the game; the game's corpse callback also reports a risen corpse, the check's does not.

**Running:** Wreckers' dev server: `tail -f /dev/null | npx esbuild local/wreckers/remake/src/main.js
local/wreckers/remake/src/check.js --bundle --format=esm --outdir=local/wreckers/remake/out
--servedir=local/wreckers/remake --serve=127.0.0.1:8052` from the repository root (esbuild stops when its
input closes). The other games' commands are in their READMEs and LOCAL-ONLY.md files. Lint the remake from a
copy outside `local/` (standard honours `.gitignore`).

**Lessons:** on this case-insensitive disk, writing `Aliens.js` overwrites `aliens.js`; delete the old file
before writing the new one when only the case changes (the splitter in a session's temp folder was fixed for
this). A class split out of a file that used a sibling class needs an import for it.
