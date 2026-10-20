// Fits the view's free numbers (the vertical scale, the eye's height, the horizon) to a screenshot of the original:
// renders the fly-through page over a grid of them and scores each by the difference of grey levels, outside a mask
// (the weapon and the status bar), printing the best.
//   node fidelity/fit.mjs <original.png> <url params> [mask bottom rows]
import fs from 'fs'
import zlib from 'zlib'
import Page from '../tools/page.mjs'

export function readPNG (file) {
  const d = fs.readFileSync(file)
  let i = 8, w, h, ct, idat = []
  while (i < d.length) {
    const n = d.readUInt32BE(i), t = d.toString('latin1', i + 4, i + 8), c = d.subarray(i + 8, i + 8 + n)
    if (t === 'IHDR') { w = c.readUInt32BE(0); h = c.readUInt32BE(4); ct = c[9] }
    if (t === 'IDAT') idat.push(c)
    i += 12 + n
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = { 0: 1, 2: 3, 6: 4 }[ct], stride = w * bpp
  const out = Buffer.alloc(stride * h)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0
      let v = line[x]
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
      out[y * stride + x] = v & 255
    }
  }
  const grey = new Float32Array(w * h)
  for (let k = 0; k < w * h; k++) grey[k] = bpp === 1 ? out[k] : (out[k * bpp] + out[k * bpp + 1] + out[k * bpp + 2]) / 3
  return { width: w, height: h, grey, rgb: out, bpp }
}

// In the page: render the view with the settings and return its grey levels (rows top to bottom)
export const GRAB = `window.grab = (o) => {
  const v = fly.view; Object.assign(v, o.view || {}); Object.assign(v.eye, o.eye || {})
  const gl = v.gl; v.render(gl)
  const w = v.canvas.width, h = v.canvas.height, px = new Uint8Array(w * h * 4)
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px)
  const out = []
  for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4; out.push(Math.round((px[k] + px[k + 1] + px[k + 2]) / 3)) }
  return out
}`

export function score (a, b, width, height, mask) {
  // Edges matter more than levels: compare the gradients' magnitudes as well as the levels, outside the mask
  let s = 0, n = 0
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    if (mask(x, y)) continue
    const k = y * width + x
    const ga = Math.abs(a[k + 1] - a[k - 1]) + Math.abs(a[k + width] - a[k - width]), gb = Math.abs(b[k + 1] - b[k - 1]) + Math.abs(b[k + width] - b[k - width])
    s += Math.abs(a[k] - b[k]) + 0.5 * Math.abs(ga - gb); n++
  }
  return s / n
}

if (process.argv[1].endsWith('fit.mjs')) {
  const [file, params, bottom = '40'] = process.argv.slice(2)
  const orig = readPNG(file)
  const page = await Page.open('http://127.0.0.1:8471/fly.html?' + params + '&stretch=1', { width: orig.width, height: orig.height, ready: 'window.fly && fly.view && fly.view.map' })
  await page.eval(GRAB)
  const mask = (x, y) => y >= orig.height - Number(bottom) || (x > 110 && x < 210 && y > 120)
  const results = []
  const base = await page.eval('fly.view.eye.z')
  for (const zscale of [0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 1]) {
    for (const dz of [-4096, -2048, -1024, 0, 1024, 2048, 4096]) {
      for (const horiz of [90, 95, 100, 105, 110]) {
        const g = await page.eval(`grab(${JSON.stringify({ view: { zscale }, eye: { z: base + dz, horiz } })})`)
        results.push({ zscale, z: base + dz, horiz, score: score(orig.grey, g, orig.width, orig.height, mask) })
      }
    }
  }
  results.sort((a, b) => a.score - b.score)
  for (const r of results.slice(0, 8)) console.log(JSON.stringify(r))
  if (page.errors.length) console.log('page errors', page.errors)
  await page.close()
}
