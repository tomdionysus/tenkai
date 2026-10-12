# Phase 3f: Wreckers on Tenkai (the client)

**Tenkai is a client-side framework (the user, 2026-10-12: "The only work is the clientside, tenkai isn't a
serverside framework").** Wreckers' game runs in Node, in Wreckers' own server code (`remake/server.mjs`, the
`Sector`, its `Station` and every agent in it): the officers, the droids, the aliens and the plasmozombs, all their
AI, the lifts, the waves, the systems. The browser is only a client: it sends what its player holds and does, and
draws the state and events it is sent. It builds a `Station` only as the shape to restore that state into; it never
ticks it. So Tenkai's part in Wreckers is the client, and nothing on the server side is Tenkai's to own.

This file is that client side: what Tenkai gains from the Wreckers client, as which classes, and the server-side
classes that leave `lib/`. The order of the Wreckers work, and Wreckers' own classes on both sides, are in
[03g](03g-wreckers-remake-architecture.md); where the two say different things, 03g wins.

## Rules

- **Mechanisms move, decisions stay.** A client mechanism another game would need with different data (screens,
  indexed drawing, fades, fonts, hotspots, sound voices, a view that fills the window, drawing between ticks,
  finding a server) goes into `lib/`. What makes it Wreckers stays in the remake: its layouts, texts, tables,
  colours and rules.
- **Extend rather than change.** New classes, subclasses and options whose defaults keep today's behaviour, so the
  other games keep working untouched. Changing what an existing class does needs the other games adapted, each
  checked against its own frames, the reason written down.
- **Each Tenkai change** comes with specs and API docs; the other games are checked after it, and adopting it in
  one is a separate step, taken only where it removes code without changing what the game does.
- **Structure (the user's rules, 2026-10-11):** one class per file, named after it; no free functions beyond
  trivial private helpers; no god classes; collaborators given to a class, never reached for.

## What leaves Tenkai: the server side

Added to `lib/` during 03g's steps 3-5, before this line was drawn. They move into Wreckers' server code (with
their specs, and `docs/api/GameServer.md` becoming a note there), and Tenkai's index stops exporting them:

| Class | What it is | Where it goes |
|---|---|---|
| `GameServer` | holds the game state and its clock; connections, input, actions, ticks | Wreckers' server |
| `GameState`, `Place` | the game's places, players and ticks; snapshot and restore | Wreckers' server (`Sector`, `Station` extend them) |
| `lib/node/WebSocketServer.js` | real WebSockets under Node, no dependencies | Wreckers' server |
| `LocalSocket`, `WorkerSocket` | a server in the page, or in a Worker | removed: the game runs only in Node now |

Staying in Tenkai, as the client's: `GameClient` (the client side of a game behind a server: the socket, the
welcome, each tick's state and events, input and actions) and `StateDiff` (it applies the server's deltas; the
server imports it to make them, a shared format rather than server machinery). `Motion`, `IsometricWorld` and
`IsometricProjection` stay too: single-page games run their logic in the browser, and Wreckers' server imports them
as a library.

Dropped from the earlier plan, as logic and not Tenkai's: `Agent`, `Actor`, `StateMachine` and `Behaviour`, a
`World` base with contact events and sight lines, `Projectile`, `Population`, a seeded `Random`. Wreckers' characters
become classes in its own server code (03g, section 2), composed there.

## What Tenkai gains: the client

From the Wreckers client as it stands (`remake/src`), in this order:

1. **Screens.** `Screen`, a `Scene` that takes keys and clicks first while it is on top and says what of the HUD
   shows, and the engine's stack of them. From: the client's screen flags (commander, dossier, consoles, factory,
   terminals, map, menu, scanner, letter) and their input routing in `Wreckers.js`. Also: Golden Axe and 1945
   (title, game over), Tim's editor, Monkey2's own screens.
2. **A view that fills the window.** The engine laying out a fixed-size block of static screens centred in a window
   of any size, with a scene (the world view) filling it and panels anchored to its corners, and clicks mapped to
   each. From: `Layout`. Also: any game that wants more of its world on a large screen.
3. **Drawing between ticks.** An entity drawn at a position reported each tick, slid between the last two (the
   old `ActorView` idea, client side only), and the time since the last tick on `GameClient`. From:
   `CharacterView`, `ServerLink`'s fraction. Also: any networked or fixed-step game.
4. **Finding a server.** Trying the page's own path, an address given in the URL, the last one chosen, then asking
   the player; reconnecting when the connection is lost. From: `ServerFinder`, `ServerConfig`. Also: any game
   behind a server.
