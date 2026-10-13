# Tenkai Documentation

Tenkai is a small 2D game engine for the browser. It draws to an HTML5 canvas, organises a game as a tree of
scenes and entities, and loads images and sound for you. It also has the pieces for slideshow-style
point-and-click adventures: buffered views with transitions, movies, hotspots and image cursors.

The whole engine is around 6,000 lines of plain JavaScript, small enough to read in a day. When these
docs and the code disagree, the code in `lib/` wins.

## Start here

- [Getting started](getting-started.md): install Tenkai, put a sprite on the screen and move it.
- [Architecture](architecture.md): how the pieces fit together, the frame loop, coordinates and drawing
  order.
- [Examples](examples.md): a walkthrough of the Arkanoid, 1945 and Tim the Enchanter example games.
- [Point-and-click adventures](point-and-click.md): building a Myst-style game with `BufferedScene`,
  `Video`, `Hotspots`, `Cursor`, `SoundManager` and `AssetCache`.
- [Origin](ORIGIN.md): where Tenkai and its name come from.

## API reference

Everything below is exported from the package (`import { ... } from 'tenkai'`) unless marked as internal.

### Engine

- [GameEngine](api/GameEngine.md): the top-level container. It owns the canvas, fixed-step time, modes,
  timers, mouse events, and loading of assets and audio.
- [Input](api/Input.md): the keyboard, with keys bound to actions, sampled once per step.
- [StartScreen](api/StartScreen.md): the click-to-start screen browsers need before sound, with the Tenkai
  logo.
- [Screen](api/Screen.md): a scene shown over the game (a menu, a map, a dialogue) that takes the clicks
  first, steps on its own and can be drawn under the game's own HUD; the engine keeps a stack of them. Its
  buttons can act on release, in its own coordinates, and a modal screen takes every click.
- [MessageQueue](api/MessageQueue.md): a modal message box's messages, shown in turn, each held before a click can
  dismiss it.
- [MessageLine](api/MessageLine.md): a status line whose messages wait by importance, are held, and scroll in.
- [RollingCounter](api/RollingCounter.md): money or a score running toward its value, its digits rolling.

### Scenes

- [Scene](api/Scene.md): the base container for child scenes and entities.
- [BackgroundScene](api/BackgroundScene.md): a scene with a single background image.
- [TiledScene](api/TiledScene.md): a scene drawn from a tile map, flat or in depth with characters among
  the scenery.
- [Shroud](api/Shroud.md): the fog of war over a TiledScene: unseen cells covered, seen ground edged by its seen
  neighbours.
- [BufferedScene](api/BufferedScene.md): a back buffer and screen with dissolve and wipe transitions.
- [IndexedScene](api/IndexedScene.md): shows an indexed surface through a palette, with layers such as a
  cursor over it, and other palettes for ranges of lines.

### Sprites and tiles

- [Sheet](api/Sheet.md): an image divided into tiles, with an anchor, animation clips, and for tilesets,
  what each tile is.
- [BitmapFont](api/BitmapFont.md): text from a sheet of glyph cells, recoloured, wrapped, measured and
  clipped, for the fonts of old games.
- [Entity](api/Entity.md): a sprite showing a tile of a sheet, positioned by its anchor, playing clips, with
  child entities.
