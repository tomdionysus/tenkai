# Phase 3i: Dune II on Tenkai (the client)

The Tenkai side of [03h](03h-duneii.md): where the Dune II client does by hand what Tenkai's `lib/` does, or nearly
does, and what to do about it. The game's behaviour and its pictures stay exactly as they are; every step here
removes code from the client or moves a generic mechanism into `lib/`, and nothing else. The rules are 3f's
([03f](03f-wreckers-on-tenkai.md)): Tenkai is a client-side framework and an engine, not a remake kit; mechanisms
move, decisions stay; extend rather than change; every `lib/` change comes with specs and API docs and the other
games checked after it.

## Where it stands (2026-10-14)

The client (`local/duneii/remake/client`, 41 files, about 5,000 lines) already rests on Tenkai more than it looks.
It uses 24 of the 56 classes in `lib/`:

| Part of the client | Tenkai classes |
|---|---|
| The page, its window and the server | `GameEngine` (the fixed step at 50 a second, `block` and `maxScale`, screens, mouse events, the keys through `Input`), `GameClient`, `ServerFinder`, `ServerConfig`, `StateDiff` (on the server side, for the deltas) |
| Drawing in palette numbers | `IndexedSurface`, `IndexedSheet`, `IndexedSprites`, `IndexedFont`, `IndexedScene`, `IndexedTileMap`, `Palette`, `PaletteFade`, `Sheet` |
| The map | `TiledScene`, `Shroud`, `Minimap`, `Marks`, `Trails` (units between ticks), `Shake` |
| Things on the map | `Entity`, `Roster` (units, structures, explosions), `Facings`, `CommandList` (the original's explosion lists) |
| Windows and panels | `Screen` (`ModalScreen` and every window on it), `Hotspots`, `Dissolve`, `MessageLine`, `MessageQueue` (hints), `RollingCounter` (credits) |
| Sound | `SoundBoard` (and `SoundManager` through it) |

The 32 unused classes are for other kinds of game (`IsometricScene`, `IsometricWorld`, `IsometricProjection`,
`Motion`, `Video`, `BufferedScene`, `BackgroundScene`, `StartScreen`, `TenkaiLogo`, `Cursor`: the user chose the
system's pointer), or lower-level pieces reached through others (`Asset`, `Audio`, `SoundVoices`, the mixins,
`Input`, `Util`), or have no call here (`AssetCache`, `BitmapFont`, `Logger`).

## What duplicates Tenkai

In order of value. Each is behaviour-neutral: the page draws the same pixels and sends the same orders after it.

### 1. Mouse plumbing (`DuneClient`, `PlayScreen`)

`DuneClient.pointAt(e)` converts a mouse event to game coordinates exactly as `GameEngine._setMouseCoords` does.
The client needs its own copy because the engine's events are deferred (`HasEventsMixin.trigger` queues handlers
with a zero timeout), so by the time a `mousedown` handler runs, `engine.mouseX` is where the pointer went
afterwards; the play screen's box selection and the map drag read the event instead. `DuneClient` also adds its own
`wheel`, `mousedown`, `contextmenu` and window-level `mousemove`/`mouseup` listeners for the map's zoom and
right-button drag.

- **Tenkai:** a public `GameEngine.pointAt(event)` (the conversion, exposed); a `wheel` event the engine triggers
  with the DOM event when it is not panning or zooming itself (`enableScroll` and `enableZoom` off, as here). Docs
  and specs for both.
- **Dune II:** `DuneClient.pointAt` goes; `PlayScreen` and the drag call the engine's; the `wheel` listener becomes
  `this.on('wheel', ...)`. The right-button drag, with its window-level listeners (a drag let go off the canvas), and
  the `contextmenu` suppression stay Dune's: the engine listens on its canvas only, and changing that would touch
  every game.

### 2. Point-in-rectangle, three copies (`Layout`, `Widgets`, `FactoryWindow`)

