# Phase 3k: the Wreckers client as objects

The pass 03j made for Dune II, for Wreckers: the client (`local/wreckers/remake/src`, the page's side; the server's
classes are 03g's and stay) as objects that each do one thing and are given what they use, in place of
`Wreckers.js`, which on 2026-10-14 is 1,190 lines: a `GameEngine` that loads, builds, wires, reads keys, follows
the server's screens, dispatches events, writes status text, drives the front end, moves the camera and draws.
The game's experience does not change: every gate of 03f holds, and a tab on a private port plays the same.

## Rules

As 03j's: one class per file named after it; no free functions (a helper is a method, or a static of the class
it serves); no god classes; a class is given its collaborators (a port, a part, a callback) and never reaches
into the engine for them; a switch over one value, not an if chain; mechanisms to Tenkai, decisions in the game.
`Wreckers` stays the `GameEngine` subclass (the engine's options, the frame's order), but is wiring: the parts do
the work. The frame scripts' hooks (`window.game.act`, `game.screens`, `game.console`, `game.zone`,
`game.factoryOpen`, `game.ticker`, `game.archive`, `game.scanner`, `game.topScreen`) stay as they are.

## The shape to reach

### The root and the ports

- `ClientAssembly`: the one composition root. Given the engine (for its assets, scenes, input and screens), the
  page, the pictures and the tables, it builds every part below and hands `Wreckers` what its frame needs.
- `AssetLoader`: the picture names and the 22 JSON tables as two objects, `Pictures` (elements by name, the large
  font cleaned) and `Tables` (the data by name, the dossier's glyphs cleaned); `Fonts` (the large and small
  `OriginalFont`s and the glyph label) made once and shared.
- `PlayerView`: this player's view of the station through the link: their number, seat, officer (`me`), what
  their screen mode says (`console`, `factoryOpen`, `terminalOpen`, `archiveOpen`, `fullScreen`), the states the
  screens read (`terminalState`, `screenState`, `word`), who else plays whom, the gauges, the ambient level and the
  droid slots' records. The getters now on `Wreckers`.
- `Orders`: what the player asks of the server, by name (`key`, `wake`, `leave`, `waitRelease`, `window`,
  `slider`, `commission`, `mode`, `letterDone`, `over`, `newGame`, `test`), over `GameClient.act`. The one place
  that knows the actions' shapes.
- `FactoryDesk` (the factory as the desk sees it, a commission through `Orders`), `ScreenModePort` (the menu's and
  scanner's showing, read from the seat and set through `Orders`) and `CommanderLobby` (what the commander screen
  asks: who is taken, who is playable, ended, choose, restart): the three ad-hoc objects of `init` as classes.

### The frame in parts

- `FrontEnd`: the title and the end sequences: which piece shows, the 300 ms before input reaches it, keys and
  clicks to it, the title tune and its fade, and what follows a piece (the title: the commander screen's tune;
  an end: the page again).
- `PlayInput`: the keys of play: the F keys and slots, Q, G, B, M (move on the map with a droid), V, Tab, Space at
  a terminal, the menu's and scanner's own Y, N and Space, and the console's sliders. Given the input, the orders
  and the screens it asks.
- `SeatScreens`: the player's screens as the server has them (menu, scanner, terminal, letter opened and closed
  on the server's word), the menu's own passes, what a screen's result asks (sounds, tune, quit, NEW) and the
  quit icon's click. Owns the `GameMenu`, `Scanner`, `TerminalScreen` and `PromotionLetter` as far as the frame
  is concerned.
- `StationEvents`: the server's events to the parts they move, a switch over the event's name.
- `StatusText`: the status messages by number, the screens' texts and the words, the ticker's `say`.
- `ViewCamera`: where the view looks: the outside camera and View Droid gliding between ticks, else on the
  officer; the scroll of the last tick; the plasmozomb's shake.
- `StationGround`: the map as a tile layer, the occluders over it, a tile replaced; `StarField`: the stars behind
  the station; `AirlockArrows`: the blinking ways back in.
- `PanelButtons`: the HUD panel's hotspots (slots, scanner panel, lifeforce panel), the clicks from the layout;
  `ConsoleControls`: a bulb console's quit and sliders, by click and by key.
- `Gauges`: what the HUD's gauges read each frame (the levels or the suit, the health, the countdown).

### Small habits

- `Archive.wrap`, `Ending.glyphs`/`wrap` and `Hud.css` become statics of their classes.
- `event`, `titleMusic` and the sounds of a screen result switch on their one value.
- `Wreckers.update` is the order of the frame: the front end, the lobby, the game over, the screens, the keys,
  the parts' updates, the camera.

