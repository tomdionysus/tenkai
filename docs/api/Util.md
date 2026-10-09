# Util

`lib/Util.js`. Internal: not exported from the package index, so use `require('tenkai/lib/Util')`.

Static helpers used by the engine.

## Rectangles

Rectangles are arrays `[left, top, right, bottom]`.

### `Util.intersects(r1, r2)`

Whether two rectangles overlap. Edges are inclusive, so rectangles that only touch count as overlapping.

### `Util.bounding(r1, r2)`

The smallest rectangle containing both.

## Arrays

### `Util.sortBy(array, property)`

Sorts an array of objects by a property, in place, and returns it. Objects with equal values keep their
order.

## Timing

### `Util.delay(fn, wait, ...args)`

Calls `fn(...args)` after `wait` milliseconds. Returns the `setTimeout` id.

### `Util.debounce(fn, wait)`

Returns a function that calls `fn` once calls have stopped for `wait` milliseconds. Each call restarts the
wait. The returned function has `cancel()` to drop a pending call. It returns the result of the last
completed call.

Arguments are passed as a single value: `debounced(x)` calls `fn` with the individual items of `x`
(through `apply`), so pass an array, `debounced([a, b])`, or nothing.
