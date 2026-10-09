# Tim the Enchanter

Gallagher the cat explores a dungeon room, one tile at a time. There is also a map editor, which edits
the room in place.

This is a 2018 prototype brought up to date. The original ran on an early version of Tenkai's ideas,
with its own engine classes, a Node server to deliver the map, and a separate editor page. This version
keeps the room, the cat, the flickering torch, the walls and exits, and the editor, but it is written
against the current Tenkai API, runs as a static page, and puts the editor in the same page as the game.

## Run

```
npm install
npm run example:tim
```

Then open http://localhost:8048.

## Controls

| Key | Play | Editor |
|-----|------|--------|
| Arrow keys | Walk (hold to keep walking); walk off something to hop down | Move the cursor (or click a cell) |
| Space | Jump up onto a chair, the bed or a table, the way he faces or the arrow held | |
| Tab | Open the editor | Back to the game |
| Q / E | | Previous / next layer |
| A / D, W / S | | Step the tile in this layer across / down the tileset |
| Backspace | | Clear this layer of the cell |
| O / Enter | | Choose a piece of furniture / place it at the cursor |
| B | | Force the cell solid or open, or back to what its tiles say |
| Z | | Save the map in this browser, and print it to the console as JSON |
| X | | Revert to the original map |

In the editor, solid cells are tinted red and exits are outlined in green. To change the map for good,
save it with Z and paste the JSON from the console into `map.json`.

## What it shows

- `TiledScene` in depth: Gallagher passes behind and in front of the furniture, and jumps up onto chairs,
  the bed and the tables, with no drawing code of his own.
- A tileset described as data (`assets/tileset_dungeon.json`): which tiles are flat and which upright, how
  high each is, which row its object stands in, which are solid, and the furniture as whole objects.
- A map that is plain data (`map.json`), with solidity coming from the tiles.
- Grid movement with smooth steps between cells, driven by `update(dt)` and `input.latest(...)`.
- Clips from a character sheet anchored at the feet, and a torch clip from the tileset.
- Modes: playing and editing.

## Files

- `main.js`: the game, Gallagher and walking.
- `editor.js`: the map editor, a mode.
- `map.json`: the room, converted from the original's map data.
- `assets/tileset_dungeon.json`: what each tile of the dungeon tileset is.

## Credits

The game, its design and the map are by Tom Cully. The art is open assets, used with credit; see
`assets/CREDITS.txt` for sources and licences.

- Dungeon tileset (`assets/tileset_dungeon.png`): art by Stephen Challener (Redshrike), commissioned by
  OpenGameArt.org, from [16x16 Indoor RPG Tileset: The Baseline](https://opengameart.org/content/16x16-indoor-rpg-tileset-the-baseline),
  licensed under CC-BY 3.0 / OGA-BY 3.0. Scaled to 64x64 tiles, with editor marker tiles added.
- Gallagher (`assets/gallagher.png`): by [Elizabeth Gray](https://www.pinterest.nz/pin/280560251767070376).
- Cat and dog sprites (`assets/catdog.png`): by Cait, from
  [Updated Cat & Dog Sprites](https://www.rpgmakercentral.com/topic/24679-updated-cat-dog-sprites) on
  RPG Maker Central.

`assets/animals.png` and `assets/tileset_world.png` came over from the original project for what lies
beyond the room's doors. Nothing uses them yet.
