# SoundManager

`lib/SoundManager.js`

Plays sounds through the Web Audio API. There is one looping background sound, which cross-fades when it
changes, and any number of effects over it. Sounds are fetched by URL when first used, then cached.

```js
const { SoundManager } = require('tenkai')

var sounds = new SoundManager({ base: 'sounds/' })

// Browsers only allow audio after a user gesture
game.on('mousedown', () => sounds.resume())

sounds.playBackground('wind.wav', { volume: 0.5 })
await sounds.playEffect('door.wav')   // resolves when the effect ends
sounds.playBackground('cave.wav')     // fades from wind to cave
```

## Constructor options

| Option | Default | Meaning |
|--------|---------|---------|
| `base` | `''` | Prefix added to every URL. |
| `exclusiveEffects` | `false` | Each new effect stops the previous one, like the single effect channel of many older adventure games. |
| `context` | a new `AudioContext` | The audio context to use. Pass a mock in tests. |
| `createMusic` | `new Audio(src)` | Creates the media element music plays from. Pass a mock in tests. |

## Properties

| Property | Meaning |
|----------|---------|
| `context` | The `AudioContext`. |
| `background` | The URL of the current background sound, without the base, or `null`. |
| `effectPlaying` | Whether any effect is playing. |
| `fade` | Time constant in seconds for volume changes and fades (default 0.15). |
| `volume` | Overall volume, 0 to 1, for effects, the background and music. |
| `muted` | Whether all sound is silenced. Set it to mute and unmute. |
| `music` | The URL of the music playing, without the base, or `null`. |

## Methods

### `resume()`

Resumes a suspended audio context. Browsers suspend audio until the user interacts with the page, so call
this from a click or key handler.

### `load(src)`

Fetches and decodes a sound, caching the result. Returns a promise of the decoded buffer, or `null` if it
could not be loaded. You do not need to call it before playing; use it to preload.

### `playEffect(src, { volume, loop })`

Plays an effect at `volume` (0 to 1, default 1), optionally looping until stopped. Returns a promise that
resolves when the effect ends or is stopped, or at once if the sound cannot be loaded. With
`exclusiveEffects`, any playing effect is stopped first.

### `stopEffects()`

Stops every playing effect.

### `waitEffect()`

Returns a promise that resolves when the most recently started effect ends.

### `playBackground(src, { volume })`

Plays a looping background sound at `volume` (0 to 1, default 1).

- If it is already the background sound, only its volume changes, and it carries on playing without
  restarting.
- Otherwise the old background fades out and the new one fades in.

### `setBackgroundVolume(volume)`

Fades the background to a new volume.

### `pauseBackground()` / `resumeBackground()`

Silences the background without losing its place, for example while a movie with its own soundtrack plays,
and brings it back.

### `stopBackground()`

Fades out and stops the background.

### `preload(srcs)`

Loads several sounds ahead of playing them. Returns a promise that resolves when all have loaded or
failed.

### `playMusic(src, { loop, volume })`

Plays music, streamed from a media element rather than decoded into memory, so long tracks start at once
and cost little. `loop` defaults to true and `volume` to 1. Any music already playing stops. Golden Axe's
soundtrack, 30 MB of MP3s, plays this way.

### `stopMusic()`

Stops the music.

## Notes

- Sounds are fetched with `fetch`, so they must be served over HTTP from somewhere the page may read.
- Effects and background sounds are decoded once each and kept in memory, which suits short sounds. Use
  `playMusic` for long tracks.
