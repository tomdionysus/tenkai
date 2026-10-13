# SoundBoard

`lib/SoundBoard.js`

A game's sounds by number, as old games call them: each number a file at a rate, some numbers a phrase of others
played one after another ("unit" "deployed"). Effects take turns on a few [SoundVoices](SoundVoices.md), as a driver
alternates its channels, a new one replacing what that voice played; speech goes on the
[SoundManager](SoundManager.md)'s voice channel, a new line stopping the last. It is silent until the player's first
click or key (`unlock`, the browser's rule), when it loads every sound.

```js
const sounds = new SoundBoard({
  engine: game,
  base: 'sounds/',
  sounds: { 3: { file: 'click.wav' }, 20: { file: 'unit.wav', speech: true }, 21: { file: 'deployed.wav', speech: true } },
  phrases: { 14: [20, 21] },
  voices: 2
})
game.on('mousedown', () => sounds.unlock())
sounds.play(14)
```

| Member | |
|---|---|
| `new SoundBoard({ engine, base, sounds, phrases, voices, channel, manager })` | `sounds` by number `{ file, rate, speech }`; `voices` default 2; `channel` the effects' (default `'effects'`) |
| `unlock()`, `ready` | the first gesture: the audio context unlocked, sounds loaded |
| `play(n)` | a sound or a phrase; resolves when it has ended |
| `one(n)` | one sound, never a phrase |
