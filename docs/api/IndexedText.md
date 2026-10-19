# IndexedText

`lib/IndexedText.js`

Text laid out with an [IndexedFont](IndexedFont.md), as old palette games write into their windows: lines broken at
`\n` a fixed height apart, each line centred within a width or the text wrapped at spaces to fit one, and numbers
right-aligned in so many places (the empty places blank, each as wide as a `0`). Centring halves the width and the
line's width separately, each rounded down, as such games do: an odd width lands a pixel left of the exact centre.

```js
const text = new IndexedText({ font, lineHeight: 10 })
text.draw(frame, 'COMPLETE FACILITIES FOR THE COMFORT OF 50 EMPLOYEES.', 16, 120, { colours: { 1: 28 }, wrap: 280 })
text.draw(frame, 'ENGINEERING SECTION', 96, 6, { colours: { 1: 27 }, centre: 160 })
text.number(frame, 1000, 128, 82, 6, { colours: { 1: 28 } })   // '  1000'
```

| Member | |
|---|---|
| `new IndexedText({ font, lineHeight })` | `lineHeight` from one line's top to the next's (default the font's height) |
| `draw(surface, text, x, y, { colours, centre, wrap })` | `colours` as the font's; `centre` a width from x to centre each line in; `wrap` a width to break lines at spaces within; returns the y below the last line |
| `lines(text, width)` | the lines it is drawn as (a word wider than `width` keeps its own line; 0 for no wrapping) |
| `number(surface, n, x, y, places, options)` | a whole number right-aligned in `places` places from x; options as `draw`'s |

Laid-out windows built from these by name: [TextBlocks](TextBlocks.md).
