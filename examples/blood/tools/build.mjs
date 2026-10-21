// Builds data/ for the client from original/: standard formats only (PNG, WAV, JSON).
//   node tools/build.mjs [tiles|palettes|maps|seqs|sounds|all]
import fs from 'fs'
import path from 'path'
import RFF from '../formats/rff.mjs'
import Art from '../formats/art.mjs'
import BloodMap from '../formats/map.mjs'
import seq from '../formats/seq.mjs'
import qav from '../formats/qav.mjs'
import kvx from '../formats/kvx.mjs'
import sfx, { rate, wav } from '../formats/sfx.mjs'
import { palette, shadeTable } from '../formats/tables.mjs'
import { png } from './png.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const ORIGINAL = path.join(ROOT, 'original'), DATA = path.join(ROOT, 'data')
const what = process.argv[2] || 'all'
const want = (k) => what === 'all' || what === k
fs.mkdirSync(DATA, { recursive: true })
const blood = RFF.load(path.join(ORIGINAL, 'BLOOD.RFF'))
const write = (name, data) => { fs.writeFileSync(path.join(DATA, name), data); console.log('  ' + name + ' ' + data.length + ' bytes') }
const PAGE = 2048, TRANSPARENT = 255

if (want('palettes')) {
  console.log('palettes')
  const names = blood.ofType('PAL').map((e) => e.name)
  const rgba = new Uint8Array(256 * names.length * 4)
  names.forEach((n, row) => { const p = palette(blood.read(n + '.PAL')); for (let i = 0; i < 256; i++) { rgba.set([p[i * 3], p[i * 3 + 1], p[i * 3 + 2], 255], (row * 256 + i) * 4) } })
  write('palettes.png', png({ width: 256, height: names.length, pixels: rgba, type: 'rgba' }))
  const plus = blood.ofType('PLU').map((e) => e.name)
  const shades = new Uint8Array(256 * 64 * plus.length)
  plus.forEach((n, k) => shades.set(shadeTable(blood.read(n + '.PLU')), k * 256 * 64))
  write('shades.png', png({ width: 256, height: 64 * plus.length, pixels: shades, type: 'grey' }))
  write('trans.png', png({ width: 256, height: 256, pixels: new Uint8Array(blood.read('TRANS.TLU')), type: 'grey' }))
  const clus = blood.ofType('CLU').map((e) => e.name)
  const clu = new Uint8Array(256 * clus.length); clus.forEach((n, k) => clu.set(blood.read(n + '.CLU'), k * 256))
  write('colours.png', png({ width: 256, height: clus.length, pixels: clu, type: 'grey' }))
  // A pal number is a PLU's id; the shade rows are in directory order, so the client is given the row of each id
  const shadeRows = {}; blood.ofType('PLU').forEach((e, k) => { shadeRows[e.id] = k })
  write('palettes.json', JSON.stringify({ palettes: names, shades: plus, shadeRows, colours: clus }, null, 1))
}

if (want('tiles')) {
  console.log('tiles')
  const art = new Art(fs.readFileSync(path.join(ORIGINAL, 'SHARE000.ART')))
  const pal = palette(blood.read('BLOOD.PAL'))
  const surface = fs.readFileSync(path.join(ORIGINAL, 'SURFACE.DAT')), voxel = fs.readFileSync(path.join(ORIGINAL, 'VOXEL.DAT'))
  // Shelf packing into pages PAGE wide, tallest first; a tile wider than a page is cut down (none is)
  const tiles = art.tiles.filter((t) => t.pixels).sort((a, b) => b.height - a.height || b.width - a.width)
  const pages = []
  let page = null
  const open = () => { page = { shelves: [], height: 0, index: pages.length }; pages.push(page); return page }
  for (const t of tiles) {
    if (!page) open()
    let placed = false
    for (let tries = 0; tries < 2 && !placed; tries++) {
      let shelf = page.shelves[page.shelves.length - 1]
      if (!shelf || shelf.x + t.width > PAGE) {
        if (page.height + t.height > PAGE) { open(); continue }
        shelf = { y: page.height, x: 0, height: t.height }; page.shelves.push(shelf); page.height += t.height
      }
      t.page = page.index; t.x = shelf.x; t.y = shelf.y; shelf.x += t.width; placed = true
    }
    if (!placed) throw new Error('tile ' + t.number + ' does not fit')
  }
  const index = {}
  for (const p of pages) {
    const grey = new Uint8Array(PAGE * p.height).fill(TRANSPARENT), rgba = new Uint8Array(PAGE * p.height * 4)
    for (const t of tiles) {
      if (t.page !== p.index) continue
      const rows = art.rows(t)
      for (let y = 0; y < t.height; y++) grey.set(rows.subarray(y * t.width, (y + 1) * t.width), (t.y + y) * PAGE + t.x)
    }
    for (let i = 0; i < grey.length; i++) { const c = grey[i]; if (c !== TRANSPARENT) rgba.set([pal[c * 3], pal[c * 3 + 1], pal[c * 3 + 2], 255], i * 4) }
    write('tiles-' + p.index + '-index.png', png({ width: PAGE, height: p.height, pixels: grey, type: 'grey' }))
    write('tiles-' + p.index + '.png', png({ width: PAGE, height: p.height, pixels: rgba, type: 'rgba' }))
  }
  for (const t of art.tiles) {
    const e = { w: t.width, h: t.height, xo: t.xoffset, yo: t.yoffset, anim: t.animType, frames: t.frames, speed: t.speed, view: t.view, surface: surface[t.number], voxel: voxel.readInt16LE(t.number * 2) }
    if (t.pixels) { e.page = t.page; e.x = t.x; e.y = t.y }
    index[t.number] = e
  }
  write('tiles.json', JSON.stringify({ page: PAGE, pages: pages.map((p) => ({ width: PAGE, height: p.height })), tiles: index }))
}

