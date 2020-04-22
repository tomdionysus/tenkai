# Tenkai - Concepts

## GameEngine
The Tenkai GameEngine is a viewport bound to a `<canvas>` DOM element which contains the game.

The GameEngine is responsible for the top of the draw tree, and repaints the viewport every browser 'animation frame'.

The GameEngine can contain multiple Scenes, and also host its own Entities.

## Asset
An asset is a source for graphics in a game. The graphics could be background images, or tiles for TiledScenes or Entities (Animation frames).

A single asset can be used by multiple Entities and/or Scenes.

## Scene
A Scene is a a container for other Scenes and Entities, that may also contain a static background graphic, or a tiled map background.

Scenes can also contain child scenes which are independently drawn.

### BackgroundScene
A BackgroundScene is a Scene with a single background image drawn from an asset. The background image can be scaled or scrolled.

### TiledScene
A TiledScene is a Scene where the background image is composed of a grid of tiles - regular rectangular regions in the asset. In this way, a set of quite simple tiles can build up a complex background image, according to a tile map contained in the TiledScene. The background image resulting from mapping the tiles can be scaled or scrolled.

## Entity
An Entity is a graphic that can (optionally) be moved and animated. These are also known as sprites or mobs, and are used to represent characters or objects in the game. Entities are also used for props in a scene.

Entities draw their graphics from an Asset, which is divided into tiles - regular rectangular regions in the asset. The size of these tiles is defined when creating the Entity. For instance, an Asset may contain a large amount of 32x32 pixel tiles, each of which represents a frame in an animation. The Entity can select which tiles is currently shown, and animation is achieved by rapidly changing the tile.

Entities can also contain child Entities which are independently animated.
