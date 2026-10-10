# HasEventsMixin

`lib/HasEventsMixin.js`. Internal: not exported from the package index, so use
`import HasEventsMixin from 'tenkai/lib/HasEventsMixin.js'`. See [Mixin](Mixin.md).

Named events with handler lists, used by [GameEngine](GameEngine.md). An event must be defined before
handlers can be added to it or it can be triggered.

```js
import HasEventsMixin from 'tenkai/lib/HasEventsMixin.js'

class Door {
  constructor () {
    HasEventsMixin(this)
    this.defineEvents(['opened', 'closed'])
  }

  open () {
    this.trigger('opened', this)
  }
}

var door = new Door()
door.on('opened', (d) => console.log('the door opened'))
```

## Methods

### `defineEvent(name)` / `defineEvents(names)`

Defines one or more events. Defining an event again clears its handlers.

### `undefineEvent(name)` / `undefineEvents(names)`

Removes events and their handlers.

### `on(name, fn)` / `addEventListener(name, fn)`

Adds a handler. Adding the same function twice has no effect. Returns the object, so calls can be chained.
Throws `'on: no such event <name>'` for an undefined event.

### `unon(name, fn)` / `removeEventListener(name, fn)`

Removes a handler. Returns the object. Throws for an undefined event.

### `trigger(name, ...args)`

Calls every handler with `args`. Each call is made from its own `setTimeout(..., 0)`, so handlers run after
the current code has finished, in the order they were added. An exception in one handler does not stop the
others. Throws for an undefined event.

### `getEventListeners(name)`

The array of handlers for an event. Throws for an undefined event.

## Options

`HasEventsMixin(obj, { events })` can start from an existing `{ name: [handlers] }` object, which is then
shared rather than copied.
