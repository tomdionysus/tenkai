# FrameClock

`lib/FrameClock.js`

Turns elapsed seconds into whole frames of a fixed rate, keeping the rest for next time: the clock of something
that runs at its own rate apart from the engine's steps, such as an original's 50 Hz animation, a once-a-second
game clock or a menu's own passes. Call `frames(dt)` each step and run that many frames. A sum of steps that
should make a frame exactly can fall a hair short in floating point, so a millionth of a frame is allowed.

```js
import { FrameClock } from 'tenkai'

const clock = new FrameClock(50)
update (dt) {
  for (let n = clock.frames(dt); n > 0; n--) this.frame()
}
const seconds = new FrameClock(1)   // whole seconds, for a game clock
```

| Member | |
|---|---|
| `new FrameClock(rate)` | frames a second (default 50) |
| `frames(dt)` | how many whole frames `dt` more seconds make; the rest is kept |
| `reset()` | nothing carried over |
| `rate`, `period` | frames a second; one frame in seconds |
| `time` | the seconds carried over, less than a frame |

[Ticker](Ticker.md) runs on one.