`Layout.inside`, `Widgets.inside` and `FactoryWindow.inside` are the same four comparisons on an
`{ x, y, width, height }` rectangle. The sidebar's eleven hotspots are all of the form
`contains: (x, y) => <a test of the state> && Widgets.inside(w.rect(n), x, y)`, with the rectangle looked up each
time because the layout changes with the window.

- **Tenkai:** `Hotspots.add` takes a rectangle as `box: { x, y, width, height }`, or a function returning one,
  alongside its `rect: [l, t, r, b]` form; `Hotspots.contains` answers it. Docs and specs.
- **Dune II:** the sidebar's hotspots become `box: () => w.rect(n)` with their state test as `enabled`; the three
  `inside` helpers go (`Layout.overInset` uses the engine's).

### 3. One-pixel rectangle edges, three copies (`PanelArt`, `FactoryWindow`, `ScreenBorder`)

`PanelArt.outline`, `FactoryWindow.rect` and `ScreenBorder.ring` each draw a rectangle's edges with four `fill`
calls; `ring` takes two colours (top and left, bottom and right). `Marks.outline` is the same thing on a canvas.

- **Tenkai:** `IndexedSurface.outline(x, y, w, h, colour, colour2 = colour)`: the edges, clipped to the surface as
  `fill` is, the second colour for the bottom and right. Docs and specs.
- **Dune II:** the three helpers call it; `PanelArt.bevel` (light top and left, dark bottom and right, inset a pixel)
  may too.

### 4. Dead code (`Explosions`)

The client-side projectile flight (`fire`, `shots`, `SHOT_SPEED`, the death held back until its shot lands) has had
no caller since shots became the server's bullets (`Bullets`, drawn from the state). About 40 lines. Not a Tenkai
gain, but it goes in the same pass.

### 5. Fitting the window (`DuneClient.fit`, `Display`)

`DuneClient.fit` does again what `GameEngine.fitBlock` does (the largest whole scale the 320 x 200 block fits at,
the block centred), because `Display` adds a zoom the player chose and the browser remembers, which may be less than
the most that fits. In a battle the play screen fills the window instead, which is Dune's own layout.

- **Tenkai:** `fitBlock` takes its scale limit from an option that may be a function (`maxScale: () => n`), so a
  game can cap the scale by a choice of its own. Docs and specs.
- **Dune II:** the between-battles case of `fit` is the engine's; the in-battle case stays. The smallest gain of the
  five; last.

## Looked at and left alone

- **The server's `Logger`** (`remake/server/Logger.js`) beside Tenkai's `lib/Logger.js`: Tenkai is client-side,
  and the lib one is a console logger without the stream output and repeat suppression a long-running server needs.
- **`MentatSpeech.split`**: the original's own splitting of a Mentat's text into sentences of up to three lines, not
  a generic word wrap. `IndexedFont` gains no `wrap` from it.
- **`Selection`, `HouseColours`, `UnitSprites` (the blinking), `MapCanvases`, `Radar`**: the game's own rules and
  tables on top of Tenkai's classes, as they should be.
- **Loading (`DuneClient.json`, `DuneClient.image`, `Assets`)**: the engine's `addAsset` is callback-style and
  `AssetCache.image` loses the error message; no gain.
- **The server (`remake/server/`)**: Wreckers' and Dune II's servers each have a `WebSocketServer`, `TickClock`,
  `StaticFiles` and `Logger` of their own. Tenkai owns no server machinery (03f); sharing them would be a package of
  their own, not `lib/`.

## Order and checks

1, 2, 3 and 4 first, then 5 if it still pays. Each step: the `lib/` change with its spec and docs (`npx jasmine`; the
other games' frame checks where the change could reach them), the client change, `npx esbuild remake/client/main.js
--bundle --format=esm --outfile=remake/out/main.js`, the build check and the two round trips
(`tools/checks/build-check.mjs`, the roundtrip script on SCENA004 and SCENA007), the page tried in a tab on the
private port 8064 against the same save before the change, then a commit per step. The live server on 8060 is
restarted only for the client build (a reload is enough for page-only steps).