if (want('maps')) {
  console.log('maps')
  fs.mkdirSync(path.join(DATA, 'maps'), { recursive: true })
  for (const e of blood.ofType('MAP')) write('maps/' + e.name.toLowerCase() + '.json', JSON.stringify(new BloodMap(blood.read(e))))
}

if (want('seqs')) {
  console.log('seqs')
  const seqs = {}
  for (const e of blood.ofType('SEQ')) seqs[e.name] = Object.assign({ id: e.id }, seq(blood.read(e)))
  write('seqs.json', JSON.stringify(seqs))
}

if (want('qavs')) {
  console.log('qavs')
  const qavs = {}
  for (const e of blood.ofType('QAV')) qavs[e.id] = Object.assign({ name: e.name }, qav(blood.read(e)))
  write('qavs.json', JSON.stringify(qavs))
}

if (want('voxels')) {
  // Each voxel model's faces that can be seen (a voxel's side with no voxel beside it): x, y, z, side (0-5: -x +x
  // -y +y -z +z), colour, flattened; with its size and pivot
  console.log('voxels')
  const models = {}
  let faces = 0
  for (const e of blood.ofType('KVX')) {
    const v = kvx(blood.read(e))
    const key = (x, y, z) => (x * 256 + y) * 256 + z
    const solid = new Set(v.voxels.map(([x, y, z]) => key(x, y, z)))
    const out = []
    const dirs = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]]
    for (const [x, y, z, c] of v.voxels) dirs.forEach(([dx, dy, dz], side) => { if (!solid.has(key(x + dx, y + dy, z + dz))) out.push(x, y, z, side, c) })
    faces += out.length / 5
    models[e.id] = { name: e.name, xsiz: v.xsiz, ysiz: v.ysiz, zsiz: v.zsiz, xpivot: v.xpivot, ypivot: v.ypivot, zpivot: v.zpivot, faces: out }
  }
  console.log('  ' + Object.keys(models).length + ' models, ' + faces + ' faces')
  write('voxels.json', JSON.stringify(models))
}

if (want('sounds')) {
  console.log('sounds')
  const sounds = RFF.load(path.join(ORIGINAL, 'SOUNDS.RFF'))
  fs.mkdirSync(path.join(DATA, 'sounds'), { recursive: true })
  const index = {}, formats = {}
  let bytes = 0
  for (const e of sounds.ofType('SFX')) {
    const s = sfx(sounds.read(e))
    formats[s.format] = (formats[s.format] || 0) + 1
    const raw = sounds.entry(s.raw + '.RAW')
    if (!raw) { console.log('  ' + e.key + ': no ' + s.raw + '.RAW'); continue }
    const file = s.raw.toLowerCase() + '.wav'
    if (!fs.existsSync(path.join(DATA, 'sounds', file))) { const w = wav(sounds.read(raw), rate(s.format)); fs.writeFileSync(path.join(DATA, 'sounds', file), w); bytes += w.length }
    index[e.name] = { id: e.id, file: 'sounds/' + file, relVol: s.relVol, pitch: s.pitch, pitchRange: s.pitchRange, rate: rate(s.format), loopStart: s.loopStart }
  }
  for (const e of sounds.ofType('WAV')) { fs.writeFileSync(path.join(DATA, 'sounds', e.name.toLowerCase() + '.wav'), sounds.read(e)) }
  console.log('  formats ' + JSON.stringify(formats) + ', ' + Object.keys(index).length + ' sounds, ' + bytes + ' bytes of WAV')
  write('sounds.json', JSON.stringify(index))
}
