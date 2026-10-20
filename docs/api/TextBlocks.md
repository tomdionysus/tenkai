# TextBlocks

`lib/TextBlocks.js`

Laid-out text by name, as old games keep their windows' words: each block a list of items run in order (texts and
values at their places, numbers in so many places, changes of colour, centring and wrapping, a pen for the plain
strings, flags that stop or skip the rest), drawn with an [IndexedText](IndexedText.md). The game gives the values
by name when it draws a block, so one block serves every state of its window. K240's windows are drawn this way
from the blocks its exporter read out of the original.

```js
const blocks = new TextBlocks({ blocks: layout.textBlocks, text: new IndexedText({ font, lineHeight: 10 }), words: (n) => texts[n] })
blocks.draw(frame, 'engineering', { param1: 'LIVING QUARTERS', param3: 1000 })
blocks.draw(frame, 'engineering', values, { colours: (c) => ({ 1: c + 16 }) })   // in a window's colours
```

A block is `{ x, y, width, items, centreShift, wrapIndent }`: centred lines are centred in its width from its x
(moved right by `centreShift`); wrapped ones wrap at the width less the runner's `margin` and the block's
`wrapIndent`. Its items, by `op`:

| op | |
|---|---|
| `colour` `{ colour }` | the colour from here on (a block starts in `startColour`) |
| `centre` `{ on }`, `wrap` `{ on }` | centring, wrapping on or off |
| `at` `{ x, y }` | the pen: where the next plain `string` goes |
| `text` `{ text, x, y }` | a text by its number; or `{ of }`: by the number a value holds, or the value if it is a string |
| `string` `{ string }` | a plain string at the pen; or `{ of, x, y }`: a value as it is |
| `number` `{ of, x, y, digits, signed }` | a value right-aligned in `digits` places (made positive unless `signed`) |
| `stopIfFlag`, `skipIfFlag` `{ items }` | with the value `flag` set: stop here, or skip the next `items` items (default 1) |

A missing value (or an empty string) leaves its item out. The `flag` may be a function, `(n) => boolean`, asked at
each stop or skip item with its ordinal in the block: a menu whose rows each follow a skip leaves out the one row
that blinks.

| Member | |
|---|---|
| `new TextBlocks({ blocks, text, words, colours, margin, startColour })` | `words(n)` a text by its number; `colours(colour)` the font's colours for a colour number (default `{ 1: colour }`); `margin` (default 0); `startColour` (default 1) |
| `draw(surface, name, values, { text, colours })` | a block with its values (`flag` a boolean or `(n) => boolean`); another font's `text` or other `colours` for this drawing; nothing for an unknown name |
| `has(name)` | whether there is such a block |
