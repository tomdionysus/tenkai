# Phase 3g: Wreckers as a remake: its own code, agents, a game engine behind a socket, three players

Wreckers 1.0.0 was built by reading the original's 68000 code and reproducing it. That was right for fidelity, and
fidelity is over ([03d](03d-wreckers.md), the user, 2026-10-11). What is left in the code from that way of working
now stands in the way of a remake: the source still speaks in the original's addresses, three classes do most of
the game, and the state is spread through them so that only the browser page can run it.

**The end goal (the user, 2026-10-12): multiplayer Wreckers over WebSockets, up to three players, one per officer.**
Tweddell, Hambleton and Knight are played at once instead of in turn. A game may hold several stations.

**The main milestone on the way: a game engine in the browser behind one interface shaped like a WebSocket.** The
client connects to it, as it would to a server, and the game is playable. Moving the engine to a Worker or a Node
server later changes where it runs, not what the client does.

The goals, each making the next possible:

1. **No 68k constants or data in the code.** Every number, table and name comes from what it means in the game, kept
   by the class that uses it, or in a JSON file that class loads when the data is large or baroque.
2. **No god classes.** The game is small classes, each owning one thing, built with inversion of control (the rules
   of [03f](03f-wreckers-on-tenkai.md)).
3. **Agents own their state.** Each character, car, door, bulb and system holds its own state and is ticked. A
   station is the set of agents in one place; the game is its stations, its players and its clock. The game takes
   commands and reports events, and has no canvas, document or sound.
4. **The engine behind a socket.** The game runs behind a WebSocket-shaped stream; the browser page is a client of
   it, first in the same page, later across a real socket.
5. **Three players.** Each client is one officer; the game runs for all of them.

A one-player game is the 1.0.0 game with one player connected, so nothing is lost on the way; but the features that
only make sense for one player at a controllable clock go: **pause, quick save and load, file save and load, and the
menu's RS, RL, S and L.** The game runs at its own clock and stops for no one. Section 6 lists what else changes.

## Where it stands (2026-10-12)

- **Addresses in the source:** about 1,450 references of the forms `F_1D72`, `$18F6A` and `0x...` in 62 files of
  `remake/src` (the test scripts included). Most are in comments that say where a rule came from; a share are
  tables typed in from the disassembly with the address as their only name (`Outside.js`: `TARGET`, `FACE`,
  `FRAMES`, `BOB`, `AHEAD`, `NOZZLE`, `JET`, `CATCH`, `STRUGGLE`; `Droids.js`: `LOOKS`, `BOB`, `queuePoint`,
  `PUT_OFF` and the state numbers `0x0a`-`0x11`; `Aliens.js`: `SYSTEMS` with message bases; `Wreckers.js`: `SLOTS`,
  `DIRECTIONS`; the screens: text offsets, colour tables, layout positions). Tenkai's `lib/`, the examples and the
  other ports have none.
- **Data already outside the code:** 48 files in `remake/data/` (JSON and PNG, 335 KB of JSON), exported by
  `tools/`. They are loaded in one place, `Wreckers.init`, and handed around as `data` objects.
- **God classes:** `Wreckers.js` (1,895 lines, about 85 members: set-up, the player officer's lift riding and
  camera, every screen's switching, input, save and load, the hatch and Battlepod transitions, the syncing of
  bodies to entities), `Droids.js` (1,054: eight models' behaviour, the elevator queue, the doctor, the cleaner,
  the pad, targeting), `Aliens.js` (858: entities, waves, spores, the on- and off-screen AI, the plasmozomb, the
  systems and the self-destruct), `Screens.js` (651). The work under 03f has begun on `Wreckers` (`PlayerOfficer`,
  `StationRules`, `StationTick`, `SaveGame` are out).
- **State:** spread over those classes as fields, plus the `IsometricWorld`'s bodies, `Mover`s and the view's
  entities. `SaveGame` gathers 25 fields of the game to make a save; the station check (`tools/checks/station.js`)
  builds a stand-in game by hand to run the same classes in Node. Both are evidence that the state can be gathered,
  and that it is not yet one thing.
- **One player, one station everywhere:** the officer is `this.body` and `this.player` of `Wreckers`; the camera,
  the input, the HUD, the streaming of aliens and droids near "the view", the aliens' targeting (`officer()`), the
  lifts' "come to the player" rule, the cryo pods, the hatches and the Battlepod all assume him. The map, the world,
  the wave clock, the systems and the self-destruct are single fields of the game, so there is room for one
  station only.
