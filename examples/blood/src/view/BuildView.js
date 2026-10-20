// Blood's 3D view: the Build map drawn through WebGL, as a Tenkai WebGLScene. Everything is drawn in palette
// numbers, as the original drew it: the tiles are 8-bit palette indices in a texture array, each pixel is put
// through its pal's shade table (by its shade and its distance) and then through the palette. So a map's shading,
// its pals (the cultists' robes, the spiders' colours) and the screen tints work as the original's do.
//
// The view is given the map (Build's sectors, walls and sprites, as formats/map.mjs reads them) and the tiles'
// index (data/tiles.json), loads the atlas pages, palettes and shade tables from data/, and draws from an eye:
// { x, y, z, ang, horiz } in Build's units. Sprites are given each frame as a list in Build's sprite fields.
import { WebGLScene } from '../../../../index.js'
import { mapGeometry, FLOATS, MASKED, TRANSLUCENT, TRANSLUCENT_MORE, SKY, ONE_SIDED } from './geometry.js'
import { ANGLES, TAU } from '../../common/build.mjs'

const VERTEX = `#version 300 es
precision highp float;
precision highp int;
in vec3 aPos; in vec2 aUV; in float aPic; in float aShade; in float aPal; in float aFlags; in float aVis;
uniform vec3 uEye; uniform vec2 uFwd; uniform vec2 uTan; uniform float uHoriz; uniform float uClock;
uniform highp isampler2D uInfo;
out vec2 vUV; out float vShade; out float vDepth; out vec3 vDir;
flat out ivec4 vRect; flat out int vPage; flat out int vPal; flat out int vFlags; flat out int vPic; flat out float vVis;
const float NEAR = 4.0, FAR = 400000.0;
int animate (int pic) {
  ivec4 q = texelFetch(uInfo, ivec2(pic, 1), 0);
  int frames = q.y, kind = q.z;
  if (kind == 0 || frames == 0) return pic;
  int i = int(uClock) >> q.w;
  if (kind == 1) { int k = i % (frames * 2); return pic + (k < frames ? k : frames * 2 - k); }
  if (kind == 2) return pic + i % (frames + 1);
  return pic - i % (frames + 1);
}
void main () {
  vec3 d = aPos - uEye;
  vec2 right = vec2(-uFwd.y, uFwd.x);
  float cx = dot(d.xy, right), cy = -d.z / 16.0, cz = dot(d.xy, uFwd);
  gl_Position = vec4(cx / uTan.x, cy / uTan.y + uHoriz * cz, cz * (FAR + NEAR) / (FAR - NEAR) - 2.0 * FAR * NEAR / (FAR - NEAR), cz);
  vUV = aUV; vShade = aShade; vDepth = cz; vDir = vec3(d.xy, cy);
  vPal = int(aPal); vFlags = int(aFlags); vVis = aVis;
  vPic = (vFlags & ${SKY}) != 0 ? int(aPic) : animate(int(aPic));
  vRect = texelFetch(uInfo, ivec2(vPic, 0), 0);
  vPage = texelFetch(uInfo, ivec2(vPic, 1), 0).x;
}`

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2DArray; precision highp usampler2D; precision highp isampler2D;
in vec2 vUV; in float vShade; in float vDepth; in vec3 vDir;
flat in ivec4 vRect; flat in int vPage; flat in int vPal; flat in int vFlags; flat in int vPic; flat in float vVis;
uniform usampler2DArray uTiles; uniform usampler2D uShades; uniform sampler2D uPalettes; uniform isampler2D uInfo;
uniform int uPalette; uniform int uShadeRows[16]; uniform float uVisScale; uniform int uSkyOffsets[16]; uniform int uSkyBits;
uniform float uSkyV; uniform vec4 uTint; uniform int uDebug;
out vec4 color;
uint texel (ivec4 r, int page, float u, float v) {
  int x = int(mod(floor(u), float(r.z))), y = int(mod(floor(v), float(r.w)));
  return texelFetch(uTiles, ivec3(r.x + x, r.y + y, page), 0).r;
}
void main () {
  ivec4 r = vRect; int page = vPage;
  float u = vUV.x, v = vUV.y;
  int shade = int(vShade);
  if ((vFlags & ${SKY}) != 0) {
    // Parallax sky: 2^bits tiles around the circle, by the direction of the pixel; level with the eye, a row of the tile
    float ang = atan(vDir.y, vDir.x); if (ang < 0.0) ang += ${TAU};
    float slices = float(1 << uSkyBits);
    float around = ang / ${TAU} * slices;
    int slice = int(floor(around)) % (1 << uSkyBits);
    int pic = vPic + uSkyOffsets[slice];
    r = texelFetch(uInfo, ivec2(pic, 0), 0); page = texelFetch(uInfo, ivec2(pic, 1), 0).x;
    u = fract(around) * float(r.z);
    v = uSkyV - vDir.z / length(vDir.xy) * 160.0;
    v = clamp(v, 0.0, float(r.w) - 1.0);
  } else {
    shade += int(vDepth * vVis * uVisScale);
  }
  if (r.z == 0 || r.w == 0) discard;
  uint i = texel(r, page, u, v);
  if (i == 255u && (vFlags & ${MASKED}) != 0) discard;
  shade = clamp(shade, 0, 63);
  uint c = texelFetch(uShades, ivec2(int(i), uShadeRows[vPal & 15] * 64 + shade), 0).r;
  vec4 rgb = texelFetch(uPalettes, ivec2(int(c), uPalette), 0);
  float a = (vFlags & ${TRANSLUCENT_MORE}) != 0 ? 0.34 : (vFlags & ${TRANSLUCENT}) != 0 ? 0.66 : 1.0;
  color = vec4(mix(rgb.rgb, uTint.rgb, uTint.a), a);
  if (uDebug == 1) color = vec4(fract(u / float(r.z)), fract(v / float(r.w)), float(vFlags & 8) , 1.0);
  if (uDebug == 2) color = vec4(vec3(clamp(vDepth / 8192.0, 0.0, 1.0)), 1.0);
  if (uDebug == 3) color = vec4(float(i) / 255.0, float(vPic % 64) / 64.0, float(page) / 4.0, 1.0);
}`

const ATTRIBUTES = [['aPos', 3], ['aUV', 2], ['aPic', 1], ['aShade', 1], ['aPal', 1], ['aFlags', 1], ['aVis', 1]]

export default class BuildView extends WebGLScene {
  /**
   * @param {object} options All WebGLScene options, and:
   * @param {object} options.tiles The tiles' index (data/tiles.json)
   * @param {object} options.palettes data/palettes.json
   * @param {function} options.image `image(name)`: a loaded Image of a file in data/ (the engine's getAsset)
   */
  constructor (options = {}) {
    super(options)
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
    this.visScale = 1 / 65536
    this.skyV = 200
    this.dirty = new Set()
    if (this.gl) this.setup(this.gl)
  }

  setup (gl) {
    this.program = WebGLScene.program(gl, VERTEX, FRAGMENT)
    gl.useProgram(this.program)
    this.uniforms = {}
    for (const n of ['uEye', 'uFwd', 'uTan', 'uHoriz', 'uClock', 'uInfo', 'uTiles', 'uShades', 'uPalettes', 'uPalette', 'uVisScale', 'uSkyOffsets', 'uSkyBits', 'uSkyV', 'uTint', 'uShadeRows', 'uDebug']) this.uniforms[n] = gl.getUniformLocation(this.program, n)
    this.attributes = ATTRIBUTES.map(([name, size]) => ({ name, size, location: gl.getAttribLocation(this.program, name) }))
    this.mapVAO = this.vao(gl, (this.mapBuffer = gl.createBuffer()))
    this.spriteVAO = this.vao(gl, (this.spriteBuffer = gl.createBuffer()))
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    this.loadTextures(gl)
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
    const info = new Int32Array(4096 * 2 * 4)
    for (const [n, t] of Object.entries(this.tiles)) {
      const i = Number(n)
      if (t.page !== undefined) info.set([t.x, t.y, t.w, t.h], i * 4)
      info.set([t.page || 0, t.frames, t.anim, t.speed], (4096 + i) * 4)
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32I, 4096, 2, 0, gl.RGBA_INTEGER, gl.INT, info)
    // Unit 2: the shade tables, 64 rows each; unit 3: the palettes, a row each
    this.texture(gl, 2, gl.TEXTURE_2D)
    const shades = this.image('shades')
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, shades.width, shades.height, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, shades)
    this.texture(gl, 3, gl.TEXTURE_2D)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, this.palettesIndex.palettes.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.image('palettes'))
    gl.useProgram(this.program)
    gl.uniform1i(this.uniforms.uTiles, 0)
    gl.uniform1i(this.uniforms.uInfo, 1)
    gl.uniform1i(this.uniforms.uShades, 2)
    gl.uniform1i(this.uniforms.uPalettes, 3)
    const rows = new Int32Array(16)
    for (const [id, row] of Object.entries(this.palettesIndex.shadeRows)) rows[Number(id)] = row
    gl.uniform1iv(this.uniforms.uShadeRows, rows)
  }

  /** Show a map (as formats/map.mjs reads it; the view keeps it, and redraws a sector when told it changed). */
  setMap (map) {
    this.map = map
    this.geometry = mapGeometry(map, this.tiles)
    const gl = this.gl
    if (!gl) return
    gl.bindBuffer(gl.ARRAY_BUFFER, this.mapBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.geometry.data, gl.DYNAMIC_DRAW)
    gl.useProgram(this.program)
    const offsets = new Int32Array(16)
    map.skyOffsets.forEach((o, i) => { if (i < 16) offsets[i] = o })
    gl.uniform1iv(this.uniforms.uSkyOffsets, offsets)
    gl.uniform1i(this.uniforms.uSkyBits, Math.min(4, map.pskybits))
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
      gl.bufferSubData(gl.ARRAY_BUFFER, r.first * FLOATS * 4, this.geometry.data, r.first * FLOATS, r.count * FLOATS)
    }
    this.dirty.clear()
  }

  /** The vertices of the sprites, facing the eye as Build draws them (face, wall and floor sprites). */
  spriteVertices () {
    const out = []
    const eye = this.eye
    const a = eye.ang / ANGLES * TAU
    const fwd = [Math.cos(a), Math.sin(a)], right = [-fwd[1], fwd[0]]
    for (const s of this.sprites) {
      if (s.cstat & 32768) continue
      let pic = s.picnum
      const t0 = this.tiles[pic]
      if (!t0) continue
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
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    if (!this.map) return
    this.flush(gl)
    gl.useProgram(this.program)
    const eye = this.eye
    const a = eye.ang / ANGLES * TAU
    // Build's view: 90 degrees across a 4:3 screen of 320 by 200 pixels, its pixels 1.2 times taller than wide;
    // wider screens see more to the sides
    const aspect = this.canvas.width / this.canvas.height
    gl.uniform3f(this.uniforms.uEye, eye.x, eye.y, eye.z)
    gl.uniform2f(this.uniforms.uFwd, Math.cos(a), Math.sin(a))
    gl.uniform2f(this.uniforms.uTan, 0.75 * aspect, 0.625)
    gl.uniform1f(this.uniforms.uHoriz, (eye.horiz - 100) / 100)
    gl.uniform1f(this.uniforms.uClock, this.clock)
    gl.uniform1i(this.uniforms.uPalette, this.palette)
    gl.uniform1f(this.uniforms.uVisScale, this.visScale)
    gl.uniform1f(this.uniforms.uSkyV, this.skyV)
    gl.uniform1i(this.uniforms.uDebug, this.debug || 0)
    gl.uniform4f(this.uniforms.uTint, this.tint[0], this.tint[1], this.tint[2], this.tint[3])
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.disable(gl.CULL_FACE)
    gl.disable(gl.BLEND)
    gl.depthMask(true)
    gl.bindVertexArray(this.mapVAO)
    gl.drawArrays(gl.TRIANGLES, 0, this.geometry.data.length / FLOATS)
    const sprites = this.spriteVertices()
    if (sprites.length) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, sprites, gl.STREAM_DRAW)
      gl.bindVertexArray(this.spriteVAO)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      gl.enable(gl.POLYGON_OFFSET_FILL)
      gl.polygonOffset(-1, -4)
      gl.drawArrays(gl.TRIANGLES, 0, sprites.length / FLOATS)
      gl.disable(gl.POLYGON_OFFSET_FILL)
    }
    gl.bindVertexArray(null)
  }
}
