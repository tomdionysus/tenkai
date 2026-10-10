# Tenkai Documentation

Tenkai is a small 2D game engine for the browser. It draws to an HTML5 canvas, organises a game as a tree of
scenes and entities, and loads images and sound for you. It also has the pieces for slideshow-style
point-and-click adventures: buffered views with transitions, movies, hotspots and image cursors.

The whole engine is around 2,400 lines of plain JavaScript, small enough to read in an afternoon. When these
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

### Scenes

- [Scene](api/Scene.md): the base container for child scenes and entities.
- [BackgroundScene](api/BackgroundScene.md): a scene with a single background image.
- [TiledScene](api/TiledScene.md): a scene drawn from a tile map, flat or in depth with characters among
  the scenery.
- [BufferedScene](api/BufferedScene.md): a back buffer and screen with dissolve and wipe transitions.
- [IndexedScene](api/IndexedScene.md): shows an indexed surface through a palette, with layers such as a
  cursor over it.

### Sprites and tiles

- [Sheet](api/Sheet.md): an image divided into tiles, with an anchor, animation clips, and for tilesets,
  what each tile is.
- [BitmapFont](api/BitmapFont.md): text from a sheet of glyph cells, recoloured, wrapped, measured and
  clipped, for the fonts of old games.
- [Entity](api/Entity.md): a sprite showing a tile of a sheet, positioned by its anchor, playing clips, with
  child entities.
- [Video](api/Video.md): an entity that plays a movie.

### Isometric

- [IsometricProjection](api/IsometricProjection.md): world (x, y, z) to screen and back, for any isometric or
  dimetric view.
- [IsometricWorld](api/IsometricWorld.md): the game's model of the world: regions, typed colliders with
  handlers, and bodies that move and block each other.
- [IsometricScene](api/IsometricScene.md): shows the world: entities placed by world position, drawn in
  depth order over a ground, with a camera.

### Indexed colour

- [Palette](api/Palette.md): colours for indexed images, with colour cycling, scaling for fades, and
  nearest-colour search.
- [IndexedSurface](api/IndexedSurface.md): a picture of palette indices, opaque or with transparency, with
  fills and blits.

### Images and sound

- [Asset](api/Asset.md): an image, loaded by the engine at start-up.
- [AssetCache](api/AssetCache.md): images loaded by path when first needed.
- [Audio](api/Audio.md): a sound or music track in an HTML audio element, loaded at start-up.
- [SoundManager](api/SoundManager.md): Web Audio background loops and sound effects.

### Point-and-click

- [Hotspots](api/Hotspots.md): clickable and draggable regions with cursors.
- [Cursor](api/Cursor.md): image cursors drawn on the canvas.

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
