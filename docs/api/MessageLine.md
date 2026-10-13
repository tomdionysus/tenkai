# MessageLine

`lib/MessageLine.js`

A one-line status strip as old games run theirs (Westwood's, for one). Each message has an importance; a new one at
least as important as the next waiting takes its place; the line showing is held for `hold` steps unless something
more important waits; and a change scrolls, the old line sliding down out of the strip as the new one comes down
into it over `scroll` steps. A message already showing or waiting is not taken again (letter case aside).

It keeps the lines; the game draws them where `rows()` says, clipped to its strip.

```js
const line = new MessageLine({ hold: 900, scroll: 10, gap: 11 })
line.say('Harvester deployed.', 1)
// each step:
line.step()
for (const { text, y } of line.rows()) font.draw(strip, text, 9, top + y)
```

| Member | |
|---|---|
| `new MessageLine({ hold, scroll, gap })` | defaults 900, 10, and `scroll + 1` (pixels from the new line to the old as they scroll) |
| `say(text, importance)` | a message; higher importance shows sooner |
| `step()` | one step |
| `rows()` | `{ text, y }` each, `y` from where the line rests |
| `text`, `scrolling` | the line showing; whether it is changing |