## Specs

`local/wreckers/spec`: `Orders` (each action's shape), `StatusText` (a message with a number word, the rank title),
`PlayInput` (M as move on the map with a droid, as the archive otherwise; a slot at the factory desk), `SeatScreens`
(a result's sounds and quit; the server's word opening and closing), `StationEvents` (an event to its part),
`ViewCamera` (the glide from the last tick's scroll; the shake), `FrontEnd` (input held 300 ms; the title's end).

## Order and checks

1. The ports: `Orders`, `PlayerView`, `StatusText`, `FactoryDesk`, `ScreenModePort`, `CommanderLobby`.
2. The parts: `FrontEnd`, `PlayInput`, `SeatScreens`, `StationEvents`, `ViewCamera`, `StationGround`, `StarField`,
   `AirlockArrows`, `PanelButtons`, `ConsoleControls`, `Gauges`.
3. `AssetLoader`, `Fonts`, `ClientAssembly`; `Wreckers` down to the engine's options and the frame's order.
4. The small habits.

After each: the build, the 35 specs plus the new ones, the station checks, the move check, the round trip, the
players check, `play.json` and `consoles.json` live headless, and a tab on 8054.

**Done (2026-10-14): all four steps.** `Wreckers.js` is 330 lines: the engine's options, `init` (the loader, the
assembly, the parts it keeps by name, the click and resize listeners), the window and the server (`applyLayout`,
`sendWindow`, `connect`, `serverGone`, `welcomed`, `received`, `afterTick`), the getters the frame and the frame
scripts read, what the parts ask of the game (`wake`, `woken`, `left`, `letterRead`, `lost`, `newGame`, `restart`,
`joinedNewGame`, `say`, `click`), and the frame (`update`, `draw`, `drawOver`). The ports and parts are as the
shape above, each in its own file; `ClientAssembly.build` returns them and `seatScreenList` the screens over the
play view. `Pictures` and `Tables` name the files; `Fonts` makes the three fonts once (the screens were each
making their own `OriginalFont`s). `Hud.css`, `Archive.wrap`, `Ending.glyphs` and `Ending.wrap` are statics.
Specs: `Orders`, `StatusText`, `PlayInput`, `SeatScreens`, `StationEvents`, `ViewCamera`, `FrontEnd` (60 in all).

**A lesson from the pass.** Turning `Hud`'s `css` helper into a static, two of its three call sites were changed
and the third (`drawLifeforce`) threw on every frame: a black screen after the officer select (the user, 2026-10-14:
"You broke it"). The headless frame scripts had "played to the end" over it, because `tools/frames/live.mjs` prints
page errors as lines among the rest and a `tail` of its output does not show them. So: a lint of the client with
`standard` from inside `local/wreckers` (from the Tenkai root its ignore pattern skips `local/`) for `no-undef`
and `no-unused-vars`, and the frame scripts' whole output read for `page error`, are part of the gates now, with
the four test pages (`menu.html`, `screens.html`, `terminals.html`, `frontend.html`, served from `remake/` on a
private port; the game server does not serve them) loaded without errors. Those pages are from before the
fullscreen window and the split HUD (the user, 2026-10-14: "Be careful. We changed to fullscreen and split the
HUD since then"): they show that the screens' modules load and draw, not how the game looks now, and the game
in a tab is the only picture of that.

**Second pass (2026-10-14).** The server's free functions are statics of their classes (`Aliens.floorOf`,
`Droids.floorOf` and `queuePoint`, `Outside.struggleFrame`, `TerminalStatus.signed`); `Station.act`'s map
actions and `GameMenu`'s keys and clicks switch on their one value; the letter's keys are a table. The drawing
classes that made scratch canvases on the global `document` (`Dossier`, `FactoryScreen`, `PromotionLetter`, the
front end's `Screen` through `Title` and `Ending`, `Slots`, `Layout.panel`) are given it, through the assembly
and `FrontEnd`; `CharacterView`'s clock is no longer defaulted to the global. The screen classes keep their
picture bags: a bag of exactly what a class draws with is the explicit dependency, where a `Pictures` lookup
would be a locator. Gates as above, the title played in a tab.

**Left:** `check.js` and the four test pages are scripts, not objects, and stay so. The server's big classes
(`Station` 870 lines, `Droids` 893, `Aliens` 825, `Officer` 425) are 03g's and a pass of their own, under the
same identical-output gates.
