# Phase 3j: the Dune II client as objects

The client side of [03h](03h-duneii.md) (`local/duneii/remake/client`, 41 files, about 4,900 lines) made more
object-oriented and more inversion-of-control: each class owning one thing, built from collaborators it is given,
never reaching into another's insides or into the page's globals, so that each can be built in a spec with
stand-ins. The rules are the user's (2026-10-11): one class per file named after it, no free functions, no god
classes, collaborators passed in at construction (never `window.game`, a shared `game` object, module singletons or
fields patched after construction), and a switch over an if chain. The game's behaviour and pictures stay exactly
as they are; the server (`remake/src`, `remake/server`) is not touched. [03i](03i-duneii-on-tenkai.md) is the
same client's Tenkai side (mechanisms into `lib/`); this is its shape.

## Where it stands (2026-10-14)

The client is already classes with injected collaborators in most places, and small ones: 30 of the 41 files are
under 120 lines, every class is in a file of its name, and the screens, sprites, radar, counter and sounds each
take what they need in their constructor. What is left is the shape of the whole, and a few habits:

1. **`PlayScreen` is the god class** (573 lines, 48 members). It builds 25 collaborators in its constructor, holds
   every piece of the page's own state (`selection`, `placing`, `targeting`, `held`, `placedAt`, `box`, `hinted`),
   takes the engine's mouse events, dispatches the server's events (`event`: 14 cases), decides deaths' explosions,
   words the message line (`announce`, `unitDestroyed`), keeps the hint policy (`selectionHint`, `placed`), sends
   orders with their sound and blink (`order`), reads the keys (`update`), handles the map and radar clicks
   (`mapClick` is an if chain over four modes), draws the marks and the placing footprint, and brings every scene up
   to date (`draw`). `DuneClient` reaches into it (`this.play.mapView.scene.visible`, `this.play.begin()`,
   `this.play.targeting`, `this.play.missilePalace()`).
2. **The composition root is spread through constructors.** `DuneClient.init` builds `Assets`, `PlayScreen` and
   `CampaignView`; `PlayScreen` builds its 25; `Sidebar` builds `GroupPicture`; `Radar` builds `RadarStatic` and a
   `LandscapeTypes`; each window builds its `WindowArt`. A class that builds its collaborators cannot be given
   stand-ins, so none of the client can be built in a spec without the whole tree and the loaded assets. There are
   **no client specs**: the checks (`tools/checks`) run the server headless and the page is checked by eye.
3. **Bags of closures instead of objects.** `Sidebar` takes nine functions that peek at `PlayScreen`'s fields
   (`placing`, `held`, `house`, `startPlacing`, `stopPlacing`, `startTargeting`, `openFactory`, `order`) and a tenth,
   `state()`, in `bind`; `FactoryWindow` takes `credits()`; `OptionsScreen` takes `people()`, `saveLoad()`,
   `controls()`; `GameControlsScreen` `back()`; `SaveLoadScreen` `saves()`; every `ModalScreen` an `order()`. Each is
   a hole punched into `PlayScreen` rather than a collaborator with a name and a contract.
4. **The state is a global in disguise.** `PlayScreen.state` reaches through `this.client.state`; `house` and
   `fighting` are derived from it in `PlayScreen`, derived again in `DuneClient` (through `CampaignView.fighting`)
   and once more in each closure (`this.state && this.house !== null && this.state.houses ? ... : null` appears four
   times). Every method takes `state` as a parameter or calls a `state()` closure.
