// A level of the game on the server: the map's sectors, walls and sprites as live, changing state, their Blood
// extras, the engine's queries over them, and Blood's per-sprite velocities. No Tenkai here: the server is the game.
import fs from 'fs'
import path from 'path'
import RFF from '../../formats/rff.mjs'
import BloodMap from '../../formats/map.mjs'
import Art from '../../formats/art.mjs'
import { Engine, Trig } from '../../common/engine.mjs'
import { SeqLibrary } from './seq.mjs'
import BloodExe from '../../formats/exe.mjs'
import qavRead from '../../formats/qav.mjs'

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname)

/** What every level shares: the archives, the tiles' sizes, the tables. Loaded once. */
export class Resources {
  constructor (dir = path.join(ROOT, 'original')) {
    this.blood = RFF.load(path.join(dir, 'BLOOD.RFF'))
    const art = new Art(fs.readFileSync(path.join(dir, 'SHARE000.ART')))
    this.tiles = {}
    for (const t of art.tiles) this.tiles[t.number] = { w: t.width, h: t.height, xo: t.xoffset, yo: t.yoffset, view: t.view, frames: t.frames, anim: t.animType, speed: t.speed }
    this.surface = fs.readFileSync(path.join(dir, 'SURFACE.DAT'))
    this.trig = new Trig(this.blood.read('COSINE.DAT'), fs.readFileSync(path.join(dir, 'TABLES.DAT')))
    this.ini = parseIni(fs.readFileSync(path.join(dir, 'BLOOD.INI'), 'latin1'))
    this.seqs = new SeqLibrary(this.blood)
    // The original's own tables, read out of its executable
    const exe = BloodExe.load(path.join(dir, 'BLOOD.EXE'))
    this.tables = { dudeInfo: exe.dudeInfo(), vectorData: exe.vectorData(), weaponItems: exe.weaponItems(), ammoItems: exe.ammoItems(), items: exe.items(), missileInfo: exe.missileInfo(), thingInfo: exe.thingInfo(), explodeInfo: exe.explodeInfo(), gibThings: exe.gibThings() }
    this.qavs = {}
    for (const e of this.blood.ofType('QAV')) this.qavs[e.id] = qavRead(this.blood.read(e))
  }

  map (name) { return new BloodMap(this.blood.read(name.toUpperCase() + '.MAP')) }
}

export function parseIni (text) {
  const out = {}
  let section = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/;.*$/, '').trim()
    if (!line) continue
    const m = /^\[(.+)\]$/.exec(line)
    if (m) { section = out[m[1].toLowerCase()] = {}; continue }
    const kv = /^([^=]+?)\s*=\s*(.*)$/.exec(line)
    if (kv && section) section[kv[1].trim().toLowerCase()] = kv[2].trim()
  }
  return out
}

export default class Level {
  /**
   * @param {Resources} res
   * @param {string} name The map, as BLOOD.INI names it (e1m1)
   */
  constructor (res, name) {
    this.res = res
    this.name = name.toLowerCase()
    const map = res.map(name)
    this.info = res.ini[this.name] || {}
    this.start = map.start
    this.visibility = map.visibility
    this.skyOffsets = map.skyOffsets
    this.pskybits = map.pskybits
    // Blood's type is the lotag, for sectors and walls as for sprites
    this.sectors = map.sectors.map((s) => Object.assign(s, { type: s.lotag }))
    this.walls = map.walls.map((w) => Object.assign(w, { type: w.lotag }))
    this.xsectors = map.xsectors
    this.xwalls = map.xwalls
    this.xsprites = map.xsprites
    // Sprites keep their Build fields; Blood's own: type (the lotag), flags (the hitag), velocities beside them
    this.sprites = map.sprites.map((s, i) => Object.assign(s, { index: i, type: s.lotag, flags: s.hitag }))
    for (const s of this.sprites) s.xvel = s.yvel = s.zvel = 0
    this.stamp = 0
    this.engine = new Engine(this, res.trig, res.tiles)
    this.trig = res.trig
    /** Sector floor and ceiling velocities (lifts carry what stands on them) */
    this.velFloor = new Int32Array(this.sectors.length)
    this.velCeil = new Int32Array(this.sectors.length)
  }

  /** A sprite's extra (XSPRITE), or null */
  x (sprite) { return sprite.extra >= 0 ? this.xsprites[sprite.extra] : null }
  xs (sectnum) { const s = this.sectors[sectnum]; return s && s.extra >= 0 ? this.xsectors[s.extra] : null }
  xw (wallnum) { const w = this.walls[wallnum]; return w && w.extra >= 0 ? this.xwalls[w.extra] : null }

  /** A sprite moved between sectors, was added or removed: the engine's lists are made again */
  touched () { this.stamp++; this.engine.touched() }

  /** Blood's GetSpriteExtents: the top and bottom z of a sprite, by its tile, offset and yrepeat */
  extents (s) {
    let top = s.z, bottom = s.z
    if ((s.cstat & 0x30) !== 0x20) {
      const t = this.res.tiles[s.picnum] || { h: 0, yo: 0 }
      const height = t.h
      const center = (height >> 1) + t.yo
      top -= (s.yrepeat << 2) * center
      bottom += (s.yrepeat << 2) * (height - center)
    }
    return { top, bottom }
  }

  /** A new sprite in a sector, of a status, returned (Blood's actSpawnSprite, without the extra) */
  spawn (sectnum, x, y, z, statnum, fields = {}) {
    const s = Object.assign({ x, y, z, cstat: 0, picnum: 0, shade: 0, pal: 0, clipdist: 0, filler: 0, xrepeat: 64, yrepeat: 64, xoffset: 0, yoffset: 0, sectnum, statnum, ang: 0, owner: -1, xvel: 0, yvel: 0, zvel: 0, lotag: 0, hitag: 0, extra: -1, type: 0, flags: 0 }, fields)
    let i = this.sprites.findIndex((p) => p.statnum === 1024)
    if (i < 0) { i = this.sprites.length; this.sprites.push(s) } else this.sprites[i] = s
    s.index = i
    this.touched()
    return s
  }

  /** Frees a sprite (Blood's actPostSprite to kStatFree) */
  remove (s) { s.statnum = 1024; s.sectnum = -1; this.touched() }
}
