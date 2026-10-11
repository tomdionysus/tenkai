# Motion

`lib/Motion.js`

Scripted movement, as many older games move their characters: a character runs **scripts**, lists of steps
each made of a change in X, Y and Z and the frame to show. Each logic tick either the next step of the running
script is tried, or, when the command changes or the script has ended, a new script is chosen for the current
animation and command and its first step tried at once. A step is taken only if the world lets the body move;
a blocked step holds and is tried again next tick. Movement and the frames shown stay in step.

Motion is game logic, run from the game's tick, not by the animation clock (animation clips stay pure
animation; see [Entity](Entity.md)). It needs no sheet or canvas, so it runs the same in a spec or a headless
check as in the browser.

```js
import { Motion, IsometricWorld } from 'tenkai'

const motion = new Motion({
  scripts: [
    { steps: [[0, 0, 0, 0]], next: 0 },                    // stand
    { steps: [[1, 0, 0, 1], [1, 0, 0, 2]], next: 0 }       // walk +X, frames 1 and 2
  ],
  table: [[0, 1]],     // animation 0: command 0 stands, command 1 walks
  world,               // an IsometricWorld, or anything with move(body, dx, dy, dz)
  body
})
motion.setCommand(1)
// each logic tick:
motion.tick()
sprite.tile = [motion.frame, 0]
```

## Options

| Option | Default | Meaning |
|--------|---------|---------|
| `scripts` | `[]` | The scripts: `{ steps: [[dx, dy, dz, frame], ...], next }`. `next` is the animation the character is in once the script is chosen (optional). Scripts may carry anything else the game wants (event flags, say). |
| `table` | none | Which script each animation and command runs: `table[animation][command]`, a script's index or `{ script, reverse }`. |
| `lookup` | from `table` | `(animation, command) => { script, reverse }` or `null`, for a game whose table is encoded its own way. |
| `world` | none | What the body moves in: `move(body, dx, dy, dz)` returning `{ moved, blocker }`, as [IsometricWorld](IsometricWorld.md)'s does. |
| `body` | none | The body that moves: `{ x, y, z }`. |
| `frame` | `0` | The frame shown before any step. |
| `free` | none | `(body, step) => boolean`: steps taken without asking the world (characters rising through a floor, say). |

## Properties

| Property | Meaning |
|----------|---------|
| `anim`, `command` | The current animation and command. |
| `script`, `step`, `reverse` | The running script, the index of its next step, and whether it runs backwards. |
| `frame` | The frame to show: the last step taken's. |
| `blocked`, `blocker` | Whether this tick's step was refused, and what refused it when the world says. |
| `tried` | Where this tick's step was going, refused or not, for contact tests. |
| `ended` | Whether this tick took the script's last step (scripts often end with an event). |
| `finished` | Whether the running script has taken all its steps. |
| `changed` | The command changed: the next tick chooses again. |
| `carried` | Carried by something else (a lift): steps set the frame, the carrier places the body. |
| `ghost` | Steps go through walls and characters. |
| `freeSteps` | Steps still to take without asking the world; only steps that move count down. |

## Methods

### `setCommand(command)`

Sets the command; a change interrupts the running script at the next tick.

### `force(anim, command)`

Starts the script for this animation and command at the next tick, even if they are the current ones.

### `tick()`

One logic tick: chooses a script if the command changed or the script has finished, then tries its next step.

### `choose()`

Chooses the script for the current animation and command, from its first step, and takes on its `next`
animation.

## Subclassing

A game with its own rules extends it. Wreckers' `Mover` gives the original's table encoding as `lookup`, its
"aliens rise without the walls" rule as `free`, and after `super.tick()` reads the script's event flags to say
whether the character may fire.
