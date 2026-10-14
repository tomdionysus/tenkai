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

## What Tenkai could take from Dune II

The other direction: mechanisms the Dune II client built for itself that another game would want with different
data, and that Tenkai has nothing for. Each would be a new class or a new option whose default keeps every game as it
is (03f's "extend rather than change"), with spec and docs, and Dune II its first user. In order of what the engine
gains; the first four answer open items in [03](03-engine-core.md).

### A. A camera for a scene (from `MapView`, `DuneClient.wheel` and the drag)

`MapView` gives the map its own zoom, separate from the engine's scale, by scaling the `TiledScene` and resizing the
view's tiles, and the `IndexedTileMap`'s window says which cells show; the wheel zooms about the tile under the
pointer (`DuneClient.wheel` reads the cell before and after and scrolls by the difference); the right button drags
the map a tile at a time; `Shake` moves the content inside a window that stays put. 03 has "pull viewport x/y/scale
out of `GameEngine` into a `Camera`" open. Dune II is the model for it: a `Camera` owning a scene's offset and
zoom, with `zoomAbout(x, y, step)` keeping a point under the pointer, `dragBy(dx, dy)`, limits (the map's edges,
Dune's `leastMapZoom`), and a shake offset; `MapView.toMap` becomes its `toWorld`. `TiledScene` and the engine's
own x/y/scale are untouched; a game opts in.

### B. Box selection of entities (from `PlayScreen.endBox` and `drawMarks`)

A press on the map that is not a click, dragged, becomes a box; on release the entities whose positions fall in it
are selected, with a minimum size (`BOX_MIN`) so a click is not a box, and the box drawn while it is dragged. Any
game with units or icons wants this. A `RubberBand` (or a `box` mode of `Hotspots`: `onDown`, `onDrag` and `onUp`
already exist) that keeps the rectangle in scene coordinates, answers `inside(x, y)`, and picks from a `Roster`
(`roster.within(rect)`); 03's "hit-testing: which entity is under the pointer" is its one-point case.

### C. Autotiling (from `GroundTiles.piece` and `WallPieces`)

Dune's ground is drawn from runs of 16 edge pieces chosen by which of a tile's four neighbours are the same kind
(rock joining mountain, spice joining thick spice), and its walls from a 256-entry table over four neighbours with a
second bit each for rubble. This is the classic autotile, and Tenkai's tile maps and the Tim the Enchanter editor
have nothing for it: every map is placed piece by piece. An `Autotile` class: a sheet's run of pieces (16 for the
four-neighbour kind; the 47-piece and 256-entry blob forms as tables), `same(a, b)` for what joins, and
`piece(x, y)` for a layer. `GroundTiles` and `WallPieces` are its two tables (they stay on Dune's server; the class
would be shared by import, as 03f allows for a library).

### D. Pointer buttons and drags that leave the canvas (from `DuneClient.grab` and `PlayScreen`'s box)

The engine triggers `mousedown` for any button but gives no help telling them apart, and listens on its canvas
only, so a drag let go outside it is never released: `DuneClient` adds window-level `mousemove` and `mouseup`
listeners itself, and `PlayScreen` checks `e.button` and `e.buttons` by hand. 03 has Pointer Events open. Part of
that: the engine tracks a held button to the window until it is released (an option, off by default) and reports
`button` and `buttons` with its events, so a game's drags need no listeners of their own.

### E. Remembered display settings and the browser's full screen (from `Display`)

`Display` keeps a zoom the player chose (and the map's own) in `localStorage` under a key, caps it at the most that
fits, and toggles the browser's full screen with the Fullscreen API (the engine's `fullscreen` option means filling
the window, which is a different thing). Every game with a 320 x 200 block wants the same. A `Display` in `lib/`:
`{ key, most, default }`, `zoom(width, height)`, `choose(n)`, `nextZoom`, `toggleFullscreen`, a `changed` callback;
`GameEngine` takes it as the source of its scale when given one (5 above). Dune's map zoom stays Dune's.

### F. A screen with its own palettes (from `ModalScreen`)

`ModalScreen` is nearly generic already: a `Screen` whose surface is an `IndexedScene` with palette bands
(`palettes()`), its own `Hotspots`, a border, centred at the original's size, fading in through `PaletteFade` from
the colours of the screen it replaces (`colour()`). Only its border and sizes are Dune's. An `IndexedScreen` in
`lib/` with the border and the fade as options; `ModalScreen` becomes a thin subclass. Wreckers' overlays (03f) are
the same shape and would be its second user.

### G. Typed-out text and wrapping for `IndexedFont` (from `MentatSpeech`)

`IndexedFont` measures and draws; it does not wrap, and nothing types text out. `MentatSpeech` does both for the
Mentat: the original's own splitting into sentences of up to three lines, and a character every 4 ticks with a pause
after. The splitting stays Dune's, but its two primitives are general: `IndexedFont.wrap(text, maxWidth, spacing)`
(lines broken at spaces, as `BitmapFont.wrap` does for the other font class) and a `Typewriter` (text revealed a
character at a time at a rate, `tick()`, `done`, `skip()`), which 03f already wanted for Wreckers' letter.

### H. Derived tiles and composed pictures (from `MapCanvases`)

`MapCanvases` builds one `Sheet` from the map's tiles plus tiles it derives (a black one, the fog's edges with a
colour made see-through, the overlays and rubble likewise), and caches pictures composed of several tiles in a
house's colours by a key (`structure(key, tiles, w, h, table)`), so a structure is drawn with one blit.
`IndexedSprites` caches single sprites through a colour table, but not compositions. `IndexedSheet.derive(n, options)`
(a copy of a tile with a colour keyed out, appended to the sheet) and a `PictureCache` keyed by the caller's string
would make both general.

