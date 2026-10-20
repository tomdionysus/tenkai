// Dumps the original's files: what each holds, as the readers in formats/ see them.
//   node tools/dump.mjs rff <file.rff> [type]        the directory (of one type)
//   node tools/dump.mjs cat <file.rff> <NAME.TYP>    a file's bytes to stdout
import RFF from '../formats/rff.mjs'

const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'rff') {
  const rff = RFF.load(args[0])
  const types = {}
  for (const e of rff.entries) (types[e.type] = types[e.type] || []).push(e)
  console.log(args[0] + ': version ' + rff.version.toString(16) + ', ' + rff.entries.length + ' files')
  for (const [type, list] of Object.entries(types).sort()) {
    const bytes = list.reduce((s, e) => s + e.size, 0)
    const crypt = list.filter((e) => e.flags & 0x10).length
    console.log('  %s %d files, %d bytes, %d encrypted', type.padEnd(4), list.length, bytes, crypt)
    if (args[1] && args[1].toUpperCase() === type.toUpperCase()) for (const e of list) console.log('    %s %d bytes id %d flags %s', e.key.padEnd(13), e.size, e.id, e.flags.toString(16))
  }
} else if (cmd === 'cat') {
  process.stdout.write(RFF.load(args[0]).read(args[1]))
}
// (continued) node tools/dump.mjs map <file.rff> <E1M1> [fields]  the map's counts, and histograms of the extras' fields
//             node tools/dump.mjs art <file.art>                   the tiles: sizes, animation, view types
import BloodMap from '../formats/map.mjs'
import Art from '../formats/art.mjs'
import fs from 'fs'
if (cmd === 'map') {
  const rff = RFF.load(args[0])
  const names = args[1] ? [args[1]] : rff.ofType('MAP').map((e) => e.name)
  const hist = { xsectors: {}, xwalls: {}, xsprites: {} }
  const add = (h, x) => { for (const [k, v] of Object.entries(x)) { const f = h[k] = h[k] || { n: 0, nonzero: 0, min: Infinity, max: -Infinity, values: new Map() }; f.n++; if (v) f.nonzero++; f.min = Math.min(f.min, v); f.max = Math.max(f.max, v); if (f.values.size < 12) f.values.set(v, (f.values.get(v) || 0) + 1) } }
  for (const name of names) {
    const map = new BloodMap(rff.read(name + '.MAP'))
    const refs = ['xsectors', 'xwalls', 'xsprites'].map((k) => map[k].filter((x) => x.reference !== x.owner).length)
    console.log('%s: v%s rev %d, start (%d, %d, %d) ang %d sector %d, sky %d/%s vis %d song %d parallax %d; %d sectors (%d x), %d walls (%d x), %d sprites (%d x); references wrong: %s',
      name, map.version.toString(16), map.revision, map.start.x, map.start.y, map.start.z, map.start.ang, map.start.sector, map.pskybits, map.skyOffsets.join(','), map.visibility, map.songId, map.parallaxType,
      map.sectors.length, map.xsectors.length, map.walls.length, map.xwalls.length, map.sprites.length, map.xsprites.length, refs.join('/'))
    for (const k of Object.keys(hist)) for (const x of map[k]) add(hist[k], x)
  }
  if (args[2]) for (const k of Object.keys(hist)) { console.log('== ' + k); for (const [f, h] of Object.entries(hist[k])) console.log('  %s n %d nonzero %d min %d max %d  %s', f.padEnd(14), h.n, h.nonzero, h.min, h.max, [...h.values].map(([v, c]) => v + 'x' + c).join(' ')) }
} else if (cmd === 'art') {
  const art = new Art(fs.readFileSync(args[0]))
  const used = art.tiles.filter((t) => t.pixels)
  console.log('%s: version %d, tiles %d-%d, %d with pixels, %d bytes of pixels', args[0], art.version, art.first, art.last, used.length, used.reduce((s, t) => s + t.pixels.length, 0))
  const views = {}; for (const t of used) views[t.view] = (views[t.view] || 0) + 1
  console.log('view types', JSON.stringify(views), 'animated', used.filter((t) => t.animType).length, 'largest', used.reduce((m, t) => t.width * t.height > m.width * m.height ? t : m, used[0]).number)
  if (args[1]) for (const t of used.slice(Number(args[1]), Number(args[1]) + 40)) console.log(t.number, t.width + 'x' + t.height, 'anim', t.animType, t.frames, t.speed, 'off', t.xoffset, t.yoffset, 'view', t.view)
}
