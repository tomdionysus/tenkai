// Blood's sequences (SEQ) on the server: a sprite shows a sequence's frames in turn, each frame setting its tile,
// shade, pal, repeats and flags (blocking, hittable, see-through, invisible); a frame marked "trigger" calls back
// (a footstep, a shot, a bite). As Blood's seq.cpp: seqSpawn starts a sequence unless it is already playing, and
// seqProcess(4) advances every one by a game tick (4 of Blood's 120 Hz clock).
import seqRead from '../../formats/seq.mjs'

export class SeqLibrary {
  constructor (rff) {
    this.byId = new Map()
    for (const e of rff.ofType('SEQ')) this.byId.set(e.id, Object.assign({ name: e.name }, seqRead(rff.read(e))))
  }

  get (id) { return this.byId.get(id) || null }
}

export default class Seqs {
  constructor (level, library) {
    this.level = level
    this.library = library
    this.instances = new Map() // sprite index -> { seq, id, frame, timer, playing, callback }
  }

  /** Blood's seqSpawn: a sprite starts a sequence (unless it is playing it already) */
  spawn (sprite, id, callback = null) {
    const seq = this.library.get(id)
    if (!seq) return null
    const old = this.instances.get(sprite.index)
    if (old && old.id === id && old.playing) return old
    const inst = { seq, id, frame: 0, timer: seq.ticksPerFrame, playing: true, callback }
    this.instances.set(sprite.index, inst)
    this.update(sprite, seq.frames[0])
    if (seq.frames[0].trigger && callback) callback(sprite, inst)
    return inst
  }

  kill (sprite) { this.instances.delete(sprite.index) }

  playing (sprite) { const i = this.instances.get(sprite.index); return i && i.playing ? i.id : -1 }

  /** Blood's seqProcess: every playing sequence `ticks` of the 120 Hz clock further */
  process (ticks = 4) {
    for (const [index, inst] of this.instances) {
      if (!inst.playing) continue
      const sprite = this.level.sprites[index]
      if (!sprite || sprite.statnum >= 1024) { this.instances.delete(index); continue }
      inst.timer -= ticks
      while (inst.timer < 0) {
        inst.timer += inst.seq.ticksPerFrame
        inst.frame++
        if (inst.frame === inst.seq.frames.length) {
          if (inst.seq.flags & 1) inst.frame = 0
          else {
            inst.frame = inst.seq.frames.length - 1
            inst.playing = false
            // Flag 2: the sprite is removed when its sequence ends
            if (inst.seq.flags & 2) { this.instances.delete(index); if (this.onRemove) this.onRemove(sprite) }
            break
          }
        }
        const f = inst.seq.frames[inst.frame]
        this.update(sprite, f)
        if (f.trigger && inst.callback) inst.callback(sprite, inst)
      }
    }
  }

  /** Blood's UpdateSprite: a frame's look and flags on its sprite */
  update (s, f) {
    const tiles = this.level.res.tiles
    if (s.flags & 2) {
      const a = tiles[s.picnum] || { h: 0, yo: 0 }, b = tiles[f.tile] || { h: 0, yo: 0 }
      if (a.h !== b.h || a.yo !== b.yo || (f.yrepeat && f.yrepeat !== s.yrepeat)) s.flags |= 4
    }
    s.picnum = f.tile
    if (f.pal) s.pal = f.pal
    s.shade = f.shade
    if (f.xrepeat) s.xrepeat = f.xrepeat
    if (f.yrepeat) s.yrepeat = f.yrepeat
    s.cstat = f.transparent ? s.cstat | 2 : s.cstat & ~2
    s.cstat = f.transparent2 ? s.cstat | 512 : s.cstat & ~512
    s.cstat = f.blockable ? s.cstat | 1 : s.cstat & ~1
    s.cstat = f.hittable ? s.cstat | 256 : s.cstat & ~256
    s.cstat = f.invisible ? s.cstat | 32768 : s.cstat & ~32768
    s.flags = f.smoke ? s.flags | 256 : s.flags & ~256
    s.flags = f.aim ? s.flags | 8 : s.flags & ~8
    s.flags = f.flipX ? s.flags | 1024 : s.flags & ~1024
    s.flags = f.flipY ? s.flags | 2048 : s.flags & ~2048
  }
}
