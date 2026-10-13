# CommandList

`lib/CommandList.js`

An animation written as a list of commands, as old games script their explosions, smoke and buildings' lights:
show a picture, wait, wait a random time, go back, stop. Each command is `[name, parameter]`; the game says what each
name does with `handlers`, using the list's `wait`, `goto` and `stop`. `tick(now)` runs the commands due by `now`
(ticks, or any clock that only goes forward) until one waits. A command without a handler, or the end of the list,
stops it.

```js
const list = new CommandList({
  commands: [['SHOW', 180], ['WAIT', 3], ['SHOW', 181], ['WAIT_RANDOM', 6], ['LOOP', 0]],
  handlers: {
    SHOW: (c, n) => { smoke.sprite = n },
    WAIT: (c, n, now) => c.wait(n, now),
    WAIT_RANDOM: (c, n, now) => c.wait(c.random(n + 1), now),
    LOOP: (c, i) => c.goto(i)
  },
  now: time
})
// each tick:
if (!list.tick(time)) remove(smoke)
```

| Member | |
|---|---|
| `new CommandList({ commands, handlers, now, random, perTick })` | `random` a generator from 0 up to 1 (default `Math.random`); `perTick` the most commands a tick runs (default all that are due: a game that steps its lists one command a pass of its loop gives 1) |
| `tick(now)` | runs what is due (at most `perTick`); returns whether it still runs |
| `wait(ticks, now)`, `goto(i)`, `stop()`, `random(n)` | for handlers; `random(n)` a whole number below `n` |
| `current`, `due`, `done` | the next command, when it runs, and whether the list has stopped |
