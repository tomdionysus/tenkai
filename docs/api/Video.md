# Video

`lib/Video.js`. Extends [Entity](Entity.md).

An entity that plays a movie, drawing its current frame at the entity's position like any other sprite.
It can play the whole movie, a range of it, a loop, or play backwards.

```js
var door = new Video({ src: 'movies/door.mp4', x: 216, y: 78 })
view.addEntity('door', door)
await door.play()            // resolves when the movie ends
view.removeEntity('door')
```

## Constructor options

All [Entity](Entity.md) options (position, `z`, `scale`, `rotate`, `visible`), plus:

| Option | Default | Meaning |
|--------|---------|---------|
| `src` | required | The movie's URL. |
| `loop` | `false` | Loop the movie, or its range. |
| `start` | `0` | Start time in seconds. `Infinity` means the end of the movie, for reverse playback. |
| `end` | the end | End time in seconds. |
| `reverse` | `false` | Play backwards from `start` down to `end`. |
| `muted` | `false` | Mute the movie's own soundtrack. |
| `element` | a new `<video>` | Use this video element instead, for example a mock in tests. |

## Properties

| Property | Meaning |
|----------|---------|
| `element` | The HTML video element. |
| `playing` | `true` until the movie ends or is stopped. Looping movies stay `true`. |
| `ended` | The opposite of `playing`. |
| `ready` | Whether a frame is available to draw. |
| `currentTime` | The current time in seconds. |
| `videoWidth`, `videoHeight` | The movie's frame size, once its metadata has loaded. |
| `done` | The promise that `play()` returns. |

## Methods

### `play()`

Seeks to `start` and plays. Returns a promise that resolves when the movie, or its range, ends. It also
resolves if the movie is stopped, fails to load, or the browser refuses to play it. Code that awaits a
movie therefore always carries on. A looping movie resolves only when stopped.

### `stop()`

Pauses and resolves the `play()` promise.

### `update()`

Keeps a ranged movie within its range, looping or stopping at `end`, and steps reverse playback. `draw`
calls it, so you only need to call it yourself if the video is not being drawn.

### `draw(context)`

Calls `update()`, then draws the current frame at its natural size with the entity's transform, if a
frame is ready.

## Notes

- **Ranges are checked as frames are drawn.** When the video is in a scene, it stops within a frame of
  `end`.
- **Reverse playback seeks backwards each frame.** Browsers cannot play video backwards, so it is as smooth
  as the browser's seeking. It works best with short movies encoded with frequent keyframes.
- **The last frame stays visible** while the entity is still in a scene. To keep it after removing the
  entity, draw it into a buffer first; for example,
  `video.draw(view.screenContext)` stamps the frame onto a [BufferedScene](BufferedScene.md)'s screen.
- **Browsers block autoplay with sound** until the user has interacted with the page. Start the first
  movie from a click.
- **Chrome pauses muted, video-only media in background tabs.** There, `play()` is refused, and the
  promise resolves at once.
