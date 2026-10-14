# Phase 5: Rationalise the library

Noted on 2026-10-14, to be done as a pass of its own after the games' extractions (the user: "We'll do a pass
later on where we rationalise the common behaviour in Tenkai itself and bring it back to both games"). As
mechanisms arrive from the remakes (Wreckers, Dune II, Golden Axe), what comes in keeps resembling what is there.
Each arrival was added beside its neighbour rather than merged into it, on purpose: adding never disturbs a game
that uses the older class. But the resemblances look like underlying symmetries in the concepts, and a pass that
names them would make the library smaller to read and give the games one way to do each thing.

## The resemblances seen so far

- **Messages shown over time.** `MessageLine` (one line, held by importance, scrolled in), `Ticker` (a tape,
  queued, held for a pause), `MessageQueue` (a modal box's messages in turn, each held before a click). Three
  clocks, three queues, three ideas of "held". One queue with a policy (importance, order, modal) and one way of
  presenting (a line, a tape, a box) may be under them.
- **Pictures cut from a picture.** `Sheet` (a grid of equal tiles, with named clips and objects), `IndexedSheet`
  and `IndexedSprites` (the same in palette numbers, through colour tables, mirrored), `PictureAtlas` (named
  rectangles of any size), `Facings` (a facing's picture from mirrored halves), `BitmapFont` (a grid of glyphs,
  now with an origin and a pitch) and `IndexedFont`. All are "a region of a picture by a key"; the grid, the name
  and the glyph are three keys over one idea, and colour tables and mirroring are transforms that any of them
  could take.
- **Following and interpolating between ticks.** `Camera` (a flat scene's scroll after a target), the
  `IsometricScene`'s `camera` with `centerOn` and `glide`, `Trails` (where entities were at the last two ticks,
  to draw between them), and the games' own "from" bookkeeping (Wreckers' `ViewCamera.tick`). One "position
  between two ticks" with a snap grid, used by cameras and entities alike, would serve all of them.
- **Regions that take the pointer.** `Hotspots` (rect or box, groups, cursors, press or release, drag),
  `Buttons` (a set shown at a time, boxes on hotspots, a painter), `Screen`'s `click` with `hotspots`, `modal`,
  `through` and `covers`. The press-or-release choice, the enabled test and the coordinate space are decided in
  three places.
- **Things stepped a frame at a time.** `FrameClock`, `Shake`, `Dissolve`, `RollingCounter`, `CommandList`,
  `PaletteFade`, `Palette.advanceCycles`, the `Ticker`'s columns, `MessageLine.step`. Each has its own `step`
  and its own notion of being active or done; a common stepped interface (and a scene that steps its parts)
  would let a game's update list them rather than call each.
- **Layers drawn from a picture.** `BackgroundScene` (a region, now a strip repeated), `TiledScene`,
  `IndexedTileMap`, `Shroud`, `IndexedScene`'s layers. Repeating, scrolling and clipping are each done by the
  one that needed them first.
- **Colour variants.** `Palette.map`, `Palette.clone` and `set`, `PaletteFade`, `IndexedSurface.table` and the
  games' tints (`FrozenTint`, `HouseColours`). A variant is a function of a palette; the fade is a variant over
  time.
- **What shows now: modes and screens.** `GameEngine`'s modes (`setMode`: enter, update, draw, exit; Golden Axe's
  screens are modes) and the `Screen` stack (shown, under, modal, through; Wreckers' and Dune II's screens). Two
  ways of saying what the player sees and who gets the click, with different rules for input and stepping.
- **Collections kept in step with state.** `Roster` (an entity for each thing of a changing collection),
  `HasEntitiesMixin`, `Trails`, and the games' own lists with `removed` flags (Golden Axe's `Arena`).
- **The page's outside.** `Page`, `ServerFinder`, `ServerConfig`, `GameClient`, `SoundManager`'s context: the
  globals a game must be given rather than reach for, each wrapped on its own.
- **Pictures derived from a map.** `Autotile`, `Marks`, `Minimap`, `Shroud`.

## Patterns the games repeat that are not in the library

Each remake now has the same shapes, written three times: a composition root (`ClientAssembly` twice,
`GameAssembly`), a view of the game's state for the page (`Battle`, `PlayerView`), the player's orders by name
(`Orders` twice), the keys of play as a part (`PlayInput` twice), the flow between screens (`Flow`), a factory
for a round or a battle (`StageFactory`), parts given what they use and nothing else. Whether any of these
belongs in the library as a class, or only as a documented pattern with an example, is a question for the pass.

## How the pass would go

Not by rewriting: by finding the one idea under each cluster, writing it as a class the existing ones can be
expressed with, moving the existing ones onto it one at a time with their specs unchanged, and only then
bringing the games back onto the merged form. Every step keeps every game playing (the smoke test, the frame
scripts, the tabs) and every spec passing; a merge that would change a game's behaviour is a reason to stop and
look, not to adjust the game. The outcome is a library you can still read in an afternoon, with fewer classes
than today and each game using the same ones.
