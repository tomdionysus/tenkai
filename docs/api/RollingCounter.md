# RollingCounter

`lib/RollingCounter.js`

A number shown as old games show money and scores: it runs toward its target a step at a time, by a share of the
difference (a quarter by default, at least 1, at most `most`), gathered in `fraction` parts before the number moves,
and a digit that changes rolls, the old one moving out of its box as the new one comes in. `offset` is how far the
roll has gone, in parts (negative when counting down).

```js
const credits = new RollingCounter({ divisor: 4, most: 128, fraction: 8 })
credits.step(house.credits)                                  // each step
credits.digits(6).forEach((d, i) => {
  if (!d.rolling) return draw(d.from, x + i * 10, top)
  draw(d.from, x + i * 10, top - credits.offset)
  draw(d.to, x + i * 10, top + 8 - credits.offset)
})
```

| Member | |
|---|---|
| `new RollingCounter({ divisor, most, fraction })` | defaults 4, 128, 8 |
| `step(target)` | one step toward the target; the first shows it at once |
| `shown`, `offset` | the number shown (null before the first step); the roll so far |
| `digits(count)` | the last `count` digits, spaces before: `{ from, to, rolling }` each |
