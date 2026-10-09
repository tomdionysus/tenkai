# Audio

`lib/Audio.js`

A sound or music track, played through an HTML `<audio>` element. It can play a range of the file, loop,
and fade in and out.

Like assets, audio is normally declared on the engine and loaded at start-up:

```js
// in your GameEngine constructor
this.addAudio('theme', 'music/theme.mp3', 'audio/mpeg')

// later
var theme = this.getAudio('theme')
theme.loop = true
theme.fadeIn(2000)
```

For many short effects, or effects that must overlap, use [SoundManager](SoundManager.md), which uses
Web Audio.

## Constructor options

| Option | Default | Meaning |
|--------|---------|---------|
| `src` | required | The file's URL. |
| `type` | none | MIME type, such as `'audio/mpeg'` or `'audio/ogg'`. |
| `startTime` | `0` | Start of the range to play, in milliseconds. |
| `endTime` | the end | End of the range, in milliseconds. |
| `loop` | `false` | Loop the range. |

## Properties

| Property | Meaning |
|----------|---------|
| `element` | The `<audio>` element, created by `load()`. |
| `duration` | Length in milliseconds, once the metadata has loaded. |
| `startTime`, `endTime`, `loop` | The range and looping. Change them at any time. |

## Methods

### `load(callback)`

Creates the element and starts loading the whole file. The callback is called with no arguments once the
browser can play it through, or with `(error, audio)` if the file fails to load.

### `play()`

Plays from the current position. Browsers block playback until the user has interacted with the page.
Such refusals and interruptions are not thrown; they are logged, except for `AbortError`, which happens
normally when a track is paused or replaced.

### `playRange(start, end, loop)`

Sets any of `startTime`, `endTime` and `loop` that are given, then plays.

### `pause()`

Pauses at the current position.

### `stop()`

Pauses and rewinds to the beginning of the file.

### `fadeIn(duration, callback)` / `fadeOut(duration, callback)`

Fades the volume from 0 to full and starts playing, or from the current volume to 0 and then pauses.
`duration` is in milliseconds (default 1000). The callback is called as `(null, audio)` when the fade is
done. Starting a new fade cancels one in progress.

## Notes

- The range is enforced from the element's `timeupdate` event, which browsers fire only a few times a
  second. A range may therefore overrun `endTime` by up to about 250 ms. For exact loops, use
  [SoundManager](SoundManager.md).
- Seeking to `startTime` happens when the metadata loads, so the first play starts there. When a
  non-looping range ends, the element pauses where it stopped; set `element.currentTime` before playing it
  again.
