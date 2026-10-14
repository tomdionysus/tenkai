# Ticker

`lib/Ticker.js`

A status strip run as a ticker tape: messages enter at the right edge of a window a pixel column a frame and
cross it to the left, each followed by a gap, with a blank column when nothing waits. Up to `limit` messages wait
their turn, and one the same as the last accepted is dropped, so a repeated warning is not shown twice. `hold`
shows one text alone, scrolled in once and kept ("GAME PAUSED"), until `resume` restores the tape. The text is
drawn by a [BitmapFont](BitmapFont.md), clipped to the window, so the look is the game's.

A sibling of [MessageLine](MessageLine.md), which shows one message at a time by importance.

```js
import { Ticker } from 'tenkai'

const ticker = new Ticker({
  font, window: { x: 32, y: 145, width: 128, height: 7 }, colour: '#cc0000',
  onStart: (text) => archive.log(text)
})
ticker.post('WARNING PLASMODIAN WAVE')
update (dt) { ticker.update(dt) }
draw (context) { ticker.draw(context) }
```

| Member | |
|---|---|
| `new Ticker({ font, window, colour, step, rate, limit, gap, onStart })` | the font; the strip `{ x, y, width, height }`; the text's colour (optional); pixel columns a character (default the font's `cellWidth`); columns a second (default 50); messages waiting at most (default 16); what follows each message (default three spaces); `onStart(text)` as a message starts across |
| `post(text)` | a message waits its turn; false when the queue is full or it repeats the last accepted |
| `hold(text)`, `resume()`, `holding` | one text alone until resumed; whether one is held |
| `update(dt)` | the columns `dt` more seconds bring in |
| `draw(context)` | the tape through the font, clipped to the window |
| `tape`, `x` | the characters still in or entering the window, and where the first is drawn |
| `queue` | the messages waiting |
