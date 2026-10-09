# 1945

A vertically scrolling shoot-em-up built with Tenkai, after
[1945](https://github.com/tomdionysus/1945). The original was a multiplayer, free-roaming
game with a Node server. This is a single-player arcade take on the same idea, written from
scratch against the Tenkai API. Only the sprite sheet (`assets/sprite.png`) is reused.

## Run

```
npm install
npm run example:1945
```

Then open http://localhost:8045.

## Controls

| Key | Action |
|-----|--------|
| Arrow keys / WASD | Move |
| Space / Z | Fire (Space also starts a game) |

## Gameplay

- Squadrons of small fighters fly curved formations.
- Zeros dive in, then bank towards you and fire.
- Bombers are slow and armoured and fire spreads. They always drop a weapon power-up.
- Battleships fire from fore and aft turrets. They always drop a medal.
- Submarines surface, fire twice and dive. You can only hit them while they are surfaced.
- Weapon power-ups add side guns, up to three levels. Medals restore health.

## What it shows

- `GameEngine` subclass with `init()` for setup and `update(dt)` for game logic
- Scenes as draw layers: ocean, ships, aircraft, HUD (`Scene` z order)
- Custom `Scene.draw()` for a procedural background (`Ocean`) and HUD text (`Hud`)
- `Entity` with `tileOffsetX`, `tileOffsetY` and `tileSpacing` to use regions of a sprite sheet with borders
  between tiles (`sprites.js`)
- Looping and one-shot animations with `addAnimation` / `animateStart` and `onStop`
- Child entities: hit-flash silhouettes drawn over their parent aircraft

## Files

- `main.js`: the game (states, spawning, weapons, collisions)
- `actor.js`: a game object wrapping an `Entity`, positioned and rotated about its centre
- `scenes.js`: the `Ocean` and `Hud` scenes
- `sprites.js`: sprite sheet regions
