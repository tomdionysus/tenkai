# Page

`lib/Page.js`

The page's globals as one object a game is given: the window and document (for listeners, local storage and
full screen), the clock, a random number, the page reloaded, its address, and a JSON file or an image loaded by
path. A game's parts take a `Page`, never the globals, so each can be built in a spec with a stand-in that has a
fixed clock and random.

```js
import { Page } from 'tenkai'

const page = new Page({ window })
const units = await page.json('data/units.json')
const tiles = await page.image('data/tiles.png')
const original = /[?&]original\b/.test(page.search)
```

| Member | |
|---|---|
| `window`, `document` | the page's |
| `now()` | milliseconds, the page's performance clock |
| `seconds()` | the same in seconds |
| `random(a, b)` | a whole number from a to b, both in |
| `reload()` | the page reloaded |
| `hostname`, `search` | the page's host name and query string |
| `json(path)` | a JSON file by path, parsed; rejects with the path and status when it cannot be read |
| `image(path)` | an image by path, loaded |

A game's own page class may extend it with what its page has (a key its settings are kept under, its server's
address).
