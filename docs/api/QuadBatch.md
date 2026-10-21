# QuadBatch

`lib/QuadBatch.js`

Quads (sprites, HUD tiles, glyphs) gathered into one vertex array for one WebGL draw call: each quad is two
triangles, six vertices, laid out as the shader's attributes want them. The caller says what a vertex is made
of: each corner's own numbers (its place and texture coordinates) followed by numbers the whole quad shares (its
tile, its shade). The array grows as needed and is reused frame to frame.

```js
const batch = new QuadBatch({ floats: 7 })               // x, y, u, v, then tile, shade, flags
batch.begin()
batch.quad([[x0, y0, 0, 0], [x1, y0, 16, 0], [x1, y1, 16, 16], [x0, y1, 0, 16]], [tile, shade, flags])
gl.bufferData(gl.ARRAY_BUFFER, batch.vertices, gl.STREAM_DRAW)
gl.drawArrays(gl.TRIANGLES, 0, batch.count)
```

## Constructor options

| Option | Default | Meaning |
|--------|---------|---------|
| `floats` | 4 | Numbers a vertex: a corner's own and the quad's shared ones together. |
| `capacity` | 256 | Quads to make room for at first; it grows. |

## Methods and properties

| | |
|---|---|
| `begin()` | starts over: the next quad is the first |
| `quad(corners, shared)` | adds a quad: its four corners in order round it, each an array of its own numbers, and the array of numbers every vertex of it shares |
| `vertices` | the vertices gathered, a view of the array to give the buffer |
| `count` | vertices gathered since `begin` (six a quad) |
| `data` | the whole array, including room not yet used |
