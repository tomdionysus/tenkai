# Examples

The `examples/` folder has three games. Each is bundled with esbuild and served locally:

```
npm install
npm run example:arkanoid   # http://localhost:8046
npm run example:1945       # http://localhost:8045
npm run example:tim        # http://localhost:8048
```

esbuild rebuilds on every page load, so you can edit the code and refresh. `npm run build:examples` writes
minified `bundle.js` files for static hosting.

## Arkanoid

`examples/arkanoid/main.js`, about 190 lines. This is the place to start: a whole game in one file using
`GameEngine`, `Scene`, `Sheet` and `Entity`.

**Set-up.** `Arkanoid` extends `GameEngine`. Its options turn off wheel scrolling and zooming and bind the
keys it uses: `left`, `right` and `launch`. Its constructor declares one asset per sprite image.

**Sprites.** Every sprite is a whole image, so `init` makes a one-tile `Sheet` for each. The paddle, the
ball and the bricks are entities showing those sheets, with `width` and `height` from the sheet; the
collision checks use those.

**The board.** One `Scene` holds everything. Its `background` option fills the colour and its
`foreground` writes the score and messages, so no subclass is needed.

**Input.** The paddle follows the engine's `mousemove` event, using `mouseX`, which is already in game
coordinates however the page scales the canvas. A `mousedown` launches the ball. The arrow keys move the
paddle through `input.axis('left', 'right')`, and Space launches through `input.pressed('launch')`.

**The loop.** All logic is in `update(dt)`, run 60 times a second: it moves the paddle, then the ball.
The ball moves in sub-steps of at most four pixels, so a fast ball cannot pass through a brick within a
step. The angle off the paddle depends on where the ball lands.

**Changing sprites.** A grey brick takes two hits. On the first, the game swaps its `sheet` for the
cracked one. On the last, `removeEntity` takes it off the board.

## 1945

`examples/1945/`, a vertically scrolling shoot-em-up. It builds on Arkanoid with layered scenes, a sprite
sheet with animation clips, sprites rotating about their centres, child entities, timers and modes.

| File | Contents |
|------|----------|
| `main.js` | The game: modes, spawning, weapons, collisions. |
| `actor.js` | `Actor`, a game object wrapping an `Entity`. |
| `scenes.js` | The `Ocean` and `Hud` scenes. |
| `sprites.js` | The sheets: regions of the sprite image, with their clips. |

**Layers.** `init` adds four scenes with increasing `z`:

| Scene | z | Contains |
|-------|---|----------|
| `Ocean` | 0 | The sea and islands. |
| a plain `Scene` | 1 | Ships. |
| a plain `Scene` | 2 | Aircraft and bullets. |
| `Hud` | 3 | Score and title. |

Aircraft always pass over ships, and the HUD is always on top. `Ocean` paints the water and moving wave
lines in its `background`; `Hud` writes the score and health bar in its `foreground`, over the title and
game-over images.

**One image, many sheets.** Everything comes from `assets/sprite.png`, laid out as several grids of
differently sized tiles with borders between them. `sprites.js` makes a `Sheet` for each grid, with its
offset, tile size and spacing, anchored at the centre of its tiles, and with its clips: `fly` for the
propellers, `explode`, `surface` and `dive`. The engine's `pixelated` option keeps the scaled pixel art
sharp, so tile borders do not bleed into the sprites.

**Actors.** An `Actor` is the game's own object: a velocity, a hit box, hit points, and an optional
`think(actor, dt)` function for behaviour, around an `Entity`. Its position and angle are the entity's.
Because the sheets are anchored at the centre, rotating an enemy to face its direction of travel turns
it about its middle with no extra arithmetic.

**Animation.** Actors play their sheet's clips: `zero.play('fly')` loops, and
`boom.play('explode', () => boom.remove())` removes the explosion when its clip finishes. How each
animation ends is part of its clip. The explosion and the dive end on a tile with a delay of 0, which only
flashes up for one step. Surfacing plays tiles 5 to 1, and its callback puts up the surfaced tile 0 as the
submarine becomes a target.