- [Roster](api/Roster.md): an entity for each thing of a changing collection (a game state's units), made, shown
  and taken off as things come and go.
- [Facings](api/Facings.md): the picture for the way a sprite faces: directions, mirrored halves, frames.
- [CommandList](api/CommandList.md): an animation as a list of commands (show, wait, wait at random, go back,
  stop), as old games script explosions and buildings.
- [Video](api/Video.md): an entity that plays a movie.

### Isometric

- [IsometricProjection](api/IsometricProjection.md): world (x, y, z) to screen and back, for any isometric or
  dimetric view.
- [IsometricWorld](api/IsometricWorld.md): the game's model of the world: regions, typed colliders with
  handlers, and bodies that move and block each other.
- [IsometricScene](api/IsometricScene.md): shows the world: entities placed by world position, drawn in
  depth order over a ground, with a camera.
- [Motion](api/Motion.md): a character's movement through scripted steps and animation frames.

### Indexed colour

- [Palette](api/Palette.md): colours for indexed images, with colour cycling, scaling for fades, and
  nearest-colour search.
- [IndexedSurface](api/IndexedSurface.md): a picture of palette indices, opaque or with transparency, with
  fills, lines, glyph bits, blits through colour tables or mirrored, remapping, and reading from (in colours or as
  palette numbers) and drawing to images.
- [PaletteFade](api/PaletteFade.md): the old machines' palette fade, a level a step, and the same fade for a
  held picture.
- [Dissolve](api/Dissolve.md): a picture dissolving in over another, scattered dots filling in, as old games
  faded a picture in without touching the palette.
- [IndexedSheet](api/IndexedSheet.md): pictures in palette numbers by number, cut from a grid or an atlas, joined
  into one numbering, drawn through colour tables or mirrored.
- [IndexedFont](api/IndexedFont.md): text in palette colours from glyphs kept as bits, a colour per layer (letter,
  shadow).
- [IndexedTileMap](api/IndexedTileMap.md): a tile map drawn into a window of a surface, with a scrolling view,
  hidden cells and the cell under a point.
- [IndexedSprites](api/IndexedSprites.md): an indexed sheet's pictures as Sheets for entities, in colour tables
  and mirrored, made once and kept.
- [Minimap](api/Minimap.md): a tile map drawn small (a radar): cells in colours, dots, the view's outline, the cell
  under a point.
- [Marks](api/Marks.md): outlines, corner marks and crossed boxes over a map, in palette colours.

### Images and sound

- [Asset](api/Asset.md): an image, loaded by the engine at start-up.
- [AssetCache](api/AssetCache.md): images loaded by path when first needed.
- [Audio](api/Audio.md): a sound or music track in an HTML audio element, loaded at start-up.
- [SoundManager](api/SoundManager.md): Web Audio background loops and sound effects.
- [SoundVoices](api/SoundVoices.md): a fixed number of voices, a new sound replacing the old unless held or
  of a higher priority, as old sound chips worked.
- [SoundBoard](api/SoundBoard.md): sounds by number, phrases played part after part, effects taking turns on
  voices, speech on its own channel, silent until the first gesture.

### Point-and-click

- [Hotspots](api/Hotspots.md): clickable and draggable regions with cursors.
- [Cursor](api/Cursor.md): image cursors drawn on the canvas.

### Games behind a server

Tenkai is client side: a game whose logic runs on a server (its own code) is a client of it.

- [GameClient](api/GameClient.md): the client of a game server: joining, input, commands and actions, each
  tick's state (as `StateDiff` patches) and events, and how far into the next tick it is.
- [Trails](api/Trails.md): where things were at the last two ticks, to draw them between ticks.
- [ServerFinder](api/ServerFinder.md): finding the server for the page, and `ServerConfig`, the screen that asks
  the player for its address.

### Building blocks

- [Mixin](api/Mixin.md): how Tenkai shares behaviour between classes.
- [HasEventsMixin](api/HasEventsMixin.md): named events with handlers (internal).
- [HasScenesMixin](api/HasScenesMixin.md): a named, z-ordered collection of scenes.
- [HasEntitiesMixin](api/HasEntitiesMixin.md): a named, z-ordered collection of entities.
- [Logger](api/Logger.md): levelled, printf-style console logging.
- [Util](api/Util.md): rectangle helpers, sorting, delay and debounce (internal).

## Conventions used in these docs

- **Rectangle**: an array `[left, top, right, bottom]` in pixels. Where it matters, right and bottom are
  exclusive.
- **Tile**: an array `[x, y]` that picks a tile by column and row, counted in tiles, not pixels.
- **Frame**: an animation frame, `[tileX, tileY]`, or `[tileX, tileY, delay]` to give it its own delay.
- **Anchor**: the point within a tile, `[x, y]`, that an entity's position refers to.
- Times are in milliseconds unless a page says otherwise. `GameEngine.update(dt)`, game timers, `Video` and
  `SoundManager` work in seconds, because that is what the browser media APIs use.
