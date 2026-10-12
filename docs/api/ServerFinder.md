# Finding a server

`lib/ServerFinder.js`, `lib/ServerConfig.js`

For a game behind a server (see [GameClient](GameClient.md)): finding the server for the page, and asking the
player for its address when it cannot be found or the connection is lost.

`ServerFinder` tries, in order and without repeats:

1. the address given in the page's URL (`?server=ws://...`);
2. the page's own host's path (`ws://host:port/game`, or `wss://` on an https page): a server that serves the page
   too is found there;
3. the address the player last chose, kept in the browser's storage.
4. the suggestion: by default the page's host on port 8053, so a page from a development server on another port
   finds the game beside it.

With none answering, its `ServerConfig` asks the player for an address, again until one answers, and keeps it for
next time.

```js
import { ServerFinder, ServerConfig, GameClient } from 'tenkai'

const finder = new ServerFinder({ key: 'mygame-server', config: new ServerConfig({ document }) })
const { socket, address } = await finder.find()
const client = new GameClient({ socket, name: 'Ann' })
client.onClose = async () => {
  await finder.lost(address)
  window.location.reload()
}
```

## ServerFinder

| Option | |
|---|---|
| `key` | the storage key the chosen address is kept under, one per game |
| `config` | the `ServerConfig` that asks the player |
| `location`, `storage` | default `window.location`, `window.localStorage` |
| `path` | the server's path on the page's own host (default `/game`) |
| `param` | the URL parameter that gives an address (default `server`) |
| `suggestion` | the address tried last and offered when none was chosen yet (default the page's host, port 8053, the path) |
| `socket(address)` | makes a socket (default `new WebSocket(address)`) |
| `wait` | milliseconds a socket has to open (default 3000) |

| Method | |
|---|---|
| `find()` | resolves with `{ socket, address }`: the first candidate that answers, or the player's choice |
| `lost(address)` | the connection was lost: asks again, keeps and resolves with the answer |
| `candidates()` | the addresses tried, in order |
| `open(address)` | an open socket, or null when it cannot open in time |
| `first(addresses)` | `{ socket, address }` for the first that opens, or null |
| `own()`, `saved()`, `save(address)`, `suggested()` | the page's own address; the kept one; keep one; the suggestion |

A storage that throws (a private window, blocked site data) is treated as empty.

## ServerConfig

An HTML form over the game (text entry is the browser's own); the game's keys stay out of it while it shows.

| Member | |
|---|---|
| `new ServerConfig({ document, title, example })` | `title` heads it (default `Game server`); `example` is shown under the field |
| `ask({ message, address })` | shows it, saying why, with `address` in the field; resolves with the address entered |
| `say(message)` | a new message while it shows |
| `hide()` | |
| `ServerConfig.address(typed)` | what was typed as an address: trimmed, `ws://` added without a scheme; null if empty |