**Child entities.** When a plane is hit it flashes white. The flash is a white silhouette from the `flash`
sheet, added as a child of the plane's entity. Children are positioned from their parent's anchor and move,
scale and rotate with it, so the silhouette always lines up; the game only toggles its `visible`.

**Modes.** `Title`, `Playing` and `GameOver` are modes. The title blinks its prompt and starts a game on
fire. Playing moves the player and runs the spawners. Game over shows its message, then uses a timer to go
back to the title after four seconds. The game's own `update` scrolls the ocean and moves every actor in
every mode, then `super.update(dt)` runs the mode's.

**Timers.** Squadrons fly in one plane at a time, submarines fire twice and dive, and hits flash, all
with `game.after(seconds, fn)`. Timers run on game time, in step with movement.

## Tim the Enchanter

`examples/tim-the-enchanter/`, a tile-based room in which Gallagher the cat walks behind, onto and in
front of the furniture, with a map editor built in. It shows `TiledScene` in depth, a tileset described
as data, grid movement, and modes.

| File | Contents |
|------|----------|
| `main.js` | The game: loading the map, Gallagher, walking. |
| `editor.js` | The map editor, a mode. |
| `map.json` | The room. |
| `assets/tileset_dungeon.json` | What each tile of the dungeon tileset is. |

**The tileset is data.** `tileset_dungeon.json` describes the tiles:
- Floor and rugs are flat.
- Walls and furniture are upright, with an elevation.
- A chair back, a table top and a bed head stand one row below where they are drawn (`stand: 1`), with
  the seat, legs or foot they belong to.
- Walls, seats and table legs are solid.
- Chair seats are marked `seat` for the game.

It also lists the furniture as objects, and holds the torch's clip. The game spreads it into a `Sheet`.

**The map is data.** `map.json` holds the room's layers, passed straight to the `TiledScene`, along with
the exits, the torch and the start position. Solidity comes from the tiles. The one exception is the
doorway in the top wall: its wall tile is overridden to be flat and passable.

**Depth.** The room is a `TiledScene` in `PERSPECTIVE_DEPTH`. Gallagher's sheet is anchored at the bottom
middle of his tile, where he stands, so his position is his feet:
- Behind the chair, he stands nearer the back than the chair does, and the back and table cover him.
- On the seat, his elevation is the seat's, so he is drawn over the seat but under the back.
- In front of the chair, he is drawn over it.

The torch is an entity standing just in front of the wall's base line, so the wall never covers it.

**Moving.** Gallagher is a small `Cat` object: which cell he is in, which way he faces, and how high he
stands. The `Play` mode asks `input.latest('up', 'down', 'left', 'right')` for the most recently pressed
arrow that is still held, so changing direction mid-walk feels right. `standingHeight` decides where he
can go: 0 on open floor, the seat's elevation on a chair seat, nowhere if the cell is solid. A step
glides him to the next cell over `STEP_TIME`, rising in a small arc when the height changes. He keeps
walking while the arrow is held. Reaching a door shows a message for three seconds, cleared by a timer.

**Animation.** The cat's sheet defines a walk clip for each direction, the columns `0, 1, 2, 1` of one row.
`play(dir)` is called at every step he takes, and since the clip is already playing the walk runs on
smoothly. When he stops, he shows the middle, standing frame.

**The editor.** Tab switches between the `Play` and `Editor` modes. The editor:
- moves a cursor;
- steps the tile in a layer through the tileset;
- places whole objects from the tileset's description, such as a chair, with its back in the row above;
- overrides a cell's solidity.

It edits the same `layers` the `TiledScene` draws, through `setTile`, so changes show at once. Z keeps the
map in `localStorage`, which the game loads in preference to `map.json`, and prints it as JSON; X goes
back to the original.

## Point-and-click

There is no point-and-click example in the repository yet. [Point-and-click adventures](point-and-click.md)
walks through a small one built from the same classes.
