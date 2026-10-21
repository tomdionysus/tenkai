// Blood's 3D view: the Build map drawn through WebGL, as a Tenkai WebGLScene. Everything is drawn in palette
// numbers, as the original drew it: the tiles are 8-bit palette indices in a texture array, each pixel is put
// through its pal's shade table (by its shade and its distance) and then through the palette. So a map's shading,
// its pals (the cultists' robes, the spiders' colours) and the screen tints work as the original's do.
//
// The view is given the map (Build's sectors, walls and sprites, as formats/map.mjs reads them) and the tiles'
// index (data/tiles.json), loads the atlas pages, palettes and shade tables from data/, and draws from an eye:
// { x, y, z, ang, horiz } in Build's units. Sprites are given each frame as a list in Build's sprite fields.
import { WebGLScene } from '../../../../index.js'
import { mapGeometry, FLOATS, MASKED, TRANSLUCENT, TRANSLUCENT_MORE, SKY, ONE_SIDED, PORTAL } from './geometry.js'
import { mapLinks } from '../../common/links.mjs'
import { ANGLES, TAU } from '../../common/build.mjs'
import { visibleSectors, findSector } from './visibility.js'

const UNIFORMS = ['uEye', 'uFwd', 'uTan', 'uHoriz', 'uClock', 'uInfo', 'uTiles', 'uColors', 'uVisScale', 'uSkyOffsets', 'uSkyBits', 'uSkyV', 'uTint', 'uShadeRows', 'uDebug', 'uOffset', 'uClip', 'uFar']
// The portal pass's clip: its depth is how far beyond the portal's plane a point is, by this much a unit of depth
const CLIP_SCALE = 1 / 4096

// A tile's place (row 0: x, y, width, height) and animation (row 1: page, frames, kind, speed); 4096 tiles a pair
// of rows (the ART's, then Blood's fonts)
const INFO = 'ivec4 tileInfo (int pic, int k) { return texelFetch(uInfo, ivec2(pic & 4095, (pic >> 12) * 2 + k), 0); }'

const VERTEX = `#version 300 es
precision highp float;
precision highp int;
in vec3 aPos; in vec2 aUV; in float aPic; in float aShade; in float aPal; in float aFlags; in float aVis;
uniform vec3 uEye; uniform vec2 uFwd; uniform vec2 uTan; uniform float uHoriz; uniform float uClock; uniform vec3 uOffset;
uniform vec3 uClip; uniform int uFar; uniform int uShadeRows[16];
uniform highp isampler2D uInfo;
out vec2 vUV; out float vShade; out float vDepth; out vec3 vDir; out float vWorldZ;
flat out ivec4 vRect; flat out vec2 vSize; flat out vec2 vInvSize; flat out int vPage; flat out int vShadeRow; flat out int vFlags; flat out int vPic; flat out float vVis;
const float NEAR = 4.0, FAR = 400000.0;
${INFO}
int animate (int pic) {
  ivec4 q = tileInfo(pic, 1);
  int frames = q.y, kind = q.z;
  if (kind == 0 || frames == 0) return pic;
  int i = int(uClock) >> q.w;
  if (kind == 1) { int k = i % (frames * 2); return pic + (k < frames ? k : frames * 2 - k); }
  if (kind == 2) return pic + i % (frames + 1);
  return pic - i % (frames + 1);
}
void main () {
  vec3 d = aPos + uOffset - uEye;
  vWorldZ = aPos.z + uOffset.z;
  vec2 right = vec2(-uFwd.y, uFwd.x);
  float cx = dot(d.xy, right), cy = -d.z / 16.0, cz = dot(d.xy, uFwd);
  gl_Position = vec4(cx / uTan.x, cy / uTan.y + uHoriz * cz, cz * (FAR + NEAR) / (FAR - NEAR) - 2.0 * FAR * NEAR / (FAR - NEAR), cz);
  // Through a portal: the near plane is the portal's own (what is on the eye's side of it clipped away), the depth
  // how far beyond it, which keeps each pixel's nearest nearest; so the pass needs no discard
  if (uClip.z > 0.0) gl_Position.z = 2.0 * uClip.x * (vWorldZ - uClip.y) * ${CLIP_SCALE} - gl_Position.w;
  // (the depth set to the farthest: a portal's surface clearing the depth behind it)
  if (uFar == 1) gl_Position.z = gl_Position.w;
  vUV = aUV; vShade = aShade; vDepth = cz; vDir = vec3(d.xy, cy);
  vShadeRow = uShadeRows[int(aPal) & 15] * 64; vFlags = int(aFlags); vVis = aVis;
  vPic = (vFlags & ${SKY}) != 0 ? int(aPic) : animate(int(aPic));
  vRect = tileInfo(vPic, 0);
  vPage = tileInfo(vPic, 1).x;
  vSize = vec2(vRect.zw); vInvSize = 1.0 / max(vSize, vec2(1.0));
  // (a tile with no pixels: its triangle put off the screen)
  if ((vFlags & ${SKY}) == 0 && (vRect.z == 0 || vRect.w == 0)) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`