- **Already right for this phase:** the logic ticks run headless (the station and move checks); the random
  generator is the game's own (`Random.js`, seedable); the frame baselines (`tools/frames/`) prove any
  restructuring keeps behaviour.

## 1. Rid the code of 68k constants and data

The rule: the source names things by what they are in the game. An address is provenance, and provenance belongs in
the notes, not in the code.

- **Comments.** A rule's comment says what the rule is, not where it was read. `// Plasmozombs take no harm until a
  lull finds no aliens and no spores left ($18F92)` becomes the same sentence without the address. Where the
  provenance is worth keeping, it goes into `notes/<subject>.md` under the class's name (a "Sources" table per class:
  rule, routine, address), so the link from code to listing is one hop away, kept by the notes, and `names.txt` still
  maps addresses to names. Nothing about the original is lost; it moves out of the code.
- **Tables typed in from the disassembly.** Each becomes a named member of the class that uses it, with a name and a
  comment that say what it is in the game's terms (`Outside.js`'s `$23D2` table is the jetpack's target velocity per
  stick direction; `Droids.js`'s `$18DF2` is the order a droid checks its lines of sight). Small tables stay as class
  statics or constructor fields. Large or baroque ones (frame tables, layouts, colour tables, the text offsets of
  the screens, anything a tool exports) go into `remake/data/` as JSON named after the class (`Outside.json`,
  `Droids.json`...), one file per class, loaded by that class.
- **Magic numbers.** State numbers (`0x0a`, `0x11`, `0xff`), flag bits (`& 0x7f`, `>> 4`, bit 14 of `x0`), record
  layouts (`e`, `f`, "record +$1C") and the packed encodings of the original (an animation's facing in its low two
  bits, the big form in bit 2, the mirrored frame in bit 7) become named constants, enums or fields of the class
  concerned. Where a packed byte is only packed because the original packed it, it is unpacked into fields.
- **Loading.** `Wreckers.init` stops loading every file and passing `data` bags around. A class declares what it
  loads (a static `files` list or a `load(loader)` method); it is given a loader (inversion of control: a `JsonFile`
  for the browser, a file reader for Node and the checks), and builds itself from its own file. The engine, the
  station check and the specs load the same files the same way. A station's own data (map, world, occluders,
  entry points) is loaded per station, so a second station can have different data.
- **The data files.** Their keys follow the same rule: `aliens.json`'s `table`, `zombie`, `e`, `f` and the rest get
  game names; the export tools (`tools/*.py`, `remake_assets.mjs`) are changed to write them, since the files are
  regenerated from the disk, never edited by hand.
- **Gate.** `basemind code grep` for `F_[0-9A-F]{4,5}|\$[0-9A-F]{3,5}\b` over `remake/src` and `remake/data` returns
  nothing; every frame baseline identical. A lint rule (`no-amiga-addresses`, a small `standard` plugin or a script in
  `tools/`) keeps it so.

## 2. Break up the god classes

Continues the structure and inversion-of-control work begun under 03f (one class per file and the free-function
modules as classes are done; `PlayerOfficer` is out of `Wreckers`), with the end state made explicit. The test for
a class: it has one reason to change, it can be built in a spec with stand-ins, and it holds its own state
(section 3). Still to do from that work, before or alongside the splits below: `StationRules` and `StationTick`
given only what they use (rules need `lifts`, `power`, `useHatch`, `inPod`, `droids`; the tick needs the
station's parts and the officers' phase calls) instead of the whole `Wreckers`; the string event bus
(`Wreckers.event(name, data)`) into the tick's event list (section 3); `window.game` kept only as a debugging
handle.

| Today | Becomes |
|---|---|
| `Wreckers` (set-up, player officer, screens, input, saving, hatches, Battlepod, camera, syncing) | `Wreckers` (the client: set-up and wiring only); `Officer` (one officer: an agent of the station he is on, built from `PlayerOfficer`, one per player, section 6); `GameKeys` (keys to commands, client); `ScreenModes` (which screen is up, client, until Tenkai's Screen stack, step 6); `Hatches` (the hatch, outside and Battlepod transitions, per officer, in the station); `Camera` (client, following its own officer); `SaveGame` goes (section 6); the body-to-entity syncing goes to the client's views (section 4) |
| `Droids` | `Droid` (one droid: its state, stats, orders, walking), `DroidFleet` (a station's ten slots, the cursor of off-screen updates), `DroidLiftQueue`, `Doctor`, `Cleaner`, `RechargePad`, `Targeting` (the line tests shared with the aliens and the officers) |
| `Aliens` | `Alien` (one entity's state and AI, on and off screen), `AlienHorde` (a station's 256 entities, the live records, streaming), `Waves` (the wave clock, spores in flight, landings), `Plasmozomb`, `Systems` (the four levels, the self-destruct clock, the messages) |
| `Screens` | the input side (`ScreenInput`) and the drawing side (`MapScreen`, `InfoScreen`), with `ScreenText` already out; all client |
| `StationTick` | stays, as one station's list of phases in the original's order, now calling agents (section 3), with the officers' phases run for each officer on that station in player order |

Each move: one class out, its spec written with stand-ins, every gate identical, commit. The 03f table of Wreckers
character classes and mixins (Officer, Droid > Fighter | Cleaner | Medic, Alien, Plasmozomb, Shot; Walks,
FollowsRoute, QueuesForLift, RidesLifts...) is the target shape for the characters.

## 3. Agents, stations and the game

The original's design is a main loop over tables for one station. The remake's design is agents, grouped into
stations, held by a game.

```
Sector (Wreckers' game, in its Node server)
  clock, tick count, seed
  players: up to 3, each { number, name, officer, station }
  score (shared), the rules for winning and losing
  stations: [Station, ...] ticked in a fixed order
    Station
      its data (map, world: regions and colliders, occluders, entry points)
      its Random, seeded from the sector's seed and the station's number
      agents in the original's phase order:
        officers on board, droid fleet, alien horde, waves, systems and self-destruct,
        lifts, doors, bulbs, factory, shots, message queue, cryo pods (sleepers)
```

- **Agents** each have `tick()`, `snapshot()` and `restore(snapshot)`. Actors (the officers, droids, aliens,
  plasmozombs, shots) hold position, facing, animation and step, stats, their current script and state machine,
  and nothing about drawing; they are Wreckers' own classes in its server code, on Tenkai's `Motion` and
  `IsometricWorld` used as a library (Tenkai is a client-side framework: 03f).
  Agents that are not characters (the five cars, the twelve doors, the four bulbs, the factory's builds, the
  systems, the wave clock, the message queue, the sleepers) hold the rest.
- **A station** is one place: its own data, its own world, its own agents and its own random generator. It ticks
  its agents in the original's order and reports what happened. It knows nothing of players, the score or other
  stations. 1.0.0's Beacon 04523N is the first station; a game may hold more, with the same data or other data.
- **Random numbers per station.** Each station's `Random` is seeded from the sector's seed and the station's number,
  so adding or removing a station never changes another station's sequence, and the station checks hold for any
  one station run on its own.
- **The sector** (Wreckers' name for the game; the station is one beacon in space) holds the stations, the players,
  the clock and the score. `Sector.tick(commands)` is the whole game: it routes each player's commands to the
  station that player's officer is on, ticks every station in a fixed order, and applies the game's rules to what
  they report. It has no reference to a canvas, a document, a sound manager or a screen, and nothing it does waits
  for a client: no screen freezes it, no key stops it.
- **The game's rules** sit in the sector, not the stations: a station reports that it was lost (its self-destruct,
  a bulb exploding) and the sector decides whether the game ends (with one station, as 1.0.0: yes). Score events
  from every station add to the one score. Promotion (once a lull with the station clear) is per station and adds
  to the officer's rank.
- **Moving between stations** is a sector operation: an officer's actor is taken out of one station's world and put
  into another's, at an entry point. Nothing in 1.0.0 does this; the hook is there so that a second station is
  reachable (by the Battlepod, a shuttle, or a menu; the user's call when there is a second station).
- **Events out.** What the drawing and sound need but cannot read from the state (a sound started, a message
  queued, a score change, a screen to open) comes out of the tick as a list of events, each tagged with its station
  and addressed to all players, the players on that station, or one player. Today's `emit(name, data)` string bus
  becomes that list.
- **Snapshots** of the sector are its stations' and players' snapshots. They are how a client joins (a snapshot,
  then deltas), how the checks compare states, and how a game could be recovered. Not a save game feature (that
  goes, section 6); 1.0.0's save format is retired.
- **Two couplings fixed on the way.** Streaming (which aliens and droids have live records) depends on "the view":
  the original's camera is a fixed offset from the officer, so a station computes each of its officers' views
  itself and streams near any of them. The station noise effect draws from the aliens' random generator while it
  draws (`StationTick.drawNoise`); behind a socket that would change the order of random numbers, so the noise is
  decided in the station's tick and reported as state.
- **The station check** stops building a stand-in game: it builds one `Station` from the same classes and data
  files and compares its snapshots with the traces. One construction path for the game, the engine, the checks and
  the specs.
- **Gate:** a `Sector` with one station runs a scripted game headless in Node with no DOM shim, and its snapshot
  after N ticks equals the browser's after the same commands (a new check, `tools/checks/snapshot.js`); a sector
  with two stations of the same data and different seeds ticks both, and each station's snapshot equals that
  station run alone; frame baselines identical.

## 4. The engine behind a socket, in the browser (the main milestone)

With the state in the sector, the engine is the sector, its clock and its connections, behind one interface. The
client does not touch the sector; it opens a connection.

- **The interface is a WebSocket's shape.** The engine gives each client an object with the browser `WebSocket`'s
  own surface: `send(string)`, `onopen`, `onmessage` (an event whose `data` is a string), `onclose`, `onerror`,
  `close()` and `readyState`. `GameClient` is written against that surface only, so the same client code connects
  to the engine in the page and, later, to a real `WebSocket`; changing it is changing which object is passed in.
- **Strings both ways, even in the page.** Every message is serialised to JSON and parsed on the other side, so the
  client can never read or change the engine's live objects by reference. The in-page engine proves the boundary
  a network needs, and anything that would not survive the network fails here first.
- **Asynchronous delivery, even in the page.** Messages are delivered on a later task (a `MessageChannel` or a
  microtask), never inside `send`, as a socket would. The engine ticks on its own clock, not on the client's frames.
- **Messages.**
  - Client to engine: `join` (a name, an officer wanted), `command` (the tick it is for, the stick, fire, keys,
    an order to a droid, a factory choice), `leave`, `scores`.
  - Engine to client: `welcome` (the player's number, the officer, the sector snapshot), `tick` (the tick number,
    the delta since the last, the events for this player), `refused` (with a reason), `scores`, `over`.
- **What a client receives.** The station its officer is on in full (in the delta), the sector's shared state (score,
  clock, players and which station each is on), and from other stations only what it shows (the scanner, the HUD's
  droid slots if they are another station's); a wire format small enough not to matter, JSON, binary only if
  measured.
- **Commands are applied in player order** at the tick they name, so the same commands give the same sector
  anywhere (the snapshot check). A late command is applied at the next tick.
- **The client** (`Wreckers`, now a client): connects, sends its player's commands from `GameKeys` and its screens,
  keeps the last two states, draws its own officer's station through `ActorView`s interpolated between them, plays
  sounds and the ticker from its events, and opens screens (map, info, archive, scanner, factory desk, terminals,
  the letter) as client UI over the running game.
- **Tenkai** keeps the client's part (03f): `GameClient`, written against the WebSocket surface. The server
  (`GameServer`, the game state, the socket server) is Wreckers' own code, run only in Node.
- **Gate (the milestone):** the game is playable in the browser with the client connected through `LocalSocket`;
  every frame baseline identical (one player, one station; re-saved once in step 2 for the features removed); the
  snapshot check passes.

## 5. Elsewhere: a Worker, then a real WebSocket

Small steps once section 4 holds, since the client code does not change.

- **Worker.** The engine moves into a Web Worker; the client's connection is a WebSocket-shaped wrapper over the
  Worker's message port. Frame baselines identical.
- **Node server.** The same engine under Node (`ws`), serving the game's data files and accepting real
  `WebSocket` connections; the client is given `new WebSocket(url)` instead of a `LocalSocket`. The server owns the
  high score file. The frames tool gains a connection option, and the frame scripts run against the server with
  their hashes compared.

## 6. Three players

One sector, up to three clients, each one of the three officers. The original's turn-taking (one controllable
officer, the other two asleep until he dies or rests) becomes everyone at once. The rules below are the simplest
reading of the original that works for three, proposed for the user to confirm or change (not yet confirmed).

- **Joining.** A client connects and takes a free officer: the commander screen becomes the lobby (a client picks
  Tweddell, Hambleton or Knight from those not taken; the dossier still shows). The officer wakes in his pod on his
  station as in 1.0.0. Officers nobody has taken sleep in their pods, recovering as the original's sleepers do; a
  client joining a running game wakes one. A fourth client is refused (watching, later).
- **Per player:** the stick, fire and the keys; the camera and view; the HUD's lifeforce and the ticker (messages to
  everyone on the station, personal ones such as "POWER LEVELS ARE TOO LOW" to one); the screens; the hatches,
  lifts, cryo pods, consoles, terminals, the factory desk, the outside and the Battlepod, each by the original's
  per-officer rules, with the shared things (a lift car, a bay, the factory) first come first served.
- **Per station:** the aliens, the systems and their LEDs, the self-destruct clock, the droid fleet (any player on
  board may order any of its droids; the HUD slots show the fleet of the station the player is on).
- **Per sector:** the score, the players, the high score table.
- **Rules that named "the officer"** become rules over the officers on the station: aliens take the big form and
  spit when any is within reach and target the nearest; the lifts come to the nearest idle officer; the station
  noise is per client (its officer's zone); live records stream near any officer's view (the pool sizes grow from 8
  aliens and 10 droid records to what three views need, a number to measure: the original's limits were memory,
  not design).
- **Death.** A dead officer becomes his plasmozomb as before; his client watches (the view follows the plasmozomb,
  then the others) until the game ends, or takes a sleeping untaken officer if one is free (the user's call; the
  simplest rule is yes). With all three dead, or a station lost, the end sequence plays on every client and the
  high score is recorded.
- **Resting.** Standing in an open pod puts an officer to sleep (the original's rule); his client is then in the
  lobby and may wake him again or another free officer.
- **Leaving.** A client that disconnects leaves its officer standing until it or another client takes him; the
  engine stops ticking a sector with no clients and discards it after a while.
- **Gone from the game:** pause, quick save and load (K, L), file save and load, the menu's RS, RL, S and L, the
  game freezing under the menu, the factory desk and the promotion letter, and the "press Space to choose another
  officer" wait on death. `GameMenu` keeps NEW (leave to the lobby) and the high score table; `SaveGame` and
  `JsonFile`'s save path go; the controls table in LOCAL-ONLY.md is rewritten.
- **Gate:** the one-player frame baselines identical through all of this; new frame scripts for two and three
  players, each client its own canvas, first all in one page (three `GameClient`s on one `LocalSocket` engine), then
  against the Node server; the station check unchanged.

## The Tenkai side

Tenkai is a client-side framework (the user, 2026-10-12). Wreckers' game, every agent and all the AI, runs in its
own Node server code; Tenkai's part is the client: what it gains from the Wreckers client (screens, a view that
fills the window, drawing between ticks, finding a server, indexed drawing, fonts, hotspots, sound voices), and
the server-side classes that leave `lib/` (`GameServer`, `GameState`, `Place`, the Node socket server, the in-page
and Worker sockets). All of it is in [03f](03f-wreckers-on-tenkai.md).

## Order

Section 1 comes first because it touches every file once and nothing should be read through the addresses after
it. The single-player features that go are removed at the start of step 2, so that no agent is built to support
them. The sector exists from the start of step 2 with one station in it, so nothing is written assuming there is
only one.

1. **Constants out** (section 1), one class at a time, with the notes gaining their Sources tables; the lint rule;
   the data files renamed with their tools. Each class's frame baselines identical after it.
2. **Agents, stations and the sector** (sections 2 and 3), one class at a time. First the removals: pause, the
   saves and the frozen screens go, and their frame baselines are re-saved once. Then a `Sector` holding one
   `Station`, each extracted class an agent of the station (or of the sector) with `tick`, `snapshot`, `restore`
   and a spec. Commands and events replace keys-into-the-game and the string bus. The officer becomes an `Officer`
   agent; the station holds the officers on board (one, for now). Ends with the snapshot check, including the
   two-station case.
3. **The engine behind a socket, in the browser** (section 4): `GameServer`, `GameClient` and `LocalSocket` in
   Tenkai; Wreckers' page becomes a client connected through `LocalSocket`. **The main milestone: playable, and plays
   and looks as before.**
4. **Worker, then Node and a real WebSocket** (section 5).
5. **Three players** (section 6): the lobby, the other two officers joined, the rules over the officers on a
   station, the per-client view and HUD; the two- and three-player frame scripts.
6. **Client work:** 03f's list (the server-side classes out of Tenkai first, then the client's mechanisms into it)
   and 03e's improvements.

A second station with content of its own, and how officers travel to it, is not in this order: the structure
allows it from step 2, and what it is (another beacon, a different map, a reason to go there) is a design for the
user when the rest is done.

## Status

- **Step 1 (2026-10-12): done, with two parts moved.** No address is named anywhere in `remake/src` (wreckers
  commit 44bd282): every comment says what its rule is; the links to the original's routines and tables are in
  `notes/sources/<Class>.md` (`tools/sources.mjs`, from commit 98e0c29). `tools/noaddresses.mjs` keeps it so, and
  `tools/samecode.mjs` showed the pass changed comments only. Moved into step 2, since the same code is rewritten
  there: each class loading its own data, and naming the magic numbers of each class as it becomes an agent.
  Not done: renaming the keys of the data files, which needs the export tools changed and re-run against the
  emulator's captures; until then the classes read the files' keys as they are.
- **Tenkai (2026-10-12):** `Place`, `GameState`, `StateDiff`, `GameServer`, `GameClient` and `LocalSocket` are in
  `lib/` with specs and docs (`docs/api/GameServer.md`), ahead of the Wreckers steps that use them.
- **Step 2 (2026-10-12): done in substance.** Pause, the saves and the menu's RS, RL, S and L are gone (drawn but
  inert); the game freezing under the menu, the factory desk and the letter stays until step 5. The logic tick
  reads one command (`GameKeys`, `Stick`, `Geometry`); the officer is `Officer`; `Station` (a Tenkai `Place`) owns
  and ticks everything in the station, with its own map tiles (`MapTiles`), the player's screens' state
  (`MapScreenState`, `ScreenMode`), `Speech`, the score, the game being over and the self-destruct's clock, and
  raises events instead of calling the page (its one client hook is `emit`, used only in the page). Every part has
  `snapshot` and `restore`; `tools/checks/roundtrip.mjs` restores a running station through JSON into a fresh one and
  runs both on, identical at every tick. The client changes the station only through `Station.act`. Not done from
  section 2's table: `Droids` and `Aliens` are still one class each (no `Droid`, `AlienHorde`, `Waves`...), and
  `Wreckers` is still about 1,350 lines of client.
- **Step 3 (2026-10-12): the milestone, first form.** `Sector` (a Tenkai `GameState`) holds the station and is run
  by a `GameServer` in the page; the page is a `GameClient` on a `LocalSocket` (delivering at once, so ticks land in
  the frame they run), sends what the player holds as input and everything else as actions, and draws from its own
  `Station` restored from the JSON sent after every tick and action. Played through every frame script headless
  and live: walking, firing, the lifts, the outside, the pods, the screens, the factory, death and the end, and the
  Battlepod (`frames/podflight.json`; the old `battlepod` script's walk never reached the bay, before this work
  too). Tenkai gained input and actions on `GameServer`.
- **Step 4 (2026-10-12): done.** `?server=worker` runs the server in a Web Worker on its own clock
  (`server-worker.js`, Tenkai's `WorkerSocket` and `GameServer.attach`); `?server=ws://127.0.0.1:8053/game` reaches
  it under Node (`remake/server.mjs`, Tenkai's `lib/node/WebSocketServer.js`, no dependencies); `ServerLink` picks
  which, and the page draws between ticks by the time since the last one arrived. Played live in headless Chrome
  (`tools/frames/live.mjs`): with the Worker every script ends where it does in the page; under Node the goal-based
  scripts do, and frame-counted key holds end a few ticks on, as a server on its own clock does. The game is held
  under the menu, the commander screen and the letter by a `freeze` action.
- **Step 5 (2026-10-12): playable by two and three, first form.**
  - The station has a crew of three `Officer`s, each with his own mover, outside and lift rider state. There is a
    `PlayerSeat` per player, with its own screens, map and speech. Aliens and droids go for the nearest officer and
    stream near every player's view. Events carry the officer who raised them and go to his player. One player
    alone still plays the original's game tick for tick (the station and move checks, the roundtrip, every frame
    script).
  - `Sector` takes three players and refuses a fourth. The game holds only while every player's screen holds it
    (the menu, the commander screen, the letter): one player alone plays as before, and the others play on around
    a player's menu.
  - The commander screen is the lobby. An officer another player plays shows PLAYER and their number (the large
    font, `GlyphLabel`) and cannot be woken. A player who leaves frees his officer where he stands, and another
    player takes him over there.
  - The client draws every crew member, each with his own entity and colours, between ticks.
  - Checked by `tools/checks/players.mjs` (four clients on one sector: joining, refusal, the lobby, walking apart,
    holding, leaving and taking over), and live against the Node server with `frames/two.json` and
    `tools/checks/second-player.mjs` as the other player.
- **Step 5 continued (2026-10-12): done, with the user's play-testing.**
  - Multiplayer rules settled in play: friendly fire stays; a dead officer stops being solid, dies properly under
    fire (no restarted collapse) and rises as his plasmozomb only when a plasmodian reaches his body (it becomes
    the plasmozomb); a player who leaves a dead officer leaves the body lying; plasmozombs go for the living, are
    hurt by every shot (24 to kill) and say nothing of being vulnerable; a dead player's view stays on the body
    and follows the plasmozomb until a click takes him to the commander screen; the last officer alive is warned.
  - The game's ends: all three dead or the game lost goes to the commander screen, where a choice starts a new
    game; a player joining an ended game, or the last player leaving, gives a new station (numbered, so a page
    sees it and joins at the commander screen); an empty game does not run; stopping the server (Ctrl-C) ends the
    game in every page.
  - Outside: back in through any airlock (an arrow over each while anyone is outside); every officer's spray and
    jet drawn for every player, inside or out.
  - Streaming: each page tells the server its window, and every alien and droid in it (and 64 round it) is on
    screen, the aliens' records no longer limited to eight (`StreamArea`). The off-screen simulation stays for
    the rest of the station: it is what moves aliens between rooms.
  - The officer lost behind the cryo room's front wall: officers are now drawn as faint silhouettes through the
    walls that hide them (Tenkai's `seeThrough`).
  - Gone: the high score table, the score, the menu's dead buttons (only NEW and quit are left).
  - Checked by `tools/checks/players.mjs` (now also deaths, rising, the warning, the game's ends, resets and
    streaming), the station and move checks (identical but for the intended change in station-s32, a fallen
    officer no longer restarting his collapse when hit), the roundtrip, and the frame scripts headless.
- **Client (2026-10-12):** the page fills the window (`Layout`): the station view as large as it is, the static
  screens centred at their own size, the HUD's panel split into two halves at the window's bottom corners, cleaned
  of the frame, the pipes and the black backing; the beacon screens without their copy of the HUD; the fades of
  the static screens twice as fast; the title takes a click from 300 ms; the large font's gaps filled
  (`FontCleaner`).
- **Section 2 (2026-10-12): continued.** `Droids` lost its elevator queue (`DroidLift`, with `DroidStates`);
  `Aliens` its waves (`AlienWaves`) and the station's systems (`StationSystems`); `Wreckers` its characters
  (`CharacterView`), the spray (`SprayView`) and the recolouring (`Recolour`): 1,374 lines to 1,182.
- **The game in Node only (2026-10-12, the user: "the game logic lives in node ... the frontend is just a
  client now").** The in-page server and the Worker server are gone: every page is a client of
  `remake/server.mjs` over a WebSocket. Browser checks need the server running and play in real time
  (`tools/frames/live.mjs`); the virtual-clock frames runner no longer drives the game. Node-side checks build the
  sector or station themselves.
- **Next:** more of section 2 (`Wreckers`' init and update, the droids' and aliens' on-screen and off-screen AI as
  classes of their own); the title's scrolling credits spaced so no lines touch (the strip is a picture: it needs
  rebuilding from the fonts); a test that drives two or three browser windows at once; a second station (a design
  for the user).

## Gates

**Not the frame baselines (the user, 2026-10-12: "we're beyond that").** No comparing against saved frames and no
re-saving them; where this file or 03f says "baselines identical", read "the game plays and looks as before".

- The game run in headless Chrome after each change (no errors; a screenshot or two looked at), and longer runs
  played live in the user's visible tab.
- The station and move checks (quick logic regression checks, seconds in Node).
- The address check (`tools/noaddresses.mjs`); the snapshot check (one station, and two stations each equal to
  itself alone); the specs of every extracted class.
- Tenkai changes with specs and API docs.