5. **Indexed drawing.** `IndexedSurface` blits (opaque, masked, recoloured), lines and plane masks; palette fades;
   `IndexedScene` palette regions (different palettes for ranges of lines). From: `ViewPicture`, `BackBuffer`,
   `Fade`, `SnapshotFade`, `Screen`, `IndexedGlyphs`, the HUD's split at line 135. Also: Monkey2, any palette game.
6. **Fonts.** `BitmapFont` glyph indexes, opaque or ink-only cells, fixed advances, a cursor and typed-out text;
   glyph clean-up. From: `OriginalFont`, `GlyphLabel`, `FontCleaner`, the typing in `Dossier` and the terminals.
   Also: Monkey2, Golden Axe.
7. **Hotspots with groups**, switched together and routed through the screen stack. From: the hand-written click
   rectangles in the screens. Also: Myst, Monkey2.
8. **Sound voices.** `SoundManager` channels where a new sound replaces the old, with priorities. From:
   `GameSound`. Also: most games.

Then `Wreckers.js` is down to the client's set-up and wiring, and the screens to their layouts and rules.

## Gates

- Tenkai: the specs; every other game checked against its own frame baselines after each change (the examples
  and the local ports).
- Wreckers: the Node checks for the server's logic (players, roundtrip, station, move) stay as they are; the client
  checked live against a private server (`node local/wreckers/remake/server.mjs 8054`, never the user's on 8053),
  real time, `tools/frames/live.mjs`, and played by the user.

## Status

**In `lib/` already, client side:** `Motion` (from Wreckers' `Mover`), `StartScreen`, `TenkaiLogo`, `Input` keys
in several actions, `IsometricWorld` overlap, `IsometricScene`'s `seeThrough` (unused since the user turned
see-through characters down), `GameClient`, `StateDiff`, and `tools/frames/` (frame baselines for every game, live
runs in a tab).

**Done (2026-10-12): the server side out of Tenkai.** `GameServer`, `GameState`, `Place`, the Node socket server and
`LocalSocket` are Wreckers' own (`remake/src/Place.js`, `remake/src/GameState.js`, `remake/server/`, with their specs
in `local/wreckers/spec/` and a README there); `WorkerSocket` and the server's Worker hook are gone; Tenkai's index
exports `GameClient` and `StateDiff` only, documented in `docs/api/GameClient.md`.

**Done (2026-10-12): 1, screens, first form.** Tenkai's `Screen` and the engine's stack (`showScreen`, `hideScreen`,
`topScreen`, `screenStack`), with specs and docs; Wreckers' commander screen and dossier are its first user
(`CommanderMenu`). Still flags in `Wreckers.js`: the map and information screens, the menu, the scanner, the
consoles, the factory desk, the terminals and the letter (their open state is the seat's, on the server; each can
become a `Screen` the same way).

**Done (2026-10-12): 2, the block layout.** `GameEngine` options `block` and `maxScale` (fullscreen with a fixed-size
block centred whole in the window at the largest whole scale up to `maxScale`), `fitBlock()`, `windowRect`; Wreckers'
`Layout` keeps only its panel, view and the officer's focus (`fit`).

**Done (2026-10-12): 3, drawing between ticks.** Tenkai's `Trails` (where things were at the last two ticks, by key;
`between` for a frame) and `GameClient`'s `fraction()` (from a `tickTime`, counting only new ticks); Wreckers'
`CharacterView` draws its officers, cars, droids and aliens through a `Trails`, and `ServerLink`'s fraction is the
client's. The view's own scroll and the droid camera still keep their single `from` by hand in `Wreckers.js`.

**Done (2026-10-12): 4, finding a server.** Tenkai's `ServerFinder` (the URL's address, the page's own path, the
last chosen; `find` asks until one answers, `lost` asks again) and `ServerConfig` (the HTML form), with the game's
storage key, path and suggestion as options; Wreckers' own two files are gone.

**Done (2026-10-12): 5, indexed drawing and fades, first form.** Tenkai's `PaletteFade` (component steps, wait,
every, speed, `level`, `apply`), `IndexedSurface.line` and `bits` (ink-only bit rows), `toRGBA` over a band of
rows, `IndexedScene` `regions` (palettes from a line down), `Palette.fromCSS`. Wreckers' `Fade`, `SnapshotFade`
and `IndexedGlyphs` are gone (Title and Ending fade with `PaletteFade`); the dossier is an `IndexedSurface` shown
by an `IndexedScene` with palette B from line 135 (its check against the emulator unchanged). Still Wreckers' own:
`ViewPicture` and `Screens` (pictures of the view with their own pixel arrays and the back buffer's text
routines), the HUD's split, `BackBuffer`'s picture and font loading, the front end's `Screen` with its held
snapshot.

