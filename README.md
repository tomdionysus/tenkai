# Tenkai

[![Coverage Status](https://coveralls.io/repos/github/tomdionysus/tenkai/badge.svg?branch=master)](https://coveralls.io/github/tomdionysus/tenkai?branch=master)
[![NPM version](https://img.shields.io/npm/v/tenkai.svg)](https://www.npmjs.com/package/tenkai)

Tenkai is a 2D game engine written in JavaScript. It is designed to create games that run in the browser using standard PNG/JPG/MP3 assets, supporting multiple nested scenes and entities (sprites/mobs), audio and sfx, and an event driven management system. 

When combined with the [Electron](https://electronjs.org/) project, Tenkai can be used to build standalone games that run on a variety of platforms including Windows, MacOS and Linux. 

## Installation

```
npm install tenkai
```

## Documentation

The documentation is in [docs](docs/README.md):

* [Getting started](docs/getting-started.md) - a sprite on screen and moving in a few minutes.
* [Architecture](docs/architecture.md) - the scene tree, the frame loop, coordinates and drawing order.
* [Examples](docs/examples.md) - a walkthrough of the example games.
* [Point-and-click adventures](docs/point-and-click.md) - building a Myst-style game.
* [API reference](docs/README.md#api-reference) - every class.

Tenkai is a set of CommonJS classes. Bundle a game for the browser with any bundler that understands `require`; the examples use [esbuild](https://esbuild.github.io).

## Point-and-click adventures

Alongside scenes, entities and tile maps, Tenkai has the pieces for slideshow-style adventures in the
style of Myst:

* `BufferedScene` - a back buffer and screen, so views are composed rather than redrawn, with dissolve and wipe transitions.
* `Video` - an entity that plays a movie, a range of it, a loop or the movie backwards.
* `Hotspots` - clickable and draggable regions with cursors.
* `SoundManager` - a background loop that cross-fades and sound effects, through Web Audio.
* `AssetCache` - images loaded on demand, for games with hundreds of views.
* `Cursor` - image cursors drawn on the canvas.

See [Point-and-click adventures](docs/point-and-click.md) for how they fit together.

## Examples

* [Arkanoid](examples/arkanoid) - a minimal brick breaker in one short file, the place to start. Run it with `npm run example:arkanoid` and open http://localhost:8046.
* [1945](examples/1945) - a vertically scrolling shoot-em-up. Run it with `npm run example:1945` and open http://localhost:8045.
* [Tim the Enchanter](examples/tim-the-enchanter) - a cat in a tile-based dungeon room, with a built-in map editor. Run it with `npm run example:tim` and open http://localhost:8048.
