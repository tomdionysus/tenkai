// What a client is told of the game each tick: everything it draws and sounds, nothing it decides. The client keeps
// the map's static geometry from data/; the state carries what changes: the sectors and walls that have moved, the
// sprites (all that can be seen), the players, and its own player's status for the HUD.
//
//   sprites: { index: [x, y, z, ang, picnum, cstat, shade, pal, xrepeat, yrepeat, xoffset, yoffset, sectnum] }
//   sectors: { index: [ceilingz, floorz, ceilingpicnum, floorpicnum, ceilingshade, floorshade, ceilingxpanning,
//              ceilingypanning, floorxpanning, floorypanning, ceilingstat, floorstat, visibility] }
//   walls:   { index: [x, y, picnum, overpicnum, shade, cstat, xpanning, ypanning, pal] }
export const SPRITE_FIELDS = ['x', 'y', 'z', 'ang', 'picnum', 'cstat', 'shade', 'pal', 'xrepeat', 'yrepeat', 'xoffset', 'yoffset', 'sectnum']
export const SECTOR_FIELDS = ['ceilingz', 'floorz', 'ceilingpicnum', 'floorpicnum', 'ceilingshade', 'floorshade', 'ceilingxpanning', 'ceilingypanning', 'floorxpanning', 'floorypanning', 'ceilingstat', 'floorstat', 'visibility']
export const WALL_FIELDS = ['x', 'y', 'picnum', 'overpicnum', 'shade', 'cstat', 'xpanning', 'ypanning', 'pal']

export class Snapshots {
  constructor (game) {
    this.game = game
    const level = game.level
    // What a sector or wall was at load: only those that differ from it are sent (the client has the map)
    this.sectorsAtLoad = level.sectors.map((s) => SECTOR_FIELDS.map((f) => s[f]))
    this.wallsAtLoad = level.walls.map((w) => WALL_FIELDS.map((f) => w[f]))
    this.dirtySectors = new Set()
    this.dirtyWalls = new Set()
  }

  /** The world part, made once a tick and shared by every client */
  world () {
    const game = this.game, level = game.level
    const sprites = {}
    for (const s of level.sprites) {
      if (!s || s.statnum >= 1024 || s.sectnum < 0) continue
      if ((s.cstat & 32768) && !s.always) continue
      sprites[s.index] = SPRITE_FIELDS.map((f) => s[f])
    }
    // Sectors and walls once changed are sent for good (cheap after the first: the diff carries only what moves)
    for (const n of game.changedSectors) {
      this.dirtySectors.add(n)
      const sec = level.sectors[n]
      for (let w = sec.wallptr; w < sec.wallptr + sec.wallnum; w++) this.dirtyWalls.add(w)
    }
    for (const n of game.changedWalls) this.dirtyWalls.add(n)
    game.changedSectors.clear()
    game.changedWalls.clear()
    const sectors = {}
    for (const n of this.dirtySectors) {
      const now = SECTOR_FIELDS.map((f) => level.sectors[n][f])
      if (now.some((v, i) => v !== this.sectorsAtLoad[n][i])) sectors[n] = now
    }
    const walls = {}
    for (const n of this.dirtyWalls) {
      const now = WALL_FIELDS.map((f) => level.walls[n][f])
      if (now.some((v, i) => v !== this.wallsAtLoad[n][i])) walls[n] = now
    }
    return { map: level.name, title: level.info.title || level.name, tick: game.frame, sprites, sectors, walls }
  }

  /** One player's state: the world, and what only they see (their view, their status, their messages) */
  forPlayer (world, player) {
    return Object.assign({}, world, { you: player ? player.status() : null })
  }
}