### I. A panel layout round a view that fills the window (from `Layout` and `ScreenFrame`)

`Layout` keeps a bar across the top and two sidebar parts at their sizes against the window's corners, with the view
filling the rest and the parts laid over it as insets (`overInset`); `ScreenFrame` draws the frame for that layout
from the original's 320 x 200 picture, its ends at the corners and its plain stretches repeated between. 03e already
noted frames from pictures ("ornaments of any number") as a Tenkai idea. A `PanelLayout` (parts anchored to edges
and corners, the rest the view, `overInset`) with a `PictureFrame` that draws it from a picture's strips would serve
any remake with a fixed screen shown in a larger window.

### J. Letters as keys (from `DuneClient`)

`DuneClient` binds `letterA` to `letterZ` by hand so the sidebar's buttons can be pressed by their first letter.
`Input` could offer `letters: true` to bind them all, and `pressedLetter()` to answer which.

### K. The root of the mouse copy: deferred events

`HasEventsMixin.trigger` queues handlers with a zero timeout, which is why `engine.mouseX` is stale in a
`mousedown` handler and Dune converts the event itself (1 above). 02 has "replace `HasEventsMixin` with native
`EventTarget`" open; handlers running during the DOM event would end the staleness for every game, and `pointAt`
would be needed only by code that keeps events to use later. That is a behaviour change (handlers run earlier) and
belongs to 02, not here; 1 is the behaviour-neutral step.

## Order and checks

1, 2, 3 and 4 first, then 5 if it still pays. A to K are proposals for after them, each its own step when a second
game wants it or when it removes enough from Dune II on its own (A, B and C first).

**Done (2026-10-14):** 1 (`GameEngine.pointAt`, the `wheel` event), 2 (`Hotspots` `box` and `Hotspots.inside`; the
three `inside` helpers gone), 3 (`IndexedSurface.outline`; `PanelArt.outline`, the factory window's `rect` and the
screen border's `ring` on it), 4 (the shots out of `Explosions`), and C (`Autotile` in `lib/`, with `GroundTiles` and
`WallPieces` as its two tables, the wall table checked against every neighbour pattern). Each with specs
(479 pass) and docs; build check, both round trips and the tab on 8064 unchanged. **Next:** A (the camera) and B
(box selection), then 5 if it still pays, and D to K as a second game wants them.

## Second pass (2026-10-14), after 03j

03j made the client objects with injected collaborators; the ports and parts it made were looked at again for what
is Tenkai's. Folded into `lib/`, each with a spec and docs, Dune II on it, 486 specs passing:

- **`GameClient.connect(socket)`** (from Dune's `Connection`): a client made before the page has found its server,
  with no state and sending nothing until connected, so the parts that read its state and send its commands are
  built first and given it; the callbacks in its options. Dune's `Connection` is gone; `Battle` and `Orders` take the
  `GameClient`.
- **`Page`** (from Dune's `Browser`): the page's globals as one object (window, document, clock, random, reload,
  address, JSON and images by path). Dune's `Browser` is gone.
- **`Buttons`** (from Dune's `WindowButtons`): a screen's buttons as a set shown at a time, boxes on its hotspots
  acting at the press (or the release), drawn by the game's painter. Dune's `WindowButtons` keeps only its words and
  `WindowArt` painting, on it.
- **`Screen.pointer`**: where the pointer is in the screen's own coordinates, seeded by `GameEngine.showScreen` and
  kept by `mouseMove`; `ModalScreen` and the Mentats' faces read it, nothing reads `engine.mouseX` through a screen.
- **J resolved without a change:** `Input` already answers for an unbound key by its code, so Dune's `Keyboard`
  asks `pressed('KeyM')` and `DuneClient` binds no letters.

Looked at and left with Dune II, as its own: `Battle` (the game's view of its state), `Orders` and `OrderFeedback`,
`Interaction`, `HoldPolicy`, the looks (`UnitLooks` and its table: a general "a look a type" is a pattern, not a
class), `FactoryOffer`, `HintPolicy`, the asset bundles, `PictureStore` (near `AssetCache`, but Dune's palette
lookup is the half of it). Still open from the first pass: A (camera), B (box selection: `PlayInput.endBox` and
`Roster.within`), F (`IndexedScreen` from `ModalScreen`), G (`IndexedFont.wrap`: `HintBox.wrap` is the original's
split, to be checked against `BitmapFont.wrap`'s before one serves both), H, I, K.

Each step: the `lib/` change with its spec and docs (`npx jasmine`; the
other games' frame checks where the change could reach them), the client change, `npx esbuild remake/client/main.js
--bundle --format=esm --outfile=remake/out/main.js`, the build check and the two round trips
(`tools/checks/build-check.mjs`, the roundtrip script on SCENA004 and SCENA007), the page tried in a tab on the
private port 8064 against the same save before the change, then a commit per step. The live server on 8060 is
restarted only for the client build (a reload is enough for page-only steps).
