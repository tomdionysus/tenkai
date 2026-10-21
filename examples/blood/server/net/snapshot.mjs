// What a client is told of the game each tick: everything it draws and sounds, nothing it decides. The client has
// only the map's fixed shape from data/ (which walls make which sectors, which sector is beyond a wall); the state
// is the whole of what can change, as the server has it: every sector's heights and surfaces, every wall's place
// and surface, the sprites (all that can be seen), the players, and its own player's status for the HUD. (The
// tick's message is a diff against the last, so all of it goes once, on joining, and after that only what moved.)
//
//   sprites: { index: [x, y, z, ang, picnum, cstat, shade, pal, xrepeat, yrepeat, xoffset, yoffset, sectnum] }
//   sectors: [ [ceilingz, floorz, ceilingpicnum, floorpicnum, ceilingshade, floorshade, ceilingxpanning,
//              ceilingypanning, floorxpanning, floorypanning, ceilingstat, floorstat, visibility], ... ] (every sector)
//   walls:   [ [x, y, picnum, overpicnum, shade, cstat, xpanning, ypanning, pal], ... ] (every wall)
export const SPRITE_FIELDS = ['x', 'y', 'z', 'ang', 'picnum', 'cstat', 'shade', 'pal', 'xrepeat', 'yrepeat', 'xoffset', 'yoffset', 'sectnum']
export const SECTOR_FIELDS = ['ceilingz', 'floorz', 'ceilingpicnum', 'floorpicnum', 'ceilingshade', 'floorshade', 'ceilingxpanning', 'ceilingypanning', 'floorxpanning', 'floorypanning', 'ceilingstat', 'floorstat', 'visibility']
export const WALL_FIELDS = ['x', 'y', 'picnum', 'overpicnum', 'shade', 'cstat', 'xpanning', 'ypanning', 'pal']

export class Snapshots {
  constructor (game) {
    this.game = game
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
    const sectors = level.sectors.map((sec) => SECTOR_FIELDS.map((f) => sec[f]))
    const walls = level.walls.map((w) => WALL_FIELDS.map((f) => w[f]))
    game.changedSectors.clear()
    game.changedWalls.clear()
    const ended = game.ended ? { secret: game.ended.secret, kills: game.kills, total: game.dudes.total, secrets: game.secrets.found, totalSecrets: game.secrets.total } : null
    const players = game.players.filter(Boolean).map((p) => ({ number: p.number, name: p.name || 'Player ' + (p.number + 1), frags: p.frags || 0, deaths: p.deaths, kills: p.kills }))
    return { map: level.name, title: level.info.title || level.name, song: (level.info.song || '').toLowerCase(), mode: game.options.gameType, tick: game.frame, sprites, sectors, walls, ended, players }
  }

  /** One player's state: the world, and what only they see (their view, their status, their messages) */
  forPlayer (world, player) {
    return Object.assign({}, world, { you: player ? player.status() : null, ack: player ? player.inputSeq || 0 : 0 })
  }
}
