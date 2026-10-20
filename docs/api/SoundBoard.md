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
sounds.toggle('speech')   // the setup screen's SPEECH OFF
```

| Member | |
|---|---|
| `new SoundBoard({ engine, base, sounds, phrases, voices, channel, manager })` | `sounds` by number `{ file, rate, speech, group }` (`group` what it is switched on and off with: default `'speech'` for speech, `'effects'` for the rest); `voices` default 2; `channel` the effects' (default `'effects'`) |
| `enable(group, on)`, `toggle(group)`, `enabled(group)` | a group of sounds switched off (not played) or on; `toggle` answers whether it is on now |
| `unlock()`, `ready` | the first gesture: the audio context unlocked, sounds loaded |
| `play(n)` | a sound or a phrase; resolves when it has ended |
| `one(n)` | one sound, never a phrase |
| `playing(n)` | whether effect `n` is playing on a voice |
| `keep(n)` | effect `n` played unless it is playing: called while a sound should go on (an alarm), it starts again whenever it ends |
| `stop(n)` | effect `n` stopped on every voice playing it |
