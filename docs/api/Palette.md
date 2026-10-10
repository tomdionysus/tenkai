# Palette

`lib/Palette.js`

A table of colours for indexed images. Each pixel of an [IndexedSurface](IndexedSurface.md) is a number,
and the palette says what colour that number is when the surface is shown. Changing the palette changes every
pixel of that number at once, which is how palette games animate water and fire (colour cycling), fade the
screen, and darken a room without touching its pixels.

```js
const palette = new Palette({ colors: roomColors })
// Entries 16 to 23 rotate one place every 8 steps, like flowing water
palette.addCycle({ start: 16, end: 23, delay: 8 })
// In update(dt), once per step:
palette.advanceCycles(1)
```

## Constructor

`new Palette(options)`

| Option | Default | |
|---|---|---|
| `size` | 256 | Number of entries. |
| `colors` | black | Initial red, green, blue values, three per entry. |

## Properties

- `colors`: a Uint8Array of red, green and blue for each entry in turn. Read it directly for speed; change
  it with the methods below or directly.
- `size`: the number of entries (read only).
- `cycles`: the colour cycles added with `addCycle()`.

## Methods

### set(index, r, g, b) / get(index)

Set one entry, or get it as `[r, g, b]`.

### load(source, start, end)

Copy entries `start` to `end` (inclusive; default all) from `source`, three values per entry, indexed like
the palette.

### scale(source, start, end, r, g, b, max)

Set entries `start` to `end` to the source's colours scaled per channel, for fades and lighting: 255 keeps
the colour, 0 makes it black. Results are rounded down and capped at `max` (default 255).

### nearest(r, g, b, start, end, bits)

The entry between `start` and `end` (default all) closest to a colour, by the sum of the channel
differences; the first wins a tie. With `bits` below 8 the comparison is made at that precision, the
palette's values shifted down, as a VGA's 6-bit colour registers did; give `r`, `g` and `b` at that
precision too. Useful for building shadow and lighting tables.

### rotate(start, end, forward)

Rotate entries `start` to `end` one place. Forward (the default) moves each colour to the next entry and the
last to the first.

### addCycle({ start, end, delay, reverse }) / clearCycles()

Add a colour cycle, a range that rotates one place every `delay` units of whatever `advanceCycles()` is
given, steps or milliseconds as you choose. A delay of 0 holds it still. Returns the cycle, whose properties
can be changed later. `clearCycles()` removes them all, for example when the room changes.

### advanceCycles(amount, onRotate)

Advance every cycle by `amount`. A cycle that reaches its delay rotates once and keeps the remainder; it
rotates at most once per call. `onRotate(cycle, forward)` is called after each rotation, to rotate anything
that must follow the palette, such as a remapping table with `Palette.rotateRemap()`.

## Static methods

### Palette.rotateRange(table, start, end, forward, size)

Rotate entries of any table one place, each entry `size` values long (default 1). The palette uses it with
size 3; use it to keep other colour tables, such as a fade's target, in step.

### Palette.rotateRemap(table, start, end, forward)

Keep a colour-to-colour table (a shadow or lighting table) pointing at the same colours after the palette
range `start` to `end` has rotated: entries pointing into the range move with it, and the table's own entries
for the range rotate too.
