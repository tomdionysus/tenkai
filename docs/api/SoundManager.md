# SoundManager

`lib/SoundManager.js`

Plays sounds through the Web Audio API. There is one looping background sound, which cross-fades when it
changes, any number of effects over it, streamed music, and a voice for spoken lines. Sounds are fetched by
URL when first used, then cached.

Every sound goes through a **channel**, `music`, `effects`, `background` or `voice`, each with its own volume
under the overall one, so a player can turn the music down without losing the dialogue.

[`play()`](#playsrc--channel-loop-volume-offset-) is the general method: it returns a **handle** to stop,
seek or watch one sound, and it can start several clips together as **layers** of one sound, some looping
and some not, as games do with music written as separate instrument tracks.

```js
import { SoundManager } from 'tenkai'

// With the engine's start screen, the shared context is already unlocked when init runs
var sounds = new SoundManager({ base: 'sounds/', context: game.audioContext })

sounds.playBackground('wind.wav', { volume: 0.5 })
await sounds.playEffect('door.wav')   // resolves when the effect ends
sounds.playBackground('cave.wav')     // fades from wind to cave
```

## Browsers and sound

Browsers do not let a page play sound until the player has interacted with it: a click, a tap or a key
press. Until then an `AudioContext` stays suspended and media elements refuse to play. Every game with sound
has to get that gesture somewhere.

The simplest way is the engine's start screen. Give the [GameEngine](GameEngine.md) the `startScreen`
option and it shows a "click or press any key to start" screen after loading, waits for the player, unlocks
a shared `game.audioContext`, and only then calls `init`. Create the sound manager in `init` with that
context and sound plays from the first frame:

```js
class MyGame extends GameEngine {
  constructor (options) {
    super(Object.assign({ startScreen: { title: 'My Game' } }, options))
  }

  init () {
    this.sounds = new SoundManager({ base: 'sounds/', context: this.audioContext })
    this.sounds.playMusic('theme.mp3')
  }
}
```

Without a start screen, call `resume()` (or the engine's `unlockAudio()`) from your own click or key handler,
and expect anything played before then to be silent.

## Constructor options

| Option | Default | Meaning |
|--------|---------|---------|
| `base` | `''` | Prefix added to every URL. |
| `exclusiveEffects` | `false` | Each new effect stops the previous one, like the single effect channel of many older adventure games. |
| `context` | a new `AudioContext` | The audio context to use: the engine's `audioContext` once the start screen has unlocked it, or a mock in tests. |
| `createMusic` | `new Audio(src)` | Creates the media element music plays from. Pass a mock in tests. |

## Properties

| Property | Meaning |
|----------|---------|
| `context` | The `AudioContext`. |
| `background` | The URL of the current background sound, without the base, or `null`. |
| `effectPlaying` | Whether any effect is playing. |
| `fade` | Time constant in seconds for volume changes and fades (default 0.15). |
| `volume` | Overall volume, 0 to 1, for every channel. |
| `muted` | Whether all sound is silenced. Set it to mute and unmute. |
| `music` | The URL of the music playing, without the base, or `null`. |
| `voicePlaying` | Whether a line is being spoken, counting from when it was asked for, while it loads, so text can wait for it. |

## Methods

### `play(src, { channel, loop, volume, offset, loopStart, loopEnd })`

Play a sound and return its handle. `src` is a URL, or a list of layers that start together, each a URL or
`{ src, loop }`. The sound starts once all its layers have loaded, at the same moment; the handle works at
once, so the sound can be stopped or sought before it starts.

| Option | Default | |
|---|---|---|
| `channel` | `effects` | Which channel it plays on. |
| `loop` | `false` | Loop every layer that does not say otherwise. |
| `volume` | 1 | Its own volume, under the channel's. |
| `offset` | 0 | Start this many seconds in. |
| `loopStart`, `loopEnd` | whole sound | For looping layers: play from the start, then repeat this region (seconds), as sampled instruments and engine hums do. A layer can give its own. |

The handle has:

- `playing`: true from the call until every layer has ended, or it is stopped;
- `ended`: a promise resolved when it stops playing;
- `stop()`;
- `seek(seconds)`: restart every layer at that time. Looping layers wrap round; a layer that does not loop
  and is shorter than that stays silent. For keeping recorded music in step with a game that skips ahead.
- `volume`, which can be set.

```js
// Music in layers: the intro plays once, the drums loop under it
const theme = sounds.play([{ src: 'intro.ogg' }, { src: 'drums.ogg', loop: true }], { channel: 'music' })
theme.seek(12.5)
theme.stop()
```

### `playVoice(src, options)` / `stopVoice()`

Speak a line on the voice channel and return its handle. Only one line plays at a time: a new one stops the
last. Use `voicePlaying` to hold text on screen until the line has been said.

### `channelVolume(name)` / `setChannelVolume(name, volume)`

A channel's volume, 0 to 1, under the overall volume. Streamed music follows the `music` channel too.

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
