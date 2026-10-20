# WebGLScene

`lib/WebGLScene.js`. Extends [Scene](Scene.md).

A scene drawn through WebGL 2. It keeps a canvas of its own, calls `render(gl)` to draw into it each frame,
and then draws that canvas into the engine's canvas at the scene's place, under its child scenes and
entities. A 3D view so sits in the scene tree like any other layer: a HUD scene over it, screens on top.

```js
class View extends WebGLScene {
  render (gl) {
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }
}
game.addScene('view', new View({ width: 640, height: 400 }))
```

## Constructor options

All [Scene](Scene.md) options, plus:

| Option | Default | Meaning |
|--------|---------|---------|
| `width`, `height` | the game's | The canvas's size in pixels. Without them the scene takes the game's size when first drawn. |
| `render` | none | `render(gl)`, instead of overriding the method. |
| `createCanvas` | `document.createElement('canvas')` | Returns a new canvas, for tests. |
| `contextAttributes` | no antialiasing, alpha | Passed to `getContext('webgl2', ...)`. |
| `pixelated` | the context's setting | Draw the canvas without smoothing when the scene is scaled. |

## Properties

| Property | Meaning |
|----------|---------|
| `canvas` | The scene's own canvas. |
| `gl` | Its WebGL 2 context, or null where there is none (then nothing of the scene's own is drawn). |

## Methods

### `render(gl)`

Draws the frame. Does nothing; override it.

### `resize(width, height)`

Changes the canvas's size and the viewport, then calls `resized(width, height)`, which a subclass overrides
to remake buffers of the canvas's size.

### `WebGLScene.program(gl, vertex, fragment)`

Compiles and links a program from two shader sources, throwing an error that names the shader that failed
and its log.