5. **`Assets` is a service locator.** One object with 35 fields (sprites, tiles, two fonts, five tables, strings in
   four files, the factory art, the Mentats, the map screen's pictures, the sounds table...) is handed to 24 classes,
   each of which uses two to five of them. Nothing says what a class needs; a spec must build all of it.
6. **Reaching into collaborators and the page.** `things.foreground = (context) => this.drawMarks(context)` and
   `this.mapView.scene.visible = ...` (PlayScreen and DuneClient both) patch a scene from outside; `client.onWelcome`,
   `onEvent`, `onClose` are patched onto the `GameClient`; `MentatScreen` reads `this.hotspots.list[i]`;
   `ModalScreen.draw` reads `this.engine.mouseX`; `GameControlsScreen` reads `this.engine.element.width`;
   `Sidebar.draw` makes its `PanelArt` lazily (`this.art || (this.art = ...)`); the windows set `this.holds` in
   `show`. Globals: `window.location.reload`, `fetch`, `Image`, `performance.now` (Radar's `now` is injected, the
   `SaveLoadScreen` cursor's is not), `Math.random` (in `MentatScreen`, though `MentatFace` takes `random`),
   `localStorage` (in `Display`, through an injected `window`: right).
7. **Module-level singletons.** `const TURRET = new Facings(...)` in `StructureSprites`; `VEHICLE`, `ROCKET`,
   `INFANTRY` in `UnitEntity`; `ROCKET` again in `Explosions`; `UnitEntity.wormTable` as a static cache.
8. **Deciding and drawing in one class.** `Sidebar` (441 lines, 57 members) decides what the panel offers (`orders`,
   `repairButton`, `status`, `percent`, `act`, `shortcut`, `palaceReady`) and draws it in seven `draw*` methods,
   with the structure's type switched on inside `draw`. `FactoryWindow` (314) is the offer's model (items, stock,
   prices, amounts, `spent`), its hotspots and its painting. `MentatHelpScreen` (256) is the list, the keys, the
   scroll bar and the subject's reveal.
9. **Three windows roll their own buttons.** `OptionsScreen`, `SaveLoadScreen` and `GameControlsScreen` each keep a
   list of `{ x, y, width, height, act }` and test it in their own `click` with an `inside` lambda, though
   `ModalScreen` owns a `Hotspots` already (and 03i's step 2 gave it `box`). The "one person's game is held, several
   people's never" rule (`this.holds = this.people() <= 1`) is written in three of them.
10. **If chains where a switch or a table belongs.** `Widgets.rect` (six `if`s on the index), `UnitEntity.show`
    (worm, then winged, then rocket / infantry / vehicle), `SaveLoadScreen.key` (four keys), `PlayScreen.mapClick`
    (missile, placing, targeting, select), `Radar.draw`'s colour lambda.

## The shape to reach

Each part named here is a class in a file of its name under `remake/client`; "takes" lists its constructor's
collaborators. Nothing new is a framework: no container, no event bus, no abstract base classes. The rule is only
that `new` happens in one place, and everything else is told who it works with.

### The root and the ports

- **`ClientAssembly`** (new, from `main.js` and the constructors of `DuneClient` and `PlayScreen`): the one place
  that builds the client. It loads the assets, makes the ports below, builds every part with its collaborators,
  wires the engine's events to `MapInput`, the client's callbacks to `BattleEvents`, and hands `DuneClient` the
  finished `PlayScreen` and `CampaignView`. The only `new` of a collaborator outside it is a part making its own
  private value objects (an `IndexedSurface` to draw on, a `Roster`'s entities). `DuneClient` becomes the engine
  subclass alone: `fit`, the keys, `update` and `draw` passed on to a `Stage` it is given.
- **`Orders`** (new, from `PlayScreen.order` and every `order` closure): `send(order)` to the `GameClient`, with the
  acknowledgement sound and the targeted unit's blink as its own concern (`OrderFeedback`, taking `GameSounds`,
  `UnitSprites`, the actions table). Every window and panel takes `Orders`, not a function.
- **`Battle`** (new, from `PlayScreen.state`, `house`, `fighting`, `seen`, `missilePalace`, the `people`, `saves`
  and `credits` closures): the page's view of the latest state. One object, told the state each tick by the
  assembly's wiring (`client.onTick`), answering `state`, `house`, `fighting`, `me`, `credits`, `people`, `saves`,
  `seen(p)`, `unit(id)`, `structure(id)`, `unitOn(tile)`, `missilePalace()`, `hintShown(message)`. Everything
  that read `state` as a parameter or through a closure takes `Battle` and asks it. The repeated guards go with it.
- **`Browser`** (new): `document`, `window`, `now()`, `reload()`, `json(path)`, `image(path)`, `random(a, b)`:
  the page's globals as one injected object (`Display` already takes `window` and `document` this way). A spec
  gives a stand-in with a fixed clock and random.

### The play screen in parts

- **`PlayScreen`** keeps only the order of things: `update` ticks its parts, `draw` asks each to draw, `begin`
  resets them. Under 150 lines. It takes the parts; it builds none.
- **`Interaction`** (from the fields `placing`, `targeting`, `held`, `placedAt`, `box`): the page's own state,
  owned in one place with methods (`startPlacing(yard)`, `stopPlacing()`, `target(action)`, `hold(type)`), so the
  sidebar, the cursor and the marks ask it instead of a closure each. `Selection` stays as it is and joins it.
- **`MapInput`** (from the three `game.on` handlers, `mapClick`, `radarClick`, `endBox`): the engine's mouse
  events to what they mean on the map. `mapClick`'s if chain becomes a switch on `interaction.mode`, each case a
  short method (`missileAt`, `placeAt`, `targetAt`, `selectAt`). The box drag is its own `BoxDrag` (and 03i's B,
  `RubberBand`, when that lands: `MapInput` then takes it).
- **`BattleEvents`** (from `PlayScreen.event`): the server's events switched to the parts that answer them
  (`TopBar.say`, `HintBox.show`, `GameSounds.play`, `Radar.switched`, `UnitSprites.blink`, `Deaths`); takes those
  parts.
- **`Deaths`** (from `death`, `DEATHS`, `STRUCTURE_EXPLOSION`, `DEATH_CRY`): a destroyed thing's explosions and cry.
- **`Announcer`** (from `announce`, `unitDestroyed`): the message line's words for a selection and a loss; takes
  `TopBar`, the strings and tables.
- **`HintPolicy`** (from `selectionHint`, `placed`, `hinted`): which hints the page shows once and tells the server
  of; takes `HintBox`, `Orders`, `Battle`.
- **`Keyboard`** (from the end of `update`): the arrow keys' scrolling and the letters' shortcuts; takes `Input`,
  the map and the `PanelButtons`.
- **`MapStage`** (from the `ready` half of `draw`): the map's scenes brought up to date (`MapView`,
  `StructureSprites`, `UnitSprites`, `Explosions`, `Trails`); `MapView` takes its marks drawer at construction
  (`foreground`) and shows or hides itself by a method, so nothing sets `scene.visible` from outside.
- **`PlacingMarks`** (from `drawMarks`, `drawPlacing`): the selection's and the footprint's marks over the map;
  takes `MapMarks`, `Interaction`, `Selection`, `Battle`, `UnitSprites`.

### The sidebar in parts

- **`PanelButtons`** (from `Sidebar.bind`, `orders`, `orderButton`, `targeted`, `repairButton`, `actionButton`,
  `act`, `status`, `shortcut`, `palaceReady`): what the panel offers and what a press does; takes `Interaction`,
  `Selection`, `Battle`, `Orders`, the tables and strings. Pure enough to spec every rule (which orders a group
  shares, Build it / On hold / Place it, R for Repair).
- **`PanelPainter`** (from `Sidebar.draw` and `drawPlacing`): the panel drawn for a `PanelButtons`; the structure
  kinds' extra boxes become a table from type to a small painter class (`PalacePanel`, `StarportPanel`,
  `InfoPanel` from `drawInfo` and `drawLines`), looked up with a switch, each taking `PanelArt` and `Widgets`.
- `Widgets.rect` becomes a switch; `PanelArt` is given, not made lazily.

### The windows

- **`WindowButtons`** (new, from the three windows' button lists and `click`s): buttons as `box` hotspots on the
  `ModalScreen`'s own `Hotspots`, drawn by `WindowArt`; `OptionsScreen`, `SaveLoadScreen` and `GameControlsScreen`
  declare their buttons and lose their `click`.
- **`HoldPolicy`** (new): whether a window holds the game (one person's) — one object, taking `Battle`, given to
  the windows in place of `people()` and the `holds` field set in `show`.
- **`FactoryOffer`** (from `FactoryWindow.show`'s item building, `more`, `spent`, `sendOrder`'s items): the window's
  model (items, availability, stock, prices, amounts, the credits left), specced on its own; `FactoryWindow` keeps
  the painting and hotspots and takes a `FactoryOffer`.
- **`MentatHelpScreen`** splits its keys (`HelpKeys`) and scroll bar (`ScrollBar`, which `MentatHelpList` already
  half is) from the subject's reveal.
- `SaveLoadScreen.key` becomes a switch; `MentatScreen` stops reading `hotspots.list[i]` (it keeps its spots) and
  takes `Browser.random` for `MentatFace`.

### The assets by role

`Assets` becomes a loader (`AssetLoader`, taking `Browser`) that returns role bundles, and each class takes only
its bundle: **`Pictures`** (sprites, tiles, the fonts, the frames, the radar static), **`Tables`** (units,
structures, landscape, actions, houses, the icon map, widgets, explosions), **`Strings`** (DUNE, MESSAGE, TEXT,
MENTAT, REGION), **`CampaignArt`** (herald, misc, the Mentats and their buttons, the map screen's), **`FactoryArt`**
(the baked window) and **`SoundTable`**. `wsaPicture`'s cache becomes a `PictureStore`. A spec of `Announcer` then
builds a `Strings` with three entries, not the game.

### Small habits

- The `Facings` at module level become fields of the class that uses them (or one `UnitFacings` given to
  `UnitEntity` and `Explosions`); `UnitEntity.wormTable` becomes a table `HouseColours` makes once.
- `UnitEntity.show`'s chain becomes a table from display mode to a look (`WormLook`, `AirLook`, `RocketLook`,
  `InfantryLook`, `VehicleLook`), each a class with `show(entity, unit, info, position, table, walk, step)`.
- `GameClient` takes `onWelcome`, `onEvent`, `onClose`, `onTick` in its options (a `lib/` change, additive) so the
  assembly passes them rather than patching fields.
- `ModalScreen.draw` takes the pointer from its `Screen` (the engine gives screens `mouseMove`) rather than
  `engine.mouseX`; `GameControlsScreen` asks `Display` for the zoom, which asks the engine's size itself.

## Specs

A `spec/` folder in `local/duneii` with a Jasmine config (`npx jasmine --config=spec/support/jasmine.json`; never
`npm test`), running in Node as Tenkai's own do: `IndexedSurface`, `IndexedFont`, `Hotspots`, `Roster` and the
rest have no DOM. The specs are of decisions, not pictures: `PanelButtons` (orders a group shares, the status
words, Repair and Upgrade, the letter shortcuts), `FactoryOffer` (items, the starport's stock and prices, + and -
against credits), `Interaction` and `MapInput` (a click in each mode sends the right order through a stand-in
`Orders`), `BattleEvents` (each event to its part), `HintPolicy` (once a game, the server told), `Announcer` (the
harvester's words), `Deaths`, `HoldPolicy`, `Widgets.rect` at two window sizes, `HouseColours`, `Selection`
(already pure). Painters are not pixel-tested in specs: they are checked in the tab and by `tools/checks/screenshot.mjs`
side by side, as now (the user: no baseline gating).

## Order and checks

Each step is behaviour-neutral and its own commit; after each: the client built (`npx esbuild remake/client/main.js
--bundle --format=esm --outfile=remake/out/main.js`), `npx jasmine` in `local/duneii` once specs exist, the page
tried in a tab on the private port 8064 against the same save (the parts the step touched: a click in each mode,
the panel for a unit, a yard, a factory, the palace and the starport, each window), and the server checks untouched
(the server is not changed; build-check and the round trips stay as a guard).

1. **The ports and the root:** `Browser`, `Orders` (with `OrderFeedback`), `Battle`, `ClientAssembly`; `DuneClient`
   and `PlayScreen` build nothing; every `order`, `state`, `house`, `people`, `credits`, `saves` closure replaced.
   The largest change and the one that makes the rest possible; mechanical, so first. The Jasmine config and the
   first specs (`Battle`, `Orders`) come with it.
2. **`PlayScreen` in parts:** `Interaction`, `MapInput`, `BattleEvents`, `Deaths`, `Announcer`, `HintPolicy`,
   `Keyboard`, `MapStage`, `PlacingMarks`, with their specs. `PlayScreen` under 150 lines.
3. **The sidebar in parts:** `PanelButtons`, `PanelPainter` and the per-kind painters, with `PanelButtons`' specs.
4. **The windows:** `WindowButtons`, `HoldPolicy`, the three windows on them; `FactoryOffer` out of `FactoryWindow`.
5. **The assets by role.** Touches every constructor's signature, so after the parts are settled.
6. **The small habits:** the facings, the looks table, the switches, `GameClient`'s callbacks in its options.

**Done (2026-10-14): step 1.** `Browser`, `Connection` (the client once joined; `Battle` reads through it, `Orders`
sends through it), `Battle`, `Orders` with `OrderFeedback`, `Interaction` (so the sidebar's closure bag went too),
`ClientAssembly` (the only `new` of collaborators; `DuneClient` and `PlayScreen` build nothing; `CampaignView` and
`Radar` take their screens and parts), every `order`, `state`, `house`, `people`, `credits`, `saves`, `document`,
`now` and `random` closure or global replaced; `MapView.show`, `PlayScreen.hide` and `aiming` in place of the
engine reaching in. Still closures, for step 4: the Options window's `saveLoad` and `controls`, Game controls'
`back` (the two open each other). Specs: `spec/` in `local/duneii` (`npx jasmine --config=spec/support/jasmine.json`),
`Battle`, `Orders`, `OrderFeedback`, `Interaction`. Checked in a tab: the yard selected at the start, a unit's
announcement, Move and its target, the yard's hint and build window, Build This, Options and Continue, the Mentat's
help with a subject, and on a second server the house choice and the Bene Gesserit's introduction.

**Done (2026-10-14): step 2.** `PlayScreen` is 154 lines, the order of things only. Out of it: `PlayInput` (the
mouse: the hotspots, the box, `mapClick` a switch on `Interaction.mode`, `radarClick`, the Mentat opened),
`BattleEvents` (the server's events to their parts, a structure placed), `Deaths`, `Announcer`, `HintPolicy`,
`Keyboard`, `MapStage` (the scenes brought up to date, the trails), `PlacingMarks` (given to `MapView.decorate`:
nothing sets a scene's `foreground` from outside). Specs for `BattleEvents`, `Deaths`, `Announcer`, `HintPolicy`,
`PlayInput` (a click in each mode, the box, the radar) and `Keyboard`: 28 in all. Checked in a tab: the yard at the
start, a unit announced, M and its target, the box (4 UNITS), the yard's hint, the build window, the Mentat's help.

**Done (2026-10-14): step 3.** `Sidebar` is gone: `PanelButtons` (what the panel offers and what a press does,
specced: the orders a group shares, at once or targeted, the letters and R, the production words and the button's
orders, the palace's readiness) and `PanelPainter` (the box, name, picture, health, the orders, the button under
the picture), which switches the structure's kind to `PalacePanel`, `StarportPanel`, `InfoPanel` and
`ProductionPanel`, with `PlacingPanel` while placing; `PanelArt.button` and `label` for what they shared. 33 specs.
Checked in a tab on a copy of the user's SCENA013 save: the yard's Repair and Build it, a windtrap's power, a
refinery's spice, an outpost's radar scan, and on SCENA004 the unit and group panels.

**Done (2026-10-14): step 4.** `WindowButtons` (a window's buttons as box hotspots of its own `Hotspots`, acting
at the press as the original's windows do, drawn by `WindowArt`): the Options window, its saved games and Game
controls lose their `click`s and `inside` lambdas. `HoldPolicy` given to `ModalScreen` (`policy`), so no window sets
`holds` in `show`. `FactoryOffer` is the factory window's model (the items and their order, the one chosen and the
strip's slot, the starport's picks against stock and credits, the orders to send, the upgrade's cost), specced;
`FactoryWindow` keeps the painting and hotspots. `SaveLoadScreen.key` is a switch. 39 specs. Still closures: the
Options window's `saveLoad` and `controls`, Game controls' `back` (the two open each other); still to split:
`MentatHelpScreen`'s keys and scroll bar. Checked in a tab: Options, Game controls and Previous, Save this game
with a name typed, Restart's question and No, Continue, the yard's build window, its arrow and Build This.

**Done (2026-10-14): step 5.** `Assets` is gone: `AssetLoader` returns `Pictures`, `Tables`, `Strings`,
`CampaignArt`, `FactoryArt` and a `PictureStore` (the WSA pictures loaded when wanted), and every part takes only
the field it uses (`sprites`, `messageFont`, `strings` for DUNE.ENG, `units`...), the assembly handing them out. One
latent race found on the way and closed: the welcome's view can be from the tick before the join, so its players
list lacks the house; `Battle.house` falls back to the welcome's own house until the state lists the player (the
yard was not selected on a fresh server's first load, with the old code too). Checked in a tab: a fresh server's
first load, the unit and yard panels, the build window with its pictures, the Mentat's help, the house choice and
the Bene Gesserit's introduction.

**Done (2026-10-14): step 6.** The module-level `Facings` are one `UnitFacings` given to the looks, `Explosions`
and `StructureSprites`; `UnitEntity.show`'s chain is `UnitLooks`, a table from a unit type to its look
(`WormLook`, `AirLook`, `RocketLook`, `InfantryLook`, `VehicleLook`, `SingleLook`, the ground ones on `GroundLook`
for the turret, smoke and spray), the worm's tint made once by `HouseColours`; `Widgets.rect` is a switch;
`ModalScreen` keeps its own pointer from the moves the engine passes it (the Mentats' faces and the held buttons
read it); `Display.current` and `next` answer for the window, so Game controls asks nothing of the engine;
`MentatScreen` keeps its spots. Specs for `UnitLooks` (the table, a vehicle's turret, mirroring and smoke) and
`Widgets.rect` at two window sizes: 43 in all. Checked in a tab on the SCENA013 copy and headless
(`tools/checks/screenshot.mjs`).

**Left (2026-10-14):** the Options window's `saveLoad` and `controls` and Game controls' `back` closures (the two
windows open each other: a `Windows` navigator, or the assembly giving each the other after construction, would
end them); `MentatHelpScreen`'s keys and scroll bar as their own classes; `Radar.draw`'s colour lambda. None of
them blocks 03i's A and B.

03i's A (camera) and B (box selection) fit after step 2 (`MapInput` is their caller) and need not wait for the rest.
What this plan does not do: no change to any order sent, any pixel drawn or any sound played; no change to the
server or to `lib/` beyond the additive `GameClient` option; no new abstractions beyond the classes named.
