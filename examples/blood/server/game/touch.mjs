// Blood's ProcessTouchObjects (BLOOD.EXE 0x2e41c), run for every dude, the players among them, in the first of
// actProcessSprites' dude loops, before any of them moves: what its last move touched (gSpriteHit: what is on top of
// it, what it ran into, what it stands on) is pushed, kicked, hurt, or hurts it.
import { STAT } from './triggers.mjs'
import { DAMAGE } from './combat.mjs'
import { approxDist } from './physics.mjs'

const isPlayerType = (t) => t >= 231 && t <= 238
// The dudes a player stands on and so hurts (BLOOD.EXE 0x2eab3: not the statues, the mother spider or the eel)
const STOMPED = (t) => (t >= 201 && t <= 207) || (t >= 210 && t <= 215) || t === 217 || (t >= 219 && t <= 229) || isPlayerType(t)

/**
 * Blood's actKickObject (0x2e1ac): the object flies off the kicker's way (give or take 85, a draw for each axis) at
 * twice the kicker's speed, 0xaaaaa at least, and up by an eighth of it; it moves and falls from now on
 */
export function kickObject (game, kicker, obj) {
  const R = game.random, trig = game.level.trig
  const speed = Math.max(approxDist(kicker.xvel, kicker.yvel) * 2, 0xaaaaa)
  obj.xvel = Math.floor(speed * trig.Cos((kicker.ang + R.Random2(85)) & 2047) / 2 ** 30)
  obj.yvel = Math.floor(speed * trig.Sin((kicker.ang + R.Random2(85)) & 2047) / 2 ** 30)
  obj.zvel = Math.floor(speed * -0x2000 / 2 ** 14)
  obj.flags = 7
  if (obj.statnum === STAT.thing) game.things.wake(obj)
}

/** One dude's (or player's) touches; `d` is its Dude or Player (ceilHit, wallHit, floorHit from its last move) */
export function processTouch (game, d) {
  const s = d.sprite, level = game.level, combat = game.combat
  const player = game.playerOf(s)
  const spriteOf = (hit) => {
    if ((hit & 0xe000) !== 0xc000) return null
    const h = level.sprites[hit & 0x1fff]
    // (with an xsprite: a player's sprite has one in Blood, the remake's player keeps its own)
    return h && (h.extra > 0 || game.playerOf(h)) ? h : null
  }
  // On top of it: a thing or a dude is pushed off by how far it is from the middle while this one moves
  const top = spriteOf(d.ceilHit || 0)
  if (top) {
    if ((top.statnum === STAT.thing || top.statnum === STAT.dude) && (s.xvel || s.yvel || s.zvel)) {
      if (top.statnum === STAT.thing) {
        const info = game.res.tables.thingInfo[top.type] || { flags: 0 }
        if (info.flags & 1) top.flags |= 1
        if (info.flags & 2) top.flags |= 4
        game.things.wake(top)
      } else top.flags |= 5
      top.xvel += top.x - s.x
      top.yvel += top.y - s.y
      // (Tchernobog crushes what carries it)
      if (top.statnum === STAT.dude && top.type === 229 && !(player && player.godMode)) combat.damage(top, s, DAMAGE.explode, (level.x(s) ? level.x(s).health : player ? player.health : 0) << 2)
    }
    if (top.type === 454) saw(game, s, top)
  }
  // Run into: a pail is kicked, a zombie's head kicked and hurt
  const hit = spriteOf(d.wallHit || 0)
  if (hit) {
    if (hit.type === 415) kickObject(game, s, hit)
    else if (hit.type === 427) {
      game.sound({ x: s.x, y: s.y, z: s.z, sectnum: s.sectnum }, 357)
      kickObject(game, s, hit)
      combat.damage(null, hit, DAMAGE.fall, 80)
    } else if (hit.type >= 239 && hit.type <= 242) combat.damage(null, s, DAMAGE.burn, 8)
  }
  // Stood on: a player kicks a pail or a head (once a half second), hurts a dude; a sector's floor may hurt
  const fh = d.floorHit || 0
  const under = spriteOf(fh)
  if (under) {
    if (under.type === 415 || under.type === 427) {
      if (player) {
        if ((player.kickAt || 0) > game.clock) return
        player.kickAt = game.clock + 60
      }
      kickObject(game, s, under)
      game.sound({ x: s.x, y: s.y, z: s.z, sectnum: s.sectnum }, 357)
      if (under.type === 415) game.sound(s, 374)
      else combat.damage(null, under, DAMAGE.fall, 80)
    } else if (under.type === 454) saw(game, s, under)
    else if (STOMPED(under.type) && player) combat.damage(s, under, DAMAGE.bullet, 8)
  } else if ((fh & 0xe000) === 0x4000) sectorTouch(game, s, fh & 0x1fff)
}

/** The circular saw (454): idle, a scratch; turning, it speeds up and cuts */
function saw (game, s, saw) {
  const x = game.level.x(saw)
  if (!x) return
  if (x.state) {
    x.data1 = 1
    x.data2 = Math.min(x.data2 + 8, 600)
    game.combat.damage(s, s, DAMAGE.bullet, 16)
  } else game.combat.damage(s, s, DAMAGE.bullet, 1)
}

/**
 * Blood's floor touch (0x2e2a4): a sector of type 618, or an xsector with a damage type, hurts what stands in it
 * (its data a tick's share of 120, 1000 when none; 618's type as it is, the others' one less); a floor of surface
 * 14 burns, with its hiss
 */
function sectorTouch (game, s, nSector) {
  const level = game.level, sec = level.sectors[nSector], xs = level.xs(nSector)
  if (xs && (sec.lotag === 618 || xs.damageType > 0)) {
    const type = Math.max(0, Math.min(6, sec.lotag === 618 ? xs.damageType : xs.damageType - 1))
    const amount = xs.data ? Math.max(0, Math.min(1000, xs.data)) : 1000
    game.combat.damage(s, s, type, Math.trunc(4 * amount / 120) << 4)
  }
  const surf = game.res.surfType ? game.res.surfType[sec.floorpicnum] : 0
  if (surf === 14) {
    game.combat.damage(s, s, DAMAGE.burn, 16)
    game.sound(s, 352)
  }
}
