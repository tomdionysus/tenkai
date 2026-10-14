# A client of a game behind a server

`lib/GameClient.js`, `lib/StateDiff.js`

Tenkai is a client-side framework. A game whose logic runs on a server (its own code, in Node or elsewhere) is,
in the browser, a client: it sends its player's commands and draws the state it is sent. `GameClient` is that
client, written against the browser `WebSocket`'s surface only. Several clients on one server make a multiplayer
game. [ServerFinder](ServerFinder.md) finds the server for the page.

```js
import { GameClient } from 'tenkai'

const client = new GameClient({ socket: new WebSocket('ws://host:8053/game'), name: 'Ann' })
client.onEvent = (event) => { if (event.name === 'sound') sound.play(event.data) }
// each frame: what the player holds (sent when it changes, given to every tick)
client.input({ up: true, fire: true })
draw(client.previous, client.state)
// a click on a button: done at once by the server, the new state sent straight back
client.act({ open: 'map' })
```

## The protocol

JSON strings both ways. From the client: `join` (a name and a wish), `input` (what the player holds, kept by the
server and given to every tick until it changes), `command` (once, at the next tick), `act` (an action done at
once, between ticks) and `leave`. To the client: `welcome` (the player `{ number, name, place }` and the whole
state), `tick` (a `StateDiff` patch to the last state and the player's events, after each tick and each action)
and `refused` (with the reason). A server that speaks this, such as Wreckers' (`local/wreckers/remake/server/`),
serves any `GameClient`.

## GameClient

| Member | |
|---|---|
| `new GameClient({ socket, name, wish, tickTime, now, onWelcome, onTick, onEvent, onClose })` | joins when the socket opens (at once if it is open already); `tickTime` (seconds a server tick) and `now` (milliseconds, default `performance.now`) are for `fraction`; the callbacks may be given here or set as fields |
| `connect(socket)` | the socket, for a client made without one: before the page has found its server, the parts that read the client's state (null until welcomed) and send its commands (nothing until connected) can be built and given it |
| `connected` | whether it has a socket |
| `player` | `{ number, name, place }` once welcomed |
| `state`, `previous`, `tick` | the last two states sent, to draw between |
| `fraction()` | how far the game is into the next tick, 0 to 1, by the time since a new tick arrived (a message after an action, at the same tick, starts none); 1 without a `tickTime` |
| `refused` | the reason, if refused |
| `input(fields)` | what the player holds now: sent when it changes |
| `command(fields)` | once, for the next tick |
| `act(action)` | done by the server at once; the new state follows |
| `leave()` | |
| `onWelcome`, `onTick(client, events)`, `onEvent(event)`, `onClose(event)` | |

## Drawing between ticks

A server's ticks come a few times a second; the page draws far more often. To move things smoothly, draw each
`fraction()` of the way from where it was at the tick before to where it is now, keeping where things were with a
[Trails](Trails.md):

```js
client.onTick = (client) => trails.tick(client.state.droids.map((d) => [d.id, d]))
// each frame:
const a = client.fraction()
for (const d of client.state.droids) entities[d.id].world = trails.between(d.id, d, a)
```

## StateDiff

`StateDiff.diff(a, b)` is a patch turning plain state `a` into `b` (undefined if equal);
`StateDiff.apply(a, patch)` returns the new state without changing `a`. A server uses it to send each client only
what changed, and `GameClient` applies it.
