# SoundVoices

`lib/SoundVoices.js`

A fixed number of voices for a game's sounds, as old sound chips and drivers had (the Amiga's four channels). Each
sound plays on a voice, and a new one replaces whatever that voice was playing, unless the sound playing is
**held** (it cannot be cut off until it ends) or has a higher **priority**. A **claim**, such as a tune, takes
every voice: it stops them all, and every other sound is refused while it plays. Sounds are played through a
[SoundManager](SoundManager.md).

```js
import { SoundVoices } from 'tenkai'

const voices = new SoundVoices({ manager: game.sound, count: 4 })
voices.play(0, 'sfx/shot.wav')
voices.play(3, 'sfx/scream.wav', {}, { hold: true })    // not cut off on voice 3 until it ends
voices.play(1, 'sfx/alarm.wav', {}, { priority: 2 })    // cut off only by priority 2 or more
voices.claim('music/title.ogg', { channel: 'music', loop: true })
```

| Member | |
|---|---|
| `new SoundVoices({ manager, count })` | `count` voices (default 4) |
| `play(v, src, options, { hold, priority })` | the sound on voice `v` (options as `SoundManager.play`); its handle, or null if refused |
| `playing(v)` | voice `v`'s sound while it plays, or null |
| `list` | each voice's last sound, or null |
| `claim(src, options)` | a sound that takes every voice; its handle |
| `claimed`, `claimPlaying` | the claim's handle; whether it plays |
| `release()` | stop the claim |
| `stopVoices()`, `stop()` | stop every voice; stop everything |