**Done (2026-10-12): 6, fonts, first form.** Tenkai's `BitmapFont.fromBits` (a font from rows of bits, drawn white
so it recolours) and `FontCleaner` (gaps in vertical strokes filled, for bits or a picture); Wreckers' `GlyphLabel`
and `FontCleaner` are gone (the commander screen's labels are a `BitmapFont`). Still Wreckers' own: `OriginalFont`
(its glyph order and line heights: data), and the typing of the dossier and the terminals, which follow the
original's back buffer routines (offsets, a counter over a list of entries) rather than a string a font could type;
a typed-text mechanism waits for a user that draws through a `BitmapFont`.

**Done (2026-10-12): 7, hotspot groups, first form.** Tenkai's `Hotspots` groups (`group`, `setGroup`, `groupOn`)
and `click` (a single click answered at once), and a `Screen`'s `hotspots` option (its clicks go to them by
default); Wreckers' commander menu is its first user (the commander screen's and the dossier's buttons, a group
each; the screens give their rectangles, `buttons()`). Still hand-written rectangles: the map and information
screens, the menu, the consoles, the factory desk and the terminals, which move with them as they become Screens
(the rest of 1).

**Done (2026-10-12): 8, sound voices.** Tenkai's `SoundVoices` (a voice per sound, replaced unless held or of a
higher priority; a claim takes every voice and refuses the rest); Wreckers' `GameSound` keeps only the driver's
rules on top (its tables, samples held on channel 3, the hum on channel 2, retuned effects).

**Done (2026-10-12): 1, the screens over the HUD.** `GameEngine.drawOver` (the game's drawing between its scenes
and its screens); Wreckers draws its HUD there, and the data terminal, the scanner, the menu, the map and
information screens and the promotion letter are engine screens (`SeatScreen`: shown while the seat's state says
so, clicks off the HUD's panel theirs, the letter taking every click and running its own keys and frames).
Then the console and the factory desk too, as screens drawn under the HUD (Tenkai's `Screen` option `under`);
`Wreckers.click` is down to the panel's slots and buttons, and every screen hides with the commander screen. Still
Wreckers' own: the screens' keys (still read in `gameKeys`, with the original's rules), and
their click rectangles (inside each screen class, not yet `Hotspots`).

**Done (2026-10-12, an hour's extraction):** Tenkai gained, each with specs and docs, and Wreckers was rewritten
onto them with every picture compared pixel for pixel against the old code (and the emulator checks unchanged: the
menu and scanner 159 pictures, the map and information screens 124):
- `IndexedSurface.fromImage` (a picture as palette numbers), `bits` with a paper colour (solid glyph cells),
  `remap` (numbers through a table), `toCanvas` (a surface through its palettes, regions too), `blit` with `map`
  (a colour table); `BitmapFont.readBits` (a font sheet as rows of bits); a transparent `IndexedScene` shows through;
  `Palette.clone` and `setLevels`; `PaletteFade.fadeRGBA`; `PixelRegions` (flood fill, islands, hollows).
- Wreckers: `ViewPicture` (the menu's and scanner's picture) on an IndexedSurface and IndexedScene, and `Screens`
  draws through it instead of its own copy; the officers' sprites are one indexed picture and a palette each
  (`OfficerSheets`; `Recolour` gone), the thaw's grey a tinted palette; the HUD's countdown remapped through palettes
  A and B; the HUD panel's cutting and the screens' outside clearing on `PixelRegions`; the front end's `Screen` on
  IndexedScene, `setLevels` and `fadeRGBA`; the console's, terminal's and factory desk's buttons as `Hotspots`.
- Monkey2's glyphs drawn with the colour-table blit. `tools/smoke.mjs` loads every game headless after each change.
- Rules: the page holds none (keys and buttons go to the server, `SeatKeys`; the terminal's STATUS is the server's).

**Next:** the map and information screens' hotspots (the original's group masks: Tenkai's groups are named, so a
mask form first), typed text once a screen types through a `BitmapFont`, and the rest of `Wreckers.js` down to
wiring. Also left: the screens' keys into their screens (with the original's guard), 5 (`ViewPicture` and `Screens` onto `IndexedSurface`, the
HUD's split) and 6 (typed text, once a user draws through a `BitmapFont`).
