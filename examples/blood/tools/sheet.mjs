// A contact sheet of tiles (true colour, each in a cell with its number), for finding tiles by eye.
//   node tools/sheet.mjs <first> <last> <out.png> [cell]
import fs from 'fs'
import path from 'path'
import Art from '../formats/art.mjs'
import RFF from '../formats/rff.mjs'
import { png } from './png.mjs'
const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const [first, last, out, cellArg] = process.argv.slice(2)
const cell = Number(cellArg || 96)
const art = new Art(fs.readFileSync(path.join(ROOT, 'original/SHARE000.ART')))
const pal = RFF.load(path.join(ROOT, 'original/BLOOD.RFF')).read('BLOOD.PAL')
const n = Number(last) - Number(first) + 1, cols = 10, rows = Math.ceil(n / cols)
const W = cols * cell, H = rows * (cell + 10)
const px = new Uint8Array(W * H * 4).fill(40)
for (let i = 3; i < px.length; i += 4) px[i] = 255
// digits for the labels: a 3x5 font
const FONT = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111']
const text = (x, y, s) => { for (const [k, ch] of [...s].entries()) { const g = FONT[ch.charCodeAt(0) - 48]; if (!g) continue; for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r * 3 + c] === '1') { const o = ((y + r) * W + x + k * 4 + c) * 4; px.set([255, 255, 0, 255], o) } } }
for (let i = 0; i < n; i++) {
  const t = art.tiles[Number(first) + i]
  const cx = (i % cols) * cell, cy = Math.floor(i / cols) * (cell + 10)
  text(cx + 2, cy + 2, String(t.number))
  if (!t.pixels) continue
  const rows2 = art.rows(t)
  const scale = Math.min(1, (cell - 4) / Math.max(t.width, t.height))
  for (let y = 0; y < Math.floor(t.height * scale); y++) {
    for (let x = 0; x < Math.floor(t.width * scale); x++) {
      const c = rows2[Math.floor(y / scale) * t.width + Math.floor(x / scale)]
      if (c === 255) continue
      const o = ((cy + 10 + y) * W + cx + 2 + x) * 4
      px.set([pal[c * 3], pal[c * 3 + 1], pal[c * 3 + 2], 255], o)
    }
  }
}
fs.writeFileSync(out, png({ width: W, height: H, pixels: px, type: 'rgba' }))
