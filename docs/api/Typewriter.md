# Typewriter

`lib/Typewriter.js`

Text let out a letter at a time, as old games type their screens' words: a count of letters out so far, one more
every so many steps, with a call for each as it comes (a click of the keys, a sound for a letter that is not a
vowel), and all the rest at once on a press. The screen draws the part let out with `shown`; several texts typed one
after another share the count, each told how many letters came before it. K240's Tetracorp and Sci-Tek screens type
this way.

```js
const typing = new Typewriter({ letter: (ch) => { if (!'AEIOU'.includes(ch)) sounds.play(3) } })
// each frame, drawing the lines in turn:
let before = 0
before += draw(typing.shown(welcome, before), 16, 16)
before += draw(typing.shown(advert, before), 16, 32)
if (typing.tick(welcome + advert)) next()
// a press: the rest at once
typing.all(welcome + advert)
```

| Member | |
|---|---|
| `new Typewriter({ every, letter })` | `every` steps between letters (default 1); `letter(ch, index)` called as each comes out (`ch` is `''` when `tick` is given a count) |
| `tick(text)` | one step: the next letter out when due; `text` the whole text being typed, or its length; returns whether all of it is out |
| `shown(text, before)` | the part of a text let out, `before` the letters typed before it (default 0) |
| `all(text)`, `done(text)`, `reset()` | the rest at once; whether all is out; back to nothing out |
| `typed` | letters out so far |
