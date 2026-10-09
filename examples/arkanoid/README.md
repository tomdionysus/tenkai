# Arkanoid

A minimal brick breaker, and the smallest complete game in the Tenkai examples. Everything is in
`main.js`. Read it first; [1945](../1945) builds on the same ideas.

## Run

```
npm install
npm run example:arkanoid
```

Then open http://localhost:8046.

## Controls

Move the paddle with the mouse or the arrow keys. Click or press Space to launch the ball.

## What it shows

- A `GameEngine` subclass: assets in the constructor, setup in `init()`, game logic in `update(dt)`
- One `Scene` subclass that draws a background and text around its entities
- `Entity` sprites from individual image files, positioned by setting `x` and `y`
- The engine's `mousedown` event, alongside plain DOM keyboard listeners

## Credits

Sprites from [Puzzle Game Art](https://opengameart.org/content/puzzle-game-art) by
[Kenney](https://www.kenney.nl), released under CC0. See `assets/LICENSE.txt`.
