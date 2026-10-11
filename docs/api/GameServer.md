# Game state, server and client

`lib/Place.js`, `lib/GameState.js`, `lib/StateDiff.js`, `lib/GameServer.js`, `lib/LocalSocket.js`,
`lib/GameClient.js`, `lib/WorkerSocket.js`

A game's logic can run apart from its drawing: the state is ticked by a server, and the page is a client that
sends its player's commands and draws what it is sent. The server can be in the same page, in a Worker, or on
another machine; the client talks to it through one interface with the browser `WebSocket`'s shape and does not
know which. Several clients make a multiplayer game.

```js
import { Place, GameState, GameServer, GameClient, LocalSocket } from 'tenkai'

const deck = new Place({ name: 'deck', agents: [doors, aliens, lifts] })
const state = new GameState({ places: [deck], maxPlayers: 3 })
const server = new GameServer({ state, tickTime: 0.07 })
server.start()

const client = new GameClient({ socket: new LocalSocket(server), name: 'Ann' })
// later, the same client against a server elsewhere:
// new GameClient({ socket: new WebSocket('ws://host:8080'), name: 'Ann' })
client.onEvent = (event) => { if (event.name === 'sound') sound.play(event.data) }
// each frame: what the player holds (sent when it changes, given to every tick)
client.input({ up: true, fire: true })
draw(client.previous, client.state)
// a click on a button: done at once, the new state sent straight back
client.act({ open: 'map' })
```

## Place

One level, room, map or station: its agents, ticked in order. An **agent** is any object with
`tick(place, commands)`, and, to be saved and sent, `snapshot()` and `restore(snapshot)`. Agents report what
happened with `place.emit({ name, data, to })`.

| Member | |
|---|---|
| `new Place({ name, agents })` | |
| `add(agent)`, `remove(agent)` | |
| `emit(event)` | from an agent: `to` omitted (everyone in this place) or `{ player }` |
| `tick(commands)` | ticks every agent; returns the tick's events |
| `snapshot()`, `restore(snapshot)` | the agents' snapshots in order |

## GameState

The whole game: places, players and the tick count. Subclass it for a game's rules.

| Member | |
|---|---|
| `new GameState({ places, maxPlayers })` | |
| `join(name, wish)` | a player `{ number, name, place }` numbered from 1, or null if full or refused |
| `leave(number)`, `player(number)` | |
| `tick(commands)` | commands `{ player, ... }` go to each player's place, in player order; returns the events, each with its `place` |
| `act(player, action)` | an action done at once, given to the player's place (`place.act(action, player)`); returns its events |
| `isFor(event, player)` | whether a player is sent an event |
| `snapshot()`, `restore(snapshot)` | |
| `view(player)` | override: what a player is sent (default everything) |
| `rules(events)`, `joined(player, wish)`, `left(player)` | override: the game's rules; set up or refuse a joining player (return false); a player gone |

## GameServer

Ticks a `GameState` and talks to its clients in JSON strings. From clients: `join`; `input` (what the player
holds, kept and given to every tick until it changes); `command` (once, at the tick it names, or the next one
run); `act` (an action done at once, between ticks); `leave`. To them: `welcome` (the player and the state),
`tick` (a `StateDiff` patch and the player's events, after each tick and each action) and `refused`. Each tick the
state gets one command per player: `{ player, ...input, actions: [the commands due] }`.

| Member | |
|---|---|
| `new GameServer({ state, tickTime })` | `tickTime` in seconds (default 1/20) |
| `start()`, `stop()` | its own clock |
| `advance(seconds)` | the caller's clock: runs the ticks due (a page ticking it with its frames) |
| `step()` | one tick now |
| `connect(send)`, `receive(connection, text)`, `disconnect(connection)` | for a transport: `LocalSocket`, a Worker's port, a WebSocket server |
| `attach(port)` | serves a client on a message port (a Worker's `self`): see WorkerSocket |

## LocalSocket

A connection to a server in the same page with the `WebSocket` surface: `send`, `close`, `readyState`
(`CONNECTING`, `OPEN`, `CLOSING`, `CLOSED`), `onopen`, `onmessage`, `onclose`, `onerror` and `addEventListener`.
Messages are strings both ways and arrive later, never inside `send`. `new LocalSocket(server, { schedule })`:
`schedule(fn)` decides when a message arrives (default a new task; `(fn) => fn()` for at once).

## WorkerSocket

A connection to a server in a Worker (or at the other end of any message port) with the same `WebSocket`
surface. The page: `new WorkerSocket(new Worker('server.js', { type: 'module' }))`. The worker:
`server.attach(self)` and `server.start()` (the server's own clock). `GameServer.attach(port)` serves one client on
a port: the socket's open and close requests, and the game's strings.

## WebSocketServer (Node)

`lib/node/WebSocketServer.js`, not exported by the index (it needs Node's `http` and `crypto`). Real WebSockets for
a `GameServer` under Node, with no dependencies: `new WebSocketServer({ http, server, path })` takes the HTTP
server's upgrade requests on `path`; each connection becomes one of the game server's, its text messages the
game's. The page connects with the browser's own `new WebSocket(url)`, which `GameClient` takes as it takes a
`LocalSocket` or a `WorkerSocket`.

## GameClient

| Member | |
|---|---|
| `new GameClient({ socket, name, wish })` | joins when the socket opens |
| `player` | `{ number, name, place }` once welcomed |
| `state`, `previous`, `tick` | the last two states sent, to draw between |
| `refused` | the reason, if refused |
| `input(fields)` | what the player holds now: sent when it changes |
| `command(fields)` | once, for the next tick |
| `act(action)` | done by the server at once; the new state follows |
| `leave()` | |
| `onWelcome`, `onTick(client, events)`, `onEvent(event)`, `onClose(event)` | |

## StateDiff

`StateDiff.diff(a, b)` is a patch turning plain state `a` into `b` (undefined if equal);
`StateDiff.apply(a, patch)` returns the new state without changing `a`. The server uses it to send each client
only what changed.