// Variants by #define: OPAQUE (solid surfaces: no discard, so the GPU drops hidden pixels before shading them), SKY
// (the parallax sky's triangles), HUD (clear pixels drawn clear), none (masked and see-through surfaces, sprites)
const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2DArray; precision highp isampler2D;
in vec2 vUV; in float vShade; in float vDepth; in vec3 vDir;
flat in ivec4 vRect; flat in vec2 vSize; flat in vec2 vInvSize; flat in int vPage; flat in int vShadeRow; flat in int vFlags; flat in int vPic; flat in float vVis;
uniform usampler2DArray uTiles; uniform sampler2D uColors; uniform isampler2D uInfo;
uniform float uVisScale; uniform int uSkyOffsets[16]; uniform int uSkyBits; uniform float uSkyV; uniform vec4 uTint;
out vec4 color;
${INFO}
void main () {
#ifdef SKY
  // Parallax sky: 2^bits tiles around the circle, by the direction of the pixel; level with the eye, a row of the tile
  float ang = atan(vDir.y, vDir.x); if (ang < 0.0) ang += ${TAU};
  float around = ang / ${TAU} * float(1 << uSkyBits);
  int slice = int(floor(around)) % (1 << uSkyBits);
  int pic = vPic + uSkyOffsets[slice];
  ivec4 r = tileInfo(pic, 0); int page = tileInfo(pic, 1).x;
  float v = clamp(uSkyV - vDir.z / length(vDir.xy) * 160.0, 0.0, float(r.w) - 1.0);
  ivec2 t = min(ivec2(fract(around) * float(r.z), v), r.zw - 1);
  int shade = int(vShade);
#else
  ivec4 r = vRect; int page = vPage;
  // (the texel within the tile, its repeats wrapped: by the reciprocal of its size, worked out once a triangle)
  ivec2 t = min(ivec2(vUV - floor(vUV * vInvSize) * vSize), r.zw - 1);
  int shade = int(vShade + vDepth * vVis * uVisScale);
#endif
  uint i = texelFetch(uTiles, ivec3(r.x + t.x, r.y + t.y, page), 0).r;
#if defined(HUD)
  // (the HUD writes no depth: a clear pixel is drawn clear, which costs this GPU far less than a discard)
  if (i == 255u) { color = vec4(0.0); return; }
#elif !defined(OPAQUE) && !defined(SKY)
  if (i == 255u && (vFlags & ${MASKED}) != 0) discard;
#endif
  // (the colour of palette number i at this shade of this pal, in the palette in use: one lookup, made in colors())
  vec3 rgb = texelFetch(uColors, ivec2(int(i), vShadeRow + clamp(shade, 0, 63)), 0).rgb;
  float a = (vFlags & ${TRANSLUCENT_MORE}) != 0 ? 0.34 : (vFlags & ${TRANSLUCENT}) != 0 ? 0.66 : 1.0;
  color = vec4(mix(rgb, uTint.rgb, uTint.a), a);
}`

// The HUD: tiles and text in the screen's pixels, through the same fragment shader (by the palette and the shades)
const HUD_VERTEX = `#version 300 es
precision highp float;
precision highp int;
in vec3 aPos; in vec2 aUV; in float aPic; in float aShade; in float aPal; in float aFlags; in float aVis;
uniform vec2 uScreen; uniform float uClock; uniform int uShadeRows[16];
uniform highp isampler2D uInfo;
out vec2 vUV; out float vShade; out float vDepth; out vec3 vDir; out float vWorldZ;
flat out ivec4 vRect; flat out vec2 vSize; flat out vec2 vInvSize; flat out int vPage; flat out int vShadeRow; flat out int vFlags; flat out int vPic; flat out float vVis;
${INFO}
int animate (int pic) {
  ivec4 q = tileInfo(pic, 1);
  int frames = q.y, kind = q.z;
  if (kind == 0 || frames == 0) return pic;
  int i = int(uClock) >> q.w;
  if (kind == 1) { int k = i % (frames * 2); return pic + (k < frames ? k : frames * 2 - k); }
  if (kind == 2) return pic + i % (frames + 1);
  return pic - i % (frames + 1);
}
void main () {
  gl_Position = vec4(aPos.x / uScreen.x * 2.0 - 1.0, 1.0 - aPos.y / uScreen.y * 2.0, 0.0, 1.0);
  vUV = aUV; vShade = aShade; vDepth = 0.0; vDir = vec3(1.0, 0.0, 0.0); vWorldZ = 0.0;
  vShadeRow = uShadeRows[int(aPal) & 15] * 64; vFlags = int(aFlags); vVis = 0.0;
  vPic = animate(int(aPic));
  vRect = tileInfo(vPic, 0);
  vPage = tileInfo(vPic, 1).x;
  vSize = vec2(vRect.zw); vInvSize = 1.0 / max(vSize, vec2(1.0));
}`

// Plain rectangles over the view (a darkened screen behind a tally)
const RECT_VERTEX = `#version 300 es
precision highp float;
in vec2 aPos; uniform vec2 uScreen;
void main () { gl_Position = vec4(aPos.x / uScreen.x * 2.0 - 1.0, 1.0 - aPos.y / uScreen.y * 2.0, 0.0, 1.0); }`
const RECT_FRAGMENT = `#version 300 es
precision mediump float;
uniform vec4 uColor; out vec4 color;
void main () { color = uColor; }`

const ATTRIBUTES = [['aPos', 3], ['aUV', 2], ['aPic', 1], ['aShade', 1], ['aPal', 1], ['aFlags', 1], ['aVis', 1]]

// Voxel models (KVX): each face of a model as two triangles in the model's own units, placed by its sprite
const VOXEL_VERTEX = `#version 300 es
precision highp float;
in vec3 aV; in float aCol; in float aSide;
uniform vec3 uEye; uniform vec2 uFwd; uniform vec2 uTan; uniform float uHoriz;
uniform vec3 uOrigin; uniform vec2 uDir; uniform vec3 uScale; uniform vec3 uPivot; uniform vec3 uOffset;
out float vDepth; flat out int vCol; flat out float vSideShade;
const float NEAR = 4.0, FAR = 400000.0;
void main () {
  vec3 m = (aV - uPivot) * uScale;
  // The model's x along the sprite's facing, its y to the right, its z down
  vec3 w = vec3(uOrigin.xy + uDir * m.x + vec2(-uDir.y, uDir.x) * m.y, uOrigin.z + m.z) + uOffset;
  vec3 d = w - uEye;
  vec2 right = vec2(-uFwd.y, uFwd.x);
  float cx = dot(d.xy, right), cy = -d.z / 16.0, cz = dot(d.xy, uFwd);
  gl_Position = vec4(cx / uTan.x, cy / uTan.y + uHoriz * cz, cz * (FAR + NEAR) / (FAR - NEAR) - 2.0 * FAR * NEAR / (FAR - NEAR), cz);
  vDepth = cz; vCol = int(aCol);
  // Build's voxels are lit by side: tops brightest, the sides a little darker
  vSideShade = aSide == 4.0 ? 0.0 : aSide == 5.0 ? 6.0 : aSide < 2.0 ? 2.0 : 4.0;
}`
const VOXEL_FRAGMENT = `#version 300 es
precision highp float; precision highp int; precision highp usampler2D;
in float vDepth; flat in int vCol; flat in float vSideShade;
uniform usampler2D uShades; uniform sampler2D uPalettes; uniform int uPalette; uniform int uShadeRows[16];
uniform float uShade; uniform int uPal; uniform float uVis; uniform float uVisScale; uniform vec4 uTint;
out vec4 color;
void main () {
  int shade = clamp(int(uShade + vSideShade + vDepth * uVis * uVisScale), 0, 63);
  uint c = texelFetch(uShades, ivec2(vCol, uShadeRows[uPal & 15] * 64 + shade), 0).r;
  vec4 rgb = texelFetch(uPalettes, ivec2(int(c), uPalette), 0);
  color = vec4(mix(rgb.rgb, uTint.rgb, uTint.a), 1.0);
}`

export default class BuildView extends WebGLScene {
  /**
   * @param {object} options All WebGLScene options, and:
   * @param {object} options.tiles The tiles' index (data/tiles.json)
   * @param {object} options.palettes data/palettes.json
   * @param {function} options.image `image(name)`: a loaded Image of a file in data/ (the engine's getAsset)
   */
  constructor (options = {}) {
    // A stencil buffer, to draw through the floors and ceilings that link sectors
    // Opaque (nothing shows through the view, so the browser need not blend it), and drawn straight to the screen
    // without waiting on the page's compositing where the browser can (desynchronized)
    super(Object.assign({ contextAttributes: { antialias: false, alpha: false, stencil: true, depth: true, desynchronized: true, powerPreference: 'high-performance' } }, options))
    this.portals = []
    this.spriteCount = 0
    this.voxelSprites = []
    this.tilesIndex = options.tiles
    this.tiles = options.tiles.tiles
    this.palettesIndex = options.palettes
    this.image = options.image
    this.map = null
    this.eye = { x: 0, y: 0, z: 0, ang: 0, horiz: 100 }
    this.sprites = []
    this.clock = 0
    /** Which palette (BLOOD, WATER, BEAST, SEWER, INVULN1) and a tint over everything (r, g, b, amount 0-1). */
    this.palette = 0
    this.tint = [0, 0, 0, 0]
    /** How fast things darken with distance, against the map's visibility (tuned against the original). */
    this.visScale = 1 / 409600
    /** How much taller than wide the original's pixels were shown (320 by 200 on a 4:3 screen): 1.2; 1 to compare pixel for pixel with its screenshots. */
    this.stretch = 1.2
    /** The vertical scale against z / 16: Build shows its 320 by 200 pixels as 90 degrees both across and up, so heights
     * look 0.625 of their size in x and y units (fitted to the original's screenshots: 0.6 best of 0.5 to 1). */
    this.zscale = 0.625
    this.skyV = 200
    this.dirty = new Set()
    if (this.gl) this.setup(this.gl)
  }

  setup (gl) {
    // Two programs from one shader: the solid surfaces' without a discard (so the GPU drops hidden pixels before
    // shading them: a discard anywhere in a shader stops that), and the rest's (masked, cut at a portal's plane)
    this.program = WebGLScene.program(gl, VERTEX, FRAGMENT)
    this.uniforms = {}
    for (const n of UNIFORMS) this.uniforms[n] = gl.getUniformLocation(this.program, n)
    this.opaqueProgram = WebGLScene.program(gl, VERTEX, FRAGMENT.replace('#version 300 es', '#version 300 es\n#define OPAQUE 1'))
    this.opaqueUniforms = {}
    for (const n of UNIFORMS) this.opaqueUniforms[n] = gl.getUniformLocation(this.opaqueProgram, n)
    this.skyProgram = WebGLScene.program(gl, VERTEX, FRAGMENT.replace('#version 300 es', '#version 300 es\n#define SKY 1'))
    this.skyUniforms = {}
    for (const n of UNIFORMS) this.skyUniforms[n] = gl.getUniformLocation(this.skyProgram, n)
    this.hudProgram = WebGLScene.program(gl, HUD_VERTEX, FRAGMENT.replace('#version 300 es', '#version 300 es\n#define HUD 1'))
    this.hudUniforms = {}
    for (const n of UNIFORMS.concat(['uScreen'])) this.hudUniforms[n] = gl.getUniformLocation(this.hudProgram, n)
    this.rectProgram = WebGLScene.program(gl, RECT_VERTEX, RECT_FRAGMENT)
    this.rectUniforms = { uScreen: gl.getUniformLocation(this.rectProgram, 'uScreen'), uColor: gl.getUniformLocation(this.rectProgram, 'uColor') }
    this.rectVAO = gl.createVertexArray()
    gl.bindVertexArray(this.rectVAO)
    this.rectBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectBuffer)
    const rectAt = gl.getAttribLocation(this.rectProgram, 'aPos')
    gl.enableVertexAttribArray(rectAt)
    gl.vertexAttribPointer(rectAt, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)
    gl.useProgram(this.program)
    this.attributes = ATTRIBUTES.map(([name, size]) => ({ name, size, location: gl.getAttribLocation(this.program, name) }))
    this.mapVAO = this.vao(gl, (this.mapBuffer = gl.createBuffer()))
    // The triangles to draw this frame, by their vertices' numbers: the solid ones, then the masked ones
    this.indexBuffer = gl.createBuffer()
    gl.bindVertexArray(this.mapVAO)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
    gl.bindVertexArray(null)
    this.indices = new Uint32Array(0)
    this.spriteVAO = this.vao(gl, (this.spriteBuffer = gl.createBuffer()))
    this.hudVAO = this.vao(gl, (this.hudBuffer = gl.createBuffer()))
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    this.loadTextures(gl)
    this.voxelProgram = WebGLScene.program(gl, VOXEL_VERTEX, VOXEL_FRAGMENT)
    this.voxelUniforms = {}
    for (const n of ['uEye', 'uFwd', 'uTan', 'uHoriz', 'uOrigin', 'uDir', 'uScale', 'uPivot', 'uOffset', 'uShades', 'uPalettes', 'uPalette', 'uShadeRows', 'uShade', 'uPal', 'uVis', 'uVisScale', 'uTint']) this.voxelUniforms[n] = gl.getUniformLocation(this.voxelProgram, n)
    gl.useProgram(this.voxelProgram)
    gl.uniform1i(this.voxelUniforms.uShades, 2)
    gl.uniform1i(this.voxelUniforms.uPalettes, 3)
    const rows = new Int32Array(16)
    for (const [id, row] of Object.entries(this.palettesIndex.shadeRows)) rows[Number(id)] = row
    gl.uniform1iv(this.voxelUniforms.uShadeRows, rows)
    this.voxelMeshes = new Map()
  }

  /** The voxel models (data/voxels.json), given once loaded; their meshes are made when first drawn */
  setVoxels (models) { this.voxelModels = models }

  voxelMesh (gl, id) {
    if (this.voxelMeshes.has(id)) return this.voxelMeshes.get(id)
    const m = this.voxelModels && this.voxelModels[id]
    if (!m) { this.voxelMeshes.set(id, null); return null }
    // Each face a square of the voxel's side, as two triangles: corners by side
    const f = m.faces, out = new Float32Array(f.length / 5 * 6 * 5)
    const CORNERS = [
      [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]], [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]],
      [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]], [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]],
      [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]]]
    let o = 0
    for (let i = 0; i < f.length; i += 5) {
      const [x, y, z, side, c] = [f[i], f[i + 1], f[i + 2], f[i + 3], f[i + 4]]
      const q = CORNERS[side]
      for (const k of [0, 1, 2, 0, 2, 3]) { out[o++] = x + q[k][0]; out[o++] = y + q[k][1]; out[o++] = z + q[k][2]; out[o++] = c; out[o++] = side }
    }
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, out, gl.STATIC_DRAW)
    const at = (name, size, offset) => { const l = gl.getAttribLocation(this.voxelProgram, name); if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 20, offset) }
    at('aV', 3, 0); at('aCol', 1, 12); at('aSide', 1, 16)
    gl.bindVertexArray(null)
    const mesh = { vao, count: out.length / 5, m }
    this.voxelMeshes.set(id, mesh)
    return mesh
  }

  /** The sprites shown as voxel models (their tile's view kind 6 or 7, with a model), drawn into the depth buffer */
  drawVoxels (gl, offset) {
    if (!this.voxelModels || !this.voxelSprites.length) return
    const u = this.voxelUniforms, eye = this.eye
    const a = eye.ang / ANGLES * TAU, aspect = this.canvas.width / this.canvas.height
    gl.useProgram(this.voxelProgram)
    gl.uniform3f(u.uEye, eye.x, eye.y, eye.z)
    gl.uniform2f(u.uFwd, Math.cos(a), Math.sin(a))
    gl.uniform2f(u.uTan, 0.625 * aspect * this.stretch, 0.625 / this.zscale)
    gl.uniform1f(u.uHoriz, (100 - eye.horiz) / 100)
    gl.uniform3f(u.uOffset, offset[0], offset[1], offset[2])
    gl.uniform1i(u.uPalette, this.palette)
    gl.uniform1f(u.uVisScale, this.visScale)
    gl.uniform4f(u.uTint, this.tint[0], this.tint[1], this.tint[2], this.tint[3])
    gl.disable(gl.BLEND)
    for (const s of this.voxelSprites) {
      const t = this.tiles[s.picnum]
      const mesh = this.voxelMesh(gl, t.voxel)
      if (!mesh) continue
      const m = mesh.m
      // Spinning pickups (view 7) turn with the clock; the rest face their sprite's angle
      const ang = (t.view === 7 ? this.clock * 4 : s.ang) / ANGLES * TAU
      // A voxel as large as a pixel of its sprite's tile would be: xrepeat / 4 across, yrepeat * 4 down
      const sx = s.xrepeat / 4, sz = s.yrepeat * 4
      const bottom = s.cstat & 128 ? s.z + (m.zsiz * sz) / 2 : s.z
      gl.uniform3f(u.uOrigin, s.x, s.y, bottom - m.zsiz * sz + m.zpivot * sz)
      gl.uniform2f(u.uDir, Math.cos(ang), Math.sin(ang))
      gl.uniform3f(u.uScale, sx, sx, sz)
      gl.uniform3f(u.uPivot, m.xpivot, m.ypivot, m.zpivot)
      gl.uniform1f(u.uShade, s.shade)
      gl.uniform1i(u.uPal, s.pal)
      gl.uniform1f(u.uVis, this.map.visibility)
      gl.bindVertexArray(mesh.vao)
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count)
    }
    gl.useProgram(this.program)
  }

  vao (gl, buffer) {
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    let offset = 0
    for (const a of this.attributes) {
      if (a.location >= 0) {
        gl.enableVertexAttribArray(a.location)
        gl.vertexAttribPointer(a.location, a.size, gl.FLOAT, false, FLOATS * 4, offset * 4)
      }
      offset += a.size
    }
    gl.bindVertexArray(null)
    return vao
  }

  texture (gl, unit, target) {
    const t = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(target, t)
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }

  loadTextures (gl) {
    const index = this.tilesIndex
    // Unit 0: the atlas pages, palette numbers (the grey PNGs' values), one layer a page
    this.texture(gl, 0, gl.TEXTURE_2D_ARRAY)
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R8UI, index.page, index.page, index.pages.length, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, null)
    index.pages.forEach((p, k) => gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, k, p.width, p.height, 1, gl.RED_INTEGER, gl.UNSIGNED_BYTE, this.image('tiles-' + k + '-index')))
    // Unit 1: each tile's place (x, y, width, height) and animation (page, frames, kind, speed)
    this.texture(gl, 1, gl.TEXTURE_2D)
    const info = new Int32Array(4096 * 4 * 4)
    for (const [n, t] of Object.entries(this.tiles)) {
      const i = Number(n), row = (i >> 12) * 2, col = i & 4095
      if (t.page !== undefined) info.set([t.x, t.y, t.w, t.h], (row * 4096 + col) * 4)
      info.set([t.page || 0, t.frames, t.anim, t.speed], ((row + 1) * 4096 + col) * 4)
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32I, 4096, 4, 0, gl.RGBA_INTEGER, gl.INT, info)
    // Unit 2: the shade tables, 64 rows each; unit 3: the palettes, a row each
    this.texture(gl, 2, gl.TEXTURE_2D)
    const shades = this.image('shades')
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, shades.width, shades.height, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, shades)
    this.texture(gl, 3, gl.TEXTURE_2D)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, this.palettesIndex.palettes.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.image('palettes'))
    const rows = new Int32Array(16)
    for (const [id, row] of Object.entries(this.palettesIndex.shadeRows)) rows[Number(id)] = row
    this.both(gl, (u) => {
      gl.uniform1i(u.uTiles, 0)
      gl.uniform1i(u.uInfo, 1)
      gl.uniform1i(u.uColors, 4)
      gl.uniform1iv(u.uShadeRows, rows)
    })
    this.colorsTexture = this.texture(gl, 4, gl.TEXTURE_2D)
    this.colors(gl)
  }

  /**
   * Unit 4: each shade table's row (its pal's 64 shades) turned to colours through the palette in use, so a pixel
   * takes its colour in one lookup instead of two; made again when the palette changes (under water)
   */
  colors (gl) {
    if (this.colorsFor === this.palette) return
    this.colorsFor = this.palette
    if (!this.shadePixels) {
      const read = (img) => {
        const c = document.createElement('canvas')
        c.width = img.width; c.height = img.height
        const x = c.getContext('2d')
        x.drawImage(img, 0, 0)
        return x.getImageData(0, 0, img.width, img.height).data
      }
      const shades = this.image('shades')
      this.shadePixels = { data: read(shades), width: shades.width, height: shades.height }
      this.palettePixels = read(this.image('palettes'))
    }
    const { data, width, height } = this.shadePixels, pal = this.palettePixels, row = this.palette * 256
    const out = new Uint8Array(width * height * 4)
    for (let k = 0, o = 0; k < width * height; k++, o += 4) {
      const c = (row + data[k * 4]) * 4
      out[o] = pal[c]; out[o + 1] = pal[c + 1]; out[o + 2] = pal[c + 2]; out[o + 3] = 255
    }
    gl.activeTexture(gl.TEXTURE4)
    gl.bindTexture(gl.TEXTURE_2D, this.colorsTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, out)
  }

  /** The same uniforms set in the programs that share the fragment shader (`set(uniforms)`); the masked one left in use */
  both (gl, set) {
    gl.useProgram(this.skyProgram)
    set(this.skyUniforms)
    gl.useProgram(this.hudProgram)
    set(this.hudUniforms)
    gl.useProgram(this.opaqueProgram)
    set(this.opaqueUniforms)
    gl.useProgram(this.program)
    set(this.uniforms)
  }

  /** Show a map (as formats/map.mjs reads it; the view keeps it, and redraws a sector when told it changed). */
  setMap (map) {
    this.map = map
    this.links = mapLinks(map)
    this.geometry = mapGeometry(map, this.tiles, this.links)
    // Each linked floor and ceiling: the range of its triangles (a sector's floor first, then its ceiling) and where it leads
    this.portals = []
    for (const [kind, list] of [['floor', this.links.floors], ['ceiling', this.links.ceilings]]) {
      for (const [s, link] of list) {
        const r = this.geometry.ranges[s], n = this.geometry.polygons[s].triangles.length
        const pts = this.geometry.polygons[s].points
        let cx = 0, cy = 0
        for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cy += pts[i + 1] }
        this.portals.push(Object.assign({ from: s, first: r.first + (kind === 'floor' ? 0 : n), count: n, cx: cx / (pts.length / 2), cy: cy / (pts.length / 2) }, link))
      }
    }
    const gl = this.gl
    if (!gl) return
    gl.bindBuffer(gl.ARRAY_BUFFER, this.mapBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.geometry.data, gl.DYNAMIC_DRAW)
    const offsets = new Int32Array(16)
    map.skyOffsets.forEach((o, i) => { if (i < 16) offsets[i] = o })
    this.both(gl, (u) => {
      gl.uniform1iv(u.uSkyOffsets, offsets)
      gl.uniform1i(u.uSkyBits, Math.min(4, map.pskybits))
    })
    this.classify()
  }

  /**
   * Each sector's triangles sorted by how they are drawn: solid (no discard needed), masked (see-through pixels),
   * or a portal (drawn only into the stencil); as vertex numbers, for the frame's index list
   */
  classify (only = null) {
    const g = this.geometry
    if (!this.solid || only === null) { this.solid = []; this.masked = []; this.skies = [] }
    const sectors = only !== null ? [only] : g.ranges.map((_, s) => s)
    for (const s of sectors) {
      const r = g.ranges[s], solid = [], masked = [], sky = []
      for (let v = r.first; v < r.first + r.count; v += 3) {
        const flags = g.data[v * FLOATS + 8]
        if (flags & PORTAL) continue
        const list = flags & SKY ? sky : flags & (MASKED | TRANSLUCENT | TRANSLUCENT_MORE) ? masked : solid
        list.push(v, v + 1, v + 2)
      }
      this.solid[s] = Uint32Array.from(solid)
      this.masked[s] = Uint32Array.from(masked)
      this.skies[s] = Uint32Array.from(sky)
    }
  }

  /** A sector's heights, pictures, shades or panning changed (or its walls'): it is redrawn from the map. */
  changed (sectnum) {
    this.dirty.add(sectnum)
    // The walls of the sectors around it show its heights in their upper and lower parts
    const s = this.map.sectors[sectnum]
    for (let i = s.wallptr; i < s.wallptr + s.wallnum; i++) if (this.map.walls[i].nextsector >= 0) this.dirty.add(this.map.walls[i].nextsector)
  }

  flush (gl) {
    if (!this.dirty.size) return
    gl.bindBuffer(gl.ARRAY_BUFFER, this.mapBuffer)
    for (const s of this.dirty) {
      const r = this.geometry.update(s)
      this.classify(s)
      gl.bufferSubData(gl.ARRAY_BUFFER, r.first * FLOATS * 4, this.geometry.data, r.first * FLOATS, r.count * FLOATS)
    }
    this.dirty.clear()
  }

  /** The vertices of the sprites, facing the eye as Build draws them (face, wall and floor sprites). */
  spriteVertices (passes = null) {
    const out = this.buildSprites(passes)
    this.spriteCount = out.length / FLOATS
    return out
  }

  buildSprites (passes = null) {
    const out = []
    const seen = (sec) => !passes || passes.some((p) => p.seen.seen[sec])
    this.voxelSprites = []
    const eye = this.eye
    const a = eye.ang / ANGLES * TAU
    const fwd = [Math.cos(a), Math.sin(a)], right = [-fwd[1], fwd[0]]
    for (const s of this.sprites) {
      if (s.cstat & 32768) continue
      if (s.sectnum >= 0 && !seen(s.sectnum)) continue
      let pic = s.picnum
      const t0 = this.tiles[pic]
      if (!t0) continue
      // Drawn as a voxel model instead, when there is one
      if (this.voxelModels && (t0.view === 6 || t0.view === 7) && t0.voxel >= 0 && this.voxelModels[t0.voxel]) { this.voxelSprites.push(s); continue }
      let xflip = !!(s.cstat & 4)
      // Blood's views: 5 (mirrored for the other three) or 8 tiles by the angle from the sprite to the eye
      const kind = (s.cstat >> 4) & 3
      if (kind === 0 && (t0.view === 1 || t0.view === 2 || t0.view === 6 || t0.view === 7)) {
        const toEye = Math.atan2(eye.y - s.y, eye.x - s.x) / TAU * ANGLES
        const octant = ((Math.round(toEye - s.ang + 128) % ANGLES + ANGLES) % ANGLES) >> 8
        if (t0.view === 1) { if (octant <= 4) pic += octant; else { pic += 8 - octant; xflip = !xflip } } else if (t0.view === 2) pic += octant
      }
      const t = this.tiles[pic]
      if (!t || !t.w) continue
      const w = t.w * s.xrepeat / 4, h = t.h * s.yrepeat * 4
      const xo = (t.xo + s.xoffset) * s.xrepeat / 4 * (xflip ? -1 : 1)
      let bottom = s.z - t.yo * s.yrepeat * 4
      if (s.cstat & 128) bottom += h / 2
      let flags = MASKED
      if (s.cstat & 2) flags |= s.cstat & 512 ? TRANSLUCENT_MORE : TRANSLUCENT
      if (s.cstat & 64) flags |= ONE_SIDED
      const shade = s.shade, pal = s.pal, vis = this.map.visibility
      const [u0, u1] = xflip ? [t.w - 0.001, 0] : [0, t.w - 0.001]
      const [v0, v1] = s.cstat & 8 ? [t.h - 0.001, 0] : [0, t.h - 0.001]
      let corners
      if (kind === 0 || kind === 3) {
        const cx = s.x + right[0] * xo, cy = s.y + right[1] * xo
        const l = [cx - right[0] * w / 2, cy - right[1] * w / 2], r = [cx + right[0] * w / 2, cy + right[1] * w / 2]
        corners = [[l[0], l[1], bottom - h, u0, v0], [r[0], r[1], bottom - h, u1, v0], [r[0], r[1], bottom, u1, v1], [l[0], l[1], bottom, u0, v1]]
      } else if (kind === 1) {
        const sa = s.ang / ANGLES * TAU
        const along = [Math.sin(sa), -Math.cos(sa)]
        const cx = s.x + along[0] * xo, cy = s.y + along[1] * xo
        const l = [cx - along[0] * w / 2, cy - along[1] * w / 2], r = [cx + along[0] * w / 2, cy + along[1] * w / 2]
        corners = [[l[0], l[1], bottom - h, u0, v0], [r[0], r[1], bottom - h, u1, v0], [r[0], r[1], bottom, u1, v1], [l[0], l[1], bottom, u0, v1]]
      } else {
        const sa = s.ang / ANGLES * TAU
        const ax = [Math.cos(sa), Math.sin(sa)], ay = [-Math.sin(sa), Math.cos(sa)]
        const hw = w / 2, hh = t.h * s.yrepeat / 8
        const p = (dx, dy) => [s.x + ax[0] * dx + ay[0] * dy, s.y + ax[1] * dx + ay[1] * dy]
        const c = [p(-hw, -hh), p(hw, -hh), p(hw, hh), p(-hw, hh)]
        corners = [[...c[0], s.z, u0, v0], [...c[1], s.z, u1, v0], [...c[2], s.z, u1, v1], [...c[3], s.z, u0, v1]]
      }
      for (const k of [0, 1, 2, 0, 2, 3]) { const c = corners[k]; out.push(c[0], c[1], c[2], c[3], c[4], pic, shade, pal, flags, vis) }
    }
    return new Float32Array(out)
  }

  render (gl) {
    gl.clearColor(0, 0, 0, 1)
    gl.clearStencil(0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT)
    if (!this.map) return
    this.flush(gl)
    this.colors(gl)
    const eye = this.eye
    const a = eye.ang / ANGLES * TAU
    // Build's view: 90 degrees across 320 by 200 pixels (160 pixels to a unit both ways), shown on a 4:3 screen, so
    // its pixels 1.2 times taller than wide; wider screens see more to the sides
    const aspect = this.canvas.width / this.canvas.height
    const tanX = 0.625 * aspect * this.stretch
    this.both(gl, (u) => {
      gl.uniform3f(u.uEye, eye.x, eye.y, eye.z)
      gl.uniform2f(u.uFwd, Math.cos(a), Math.sin(a))
      gl.uniform2f(u.uTan, tanX, 0.625 / this.zscale)
      // Build's horiz: the horizon's row, 100 the middle of 200; more looks up
      gl.uniform1f(u.uHoriz, (100 - eye.horiz) / 100)
      gl.uniform1f(u.uClock, this.clock)
      gl.uniform1f(u.uVisScale, this.visScale)
      gl.uniform1f(u.uSkyV, this.skyV)
      gl.uniform4f(u.uTint, this.tint[0], this.tint[1], this.tint[2], this.tint[3])
    })
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.disable(gl.CULL_FACE)
    gl.disable(gl.BLEND)
    gl.depthMask(true)
    // What the eye sees: from its sector out, near first; and through each linked floor or ceiling it faces, what
    // is beyond, from the linked sector (the eye moved by the link)
    this.eyeSector = findSector(this.map, Math.round(eye.x), Math.round(eye.y), eye.sectnum ?? this.eyeSector ?? -1)
    this.seen = visibleSectors(this.map, eye, this.eyeSector, tanX * 1.05, this.seen)
    // (`everything`: every sector drawn, to check what the sector walk leaves out)
    if (this.everything) { for (let s = 0; s < this.map.sectors.length; s++) { this.seen.list[s] = s; this.seen.seen[s] = 1 } this.seen.count = this.map.sectors.length }
    const passes = [{ offset: [0, 0, 0], portal: null, seen: this.seen }]
    this.portalSeen = this.portalSeen || []
    const tanY = 0.625 / this.zscale, horiz = (100 - eye.horiz) / 100
    this.portals.forEach((portal, k) => {
      if (!this.portalFacing(portal) || !this.seen.seen[portal.from]) return
      const box = this.portalBox(portal, eye, a, tanX, tanY, horiz)
      if (!box) return
      const moved = { x: eye.x - portal.offset[0], y: eye.y - portal.offset[1], ang: eye.ang }
      this.portalSeen[k] = visibleSectors(this.map, moved, portal.sector, tanX * 1.05, this.portalSeen[k], box.lo * 1.05, box.hi * 1.05)
      passes.push({ offset: portal.offset, portal, seen: this.portalSeen[k], box })
    })
    // One index list for the frame: each pass's solid triangles, then its masked ones
    let total = 0
    for (const p of passes) for (let i = 0; i < p.seen.count; i++) { const sec = p.seen.list[i]; total += this.solid[sec].length + this.masked[sec].length + this.skies[sec].length }
    if (this.indices.length < total) this.indices = new Uint32Array(total * 2)
    let at = 0
    for (const p of passes) {
      p.solidFirst = at
      for (let i = 0; i < p.seen.count; i++) { const t = this.solid[p.seen.list[i]]; this.indices.set(t, at); at += t.length }
      p.skyFirst = at
      for (let i = 0; i < p.seen.count; i++) { const t = this.skies[p.seen.list[i]]; this.indices.set(t, at); at += t.length }
      p.maskedFirst = at
      for (let i = 0; i < p.seen.count; i++) { const t = this.masked[p.seen.list[i]]; this.indices.set(t, at); at += t.length }
      p.end = at
    }
    gl.bindVertexArray(this.mapVAO)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices.subarray(0, at), gl.STREAM_DRAW)
    // The sprites in the sectors seen (by any pass)
    const sprites = this.spriteVertices(passes)
    if (sprites.length) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, sprites, gl.STREAM_DRAW)
    }
    this.pass(gl, passes[0])
    // Through each link: its surface marked in the stencil, the depth there cleared, the world drawn again moved by
    // the link's offset and cut at its plane (Blood draws the linked sector beyond the surface)
    for (const p of passes.slice(1)) {
      const portal = p.portal
      // (only the part of the screen the portal covers is drawn into)
      gl.enable(gl.SCISSOR_TEST)
      gl.scissor(p.box.x, p.box.y, p.box.w, p.box.h)
      // (each portal its own stencil value: no clearing between them, which a tiled GPU pays for dearly)
      const mark = passes.indexOf(p)
      gl.useProgram(this.opaqueProgram)
      gl.enable(gl.STENCIL_TEST)
      gl.stencilFunc(gl.ALWAYS, mark, 0xff)
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE)
      gl.colorMask(false, false, false, false)
      gl.depthMask(false)
      gl.uniform3f(this.opaqueUniforms.uOffset, 0, 0, 0)
      gl.uniform3f(this.opaqueUniforms.uClip, 0, 0, 0)
      gl.bindVertexArray(this.mapVAO)
      gl.drawArrays(gl.TRIANGLES, portal.first, portal.count)
      // The depth where it shows cleared to the farthest, by drawing it again there at that depth
      gl.stencilFunc(gl.EQUAL, mark, 0xff)
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP)
      gl.depthMask(true)
      gl.depthFunc(gl.ALWAYS)
      gl.uniform1i(this.opaqueUniforms.uFar, 1)
      gl.drawArrays(gl.TRIANGLES, portal.first, portal.count)
      gl.uniform1i(this.opaqueUniforms.uFar, 0)
      gl.depthFunc(gl.LEQUAL)
      gl.colorMask(true, true, true, true)
      this.pass(gl, p)
      // A water surface over what is under it, half seen through
      if (portal.water) {
        gl.useProgram(this.program)
        gl.uniform3f(this.uniforms.uOffset, 0, 0, 0)
        gl.uniform3f(this.uniforms.uClip, 0, 0, 0)
        gl.enable(gl.BLEND)
        gl.blendColor(0, 0, 0, 0.5)
        gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA)
        gl.bindVertexArray(this.mapVAO)
        gl.drawArrays(gl.TRIANGLES, portal.first, portal.count)
        gl.disable(gl.BLEND)
      }
      gl.disable(gl.STENCIL_TEST)
      gl.disable(gl.SCISSOR_TEST)
    }
    this.drawHud(gl)
    gl.bindVertexArray(null)
    // The depth and stencil are not wanted after the frame: a tiled GPU need not write them out
    gl.invalidateFramebuffer(gl.FRAMEBUFFER, [gl.DEPTH, gl.STENCIL])
  }

  /**
   * The HUD over the view, as `this.hud` holds it for the frame: { vertices (FLOATS each, in the screen's pixels),
   * count, rects: [{ x, y, w, h, color: [r, g, b, a], over }] } (a rect `over` the tiles, else under them)
   */
  drawHud (gl) {
    const hud = this.hud
    if (!hud) return
    gl.disable(gl.DEPTH_TEST)
    gl.depthMask(false)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    const W = this.canvas.width, H = this.canvas.height
    const rects = (over) => {
      const list = hud.rects.filter((r) => !!r.over === over)
      if (!list.length) return
      gl.useProgram(this.rectProgram)
      gl.uniform2f(this.rectUniforms.uScreen, W, H)
      gl.bindVertexArray(this.rectVAO)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.rectBuffer)
      for (const r of list) {
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([r.x, r.y, r.x + r.w, r.y, r.x + r.w, r.y + r.h, r.x, r.y, r.x + r.w, r.y + r.h, r.x, r.y + r.h]), gl.STREAM_DRAW)
        gl.uniform4f(this.rectUniforms.uColor, r.color[0], r.color[1], r.color[2], r.color[3])
        gl.drawArrays(gl.TRIANGLES, 0, 6)
      }
    }
    rects(false)
    if (hud.count) {
      gl.useProgram(this.hudProgram)
      gl.uniform2f(this.hudUniforms.uScreen, W, H)
      gl.uniform1i(this.hudUniforms.uDebug, 0)
      gl.bindVertexArray(this.hudVAO)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.hudBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, hud.vertices.subarray(0, hud.count * FLOATS), gl.STREAM_DRAW)
      gl.drawArrays(gl.TRIANGLES, 0, hud.count)
    }
    rects(true)
    gl.disable(gl.BLEND)
    gl.enable(gl.DEPTH_TEST)
    gl.depthMask(true)
  }

  /**
   * A pass: its solid triangles near first through the program without a discard, then its masked ones, then the
   * sprites, all moved by its offset (and through a portal, clipped at its plane by the depth: see the vertex shader)
   */
  pass (gl, p) {
    const portal = p.portal, offset = p.offset
    const set = (u) => {
      gl.uniform3f(u.uOffset, offset[0], offset[1], offset[2])
      gl.uniform3f(u.uClip, portal ? portal.side : 0, portal ? portal.planeZ : 0, portal ? 1 : 0)
    }
    gl.disable(gl.BLEND)
    gl.bindVertexArray(this.mapVAO)
    gl.useProgram(this.opaqueProgram)
    set(this.opaqueUniforms)
    if (p.skyFirst > p.solidFirst) gl.drawElements(gl.TRIANGLES, p.skyFirst - p.solidFirst, gl.UNSIGNED_INT, p.solidFirst * 4)
    if (p.maskedFirst > p.skyFirst) {
      gl.useProgram(this.skyProgram)
      set(this.skyUniforms)
      gl.drawElements(gl.TRIANGLES, p.maskedFirst - p.skyFirst, gl.UNSIGNED_INT, p.skyFirst * 4)
    }
    gl.useProgram(this.program)
    set(this.uniforms)
    if (p.end > p.maskedFirst) gl.drawElements(gl.TRIANGLES, p.end - p.maskedFirst, gl.UNSIGNED_INT, p.maskedFirst * 4)
    if (this.voxelSprites && this.voxelSprites.length && !portal) this.drawVoxels(gl, offset)
    if (this.spriteCount) {
      gl.useProgram(this.program)
      gl.bindVertexArray(this.spriteVAO)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      gl.enable(gl.POLYGON_OFFSET_FILL)
      gl.polygonOffset(-1, -4)
      gl.drawArrays(gl.TRIANGLES, 0, this.spriteCount)
      gl.disable(gl.POLYGON_OFFSET_FILL)
      gl.disable(gl.BLEND)
    }
  }

  /**
   * Where a portal's surface is on the screen: its box in pixels (x, y from the bottom, w, h) and its extent across
   * as the walk's window (lo, hi: x / depth); the whole screen when part of it is behind the eye; null off screen
   */
  portalBox (portal, eye, a, tanX, tanY, horiz) {
    const W = this.canvas.width, H = this.canvas.height, NEAR = 8
    const fx = Math.cos(a), fy = Math.sin(a)
    const { points, triangles } = this.geometry.polygons[portal.from]
    const cy = -(portal.planeZ - eye.z) / 16
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    const add = (cx, cz) => {
      const sx = cx / cz / tanX, sy = cy / cz / tanY + horiz
      if (sx < x0) x0 = sx
      if (sx > x1) x1 = sx
      if (sy < y0) y0 = sy
      if (sy > y1) y1 = sy
    }
    // Each triangle of the surface cut at the near plane, and what is left of it put on the screen
    for (let k = 0; k < triangles.length; k += 3) {
      const c = [0, 1, 2].map((j) => {
        const i = triangles[k + j], dx = points[i * 2] - eye.x, dy = points[i * 2 + 1] - eye.y
        return [dx * -fy + dy * fx, dx * fx + dy * fy]
      })
      for (let j = 0; j < 3; j++) {
        const p = c[j], q = c[(j + 1) % 3]
        if (p[1] >= NEAR) add(p[0], p[1])
        if ((p[1] >= NEAR) !== (q[1] >= NEAR)) {
          const t = (NEAR - p[1]) / (q[1] - p[1])
          add(p[0] + (q[0] - p[0]) * t, NEAR)
        }
      }
    }
    if (x0 > x1 || x1 < -1 || x0 > 1 || y1 < -1 || y0 > 1) return null
    const px = (v) => Math.max(0, Math.min(W, Math.floor((v + 1) / 2 * W))), py = (v) => Math.max(0, Math.min(H, Math.floor((v + 1) / 2 * H)))
    const bx = Math.max(0, px(x0) - 1), by = Math.max(0, py(y0) - 1)
    return { x: bx, y: by, w: Math.min(W, px(x1) + 2) - bx, h: Math.min(H, py(y1) + 2) - by, lo: Math.max(-tanX, x0 * tanX), hi: Math.min(tanX, x1 * tanX) }
  }

  /** Whether the eye can see a portal's surface: above a floor portal, below a ceiling one, near enough */
  portalFacing (p) {
    const e = this.eye
    if (p.side > 0 && e.z > p.planeZ) return false
    if (p.side < 0 && e.z < p.planeZ) return false
    return Math.hypot(p.cx - e.x, p.cy - e.y) < 65536
  }



}
