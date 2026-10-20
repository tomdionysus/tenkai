# NameEntry

`lib/NameEntry.js`

A name typed with the keys, as old games take a saved game's or a colony's name: letters, digits and the signs
allowed added up to a longest, Backspace taking one back, Enter ending it and Escape giving it up. Keys come as the
browser's `KeyboardEvent.code` (`KeyA`, `Digit1`, `Space`, `Enter`...), so the letters are the keyboard's whatever
the layout; the event's `key` may be given too for a sign the codes do not cover. The game draws `text` with its own
cursor after it.

```js
const entry = new NameEntry({ longest: 15 })
entry.begin(asteroid.name)
// on each keydown:
switch (entry.key(e.code, e.key)) {
  case 'done': rename(entry.text); break
  case 'cancelled': stop(); break
}
draw(entry.text + cursor)
```

| Member | |
|---|---|
| `new NameEntry({ longest, signs, upper, allowed })` | `longest` (default 15); `signs` by key code, the character besides letters, digits and space (default `NameEntry.SIGNS`, a US keyboard's); `upper` letters in capitals (default true); `allowed` a RegExp for what the event's `key` may add when the code gives nothing |
| `begin(text)`, `end()`, `active` | typing begun with a text (default empty), ended; whether it is on |
| `key(code, key)` | a key: `'typed'` when the text changed, `'done'` on Enter, `'cancelled'` on Escape, else null; nothing while not begun |
| `character(code, key)` | the character a key types, or null |
| `text` | the name so far |
