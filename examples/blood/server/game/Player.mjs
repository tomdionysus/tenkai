// A player in the game on the server: its sprite, its input each tick (Blood's GINPUT: forward, strafe, turn,
// buttons, keys), and Blood's ProcessInput: accelerating along the facing, turning, jumping, crouching, looking up
// and down, and the eye's height following the body.
import { mulscale } from '../../common/engine.mjs'
import { moveDude, approxDist } from './physics.mjs'

// Blood's postures: [stand, swim, crouch], each { frontAccel, sideAccel, backAccel, pace, bobV, bobH, swayV, swayH,
// eyeAboveZ, weaponAboveZ, xOffset, zOffset, normalJumpZ, pwupJumpZ }
export const POSTURES = [
  { frontAccel: 0x4000, sideAccel: 0x4000, backAccel: 0x4000, pace: [14, 17], bobV: 24, bobH: 16, swayV: 32, swayH: 80, eyeAboveZ: 0x1600, weaponAboveZ: 0x1200, xOffset: 0xc00, zOffset: 0x90, normalJumpZ: -0xbaaaa, pwupJumpZ: -0x175555 },
  { frontAccel: 0x1200, sideAccel: 0x1200, backAccel: 0x1200, pace: [14, 17], bobV: 24, bobH: 16, swayV: 32, swayH: 80, eyeAboveZ: 0x1400, weaponAboveZ: 0x1000, xOffset: -0x600, zOffset: 0xb0, normalJumpZ: 0x5b05, pwupJumpZ: 0 },
  { frontAccel: 0x2000, sideAccel: 0x2000, backAccel: 0x2000, pace: [22, 28], bobV: 24, bobH: 16, swayV: 16, swayH: 40, eyeAboveZ: 0x800, weaponAboveZ: 0x600, xOffset: -0x600, zOffset: 0xb0, normalJumpZ: 0, pwupJumpZ: 0 }
]
export const STAND = 0, SWIM = 1, CROUCH = 2

export const BUTTON = { jump: 1, crouch: 2, fire: 4, altFire: 8, lookUp: 16, lookDown: 32 }
export const KEY = { action: 1, jab: 2, prevItem: 4, nextItem: 8, useItem: 16, prevWeapon: 32, nextWeapon: 64, holster: 128, lookCenter: 256, lookLeft: 512, lookRight: 1024, spin180: 2048, pause: 4096, quit: 8192, restart: 16384 }

/** An input that does nothing */
/** Blood's pain sounds of a player by the damage's kind (fall, burn, bullet, explode, drown, spirit, tesla) */
const PAIN = [[731, 732, 733], [742, 743, 744], [731, 732, 733], [731, 732, 733], [724, 724, 724], [731, 732, 733], [0, 0, 0]]

export const IDLE = { run: 0, forward: 0, turn: 0, strafe: 0, buttons: 0, keys: 0, use: 0, newWeapon: 0, mlook: 0 }

export default class Player {
  constructor (level, sprite, number = 0) {
    this.level = level
    this.sprite = sprite
    this.number = number
    this.player = true
    this.posture = STAND
    this.input = IDLE
    this.ang = sprite.ang & 2047
    sprite.ang = this.ang
    this.horiz = 100
    this.horizOff = 0
    this.lookCenter = false
    this.cantJump = false
    this.height = 0
    this.falling = false
    const p = POSTURES[this.posture]
    this.zView = sprite.z - p.eyeAboveZ
    this.zViewVel = 0
    this.zWeapon = sprite.z - p.weaponAboveZ
    this.zWeaponVel = 0
    this.bobPhase = 0
    this.bobAmp = 0
    this.bobHeight = 0
    this.bobWidth = 0
    this.health = 100 << 4
    this.keys = [false, false, false, false, false, false, false, false]
    this.armor = [0, 0, 0]
    this.ammo = new Array(13).fill(0)
    this.weapons = { 1: true, want: 0 }
    this.weapon = 1
    this.pack = [0, 0, 0, 0, 0]
    this.powerups = {}
    this.kills = 0
    this.deaths = 0
    this.fragged = 0
    this.flash = 0
    this.hurt = 0
    this.shakeAmount = 0
    this.restTime = 0
    /** Player one's sequences (PLAY1*: idle 12032, then by offset); each player's own base */
    this.seqBase = 12032
  }

  get pos () { return this.sprite }
  /** Its posture's numbers (Blood's gPosture: eye and weapon heights, speeds) */
  posture_ () { return POSTURES[this.posture] }
  /** Its sprite's xsprite (its medium: on land 0, in water 1, in goo 2) */
  get x () { return this.level.x(this.sprite) }

  /** The slope the player aims along: through the middle of the view (z per 16384 of x and y, in x and y units) */
  /** Blood's slope (BLOOD.EXE 0x3f476): -horiz << 7, the remake's horiz 100 being Blood's 0 */
  slope () { return (100 - this.horiz) * 128 }

  /** Blood's playerDamageSprite: armour takes some of it (body against bullets and blasts, fire against burning, spirit) */
  damaged (source, kind, damage) {
    // The death mask makes its wearer invulnerable while it lasts
    if (this.health <= 0 || this.godMode || this.powerups[114]) return 0
    const slot = kind === 1 ? 1 : kind === 5 ? 2 : (kind === 2 || kind === 3) ? 0 : -1
    if (slot >= 0 && this.armor[slot] > 0) {
      const absorbed = Math.min(this.armor[slot] << 4, damage >> 1)
      this.armor[slot] = Math.max(0, this.armor[slot] - (absorbed >> 4))
      damage -= absorbed
    }
    this.health = Math.max(0, this.health - damage)
    this.hurt = Math.min(64, this.hurt + (damage >> 4))
    if (this.health <= 0) this.die(source, kind)
    else if (this.game) {
      // Blood's playerDamageSprite: the pain's sound by the damage's kind (BLOOD.EXE d:0x16214), one of three on a
      // roll below 160 of damage; under water, drowning's own
      const pain = PAIN[kind] || PAIN[0]
      let id = damage >= 160 ? pain[0] : pain[this.game.random.Random(3)]
      if (kind === 4 && this.x && this.x.medium === 1) id = 714
      this.game.sound(this.sprite, id)
    }
    return damage
  }

  die (source, kind) {
    const s = this.sprite
    this.deaths++
    this.deadAt = this.game ? this.game.frame : 0
    if (this.seqs) this.seqs.spawn(s, this.seqBase + 1)
    s.cstat &= ~257
    if (this.game) {
      this.game.sound(s, kind === 3 ? 717 : 1063)
      // Blood's playerFrag: the message's words drawn from its tables (25 for a frag, 5 for a suicide: BLOOD.EXE
      // 0x401de, 0x4011b)
      const killer = source && this.game.playerOf(source)
      if (killer && killer !== this) { this.game.random.Random(25); killer.frags = (killer.frags || 0) + 1; this.game.message(null, (killer.name || 'Player') + ' killed ' + (this.name || 'Player')) } else if (killer === this) { this.game.random.Random(5); this.game.message(null, (this.name || 'Player') + ' killed themselves') }
    }
  }

  /** Blood's playerProcess: ProcessInput (the input's speed, turn, stance) and the weapon; move() moves it */
  tick (input = this.input) {
    this.input = input
    const s = this.sprite, level = this.level, trig = level.trig
    if (this.health <= 0) { this.deadTick(input); return }
    if (this.hurt > 0) this.hurt--
    if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.1)
    if (this.shakeAmount > 0) this.shakeAmount = Math.max(0, this.shakeAmount - 0x40)
    for (const k of Object.keys(this.powerups)) if (--this.powerups[k] <= 0) delete this.powerups[k]
    this.environment(input)
    const posture = POSTURES[this.posture]
    if (input.buttons || input.forward || input.strafe || input.turn) this.restTime = 0
    else if (this.restTime >= 0) this.restTime += 4
    // Blood's ProcessInput runs WeaponProcess here, before the turn and the push (BLOOD.EXE 0x3c29e): a throw takes
    // the thrower's speed as the last tick left it (BLOOD002's bundle at tick 221)
    if (this.weaponState) this.weaponState.tick(input)
    if (this.height < 256 || this.posture === SWIM) {
      const x = trig.Cos(s.ang), y = trig.Sin(s.ang)
      let speed = 0x10000
      if (this.height > 0 && this.posture !== SWIM) speed -= Math.trunc((this.height * 0x10000) / 256)
      if (input.forward) {
        let forward = input.forward
        forward = forward > 0 ? mulscale(posture.frontAccel, forward, 8) : mulscale(posture.backAccel, forward, 8)
        if (speed !== 0x10000) forward = mulscale(forward, speed, 16)
        s.xvel += mulscale(forward, x, 30)
        s.yvel += mulscale(forward, y, 30)
      }
      if (input.strafe) {
        let strafe = mulscale(posture.sideAccel, input.strafe, 8)
        if (speed !== 0x10000) strafe = mulscale(strafe, speed, 16)
        s.xvel += mulscale(strafe, y, 30)
        s.yvel -= mulscale(strafe, x, 30)
      }
    }
    // A client of the remake sends where it looks (Quake's way: the view angles are the client's, so a mouse turns
    // at once); a demo, the original's turn
    if (input.ang !== undefined) this.ang = input.ang & 2047
    else if (input.turn) this.ang = (this.ang + (input.turn >> 2)) & 2047
    if (input.horiz !== undefined) this.horiz = input.horiz
    if (input.keys & KEY.spin180) this.spin = this.spin || -1024
    s.ang = this.ang
    if (!(input.buttons & BUTTON.jump)) this.cantJump = false
    if (this.posture === SWIM) {
      // Swimming: jump rises, crouch sinks (Blood's swim posture's jump is its stroke upwards); the water's drag is
      // the dude loop's (5376), nothing more here (BLOOD001's dive at tick 317)
      if (input.buttons & BUTTON.jump) s.zvel -= posture.normalJumpZ
      if (input.buttons & BUTTON.crouch) s.zvel += posture.normalJumpZ
    } else if (this.posture === CROUCH) {
      if (!(input.buttons & BUTTON.crouch)) this.posture = STAND
    } else if (this.posture === STAND) {
      if (!this.cantJump && (input.buttons & BUTTON.jump) && this.height === 0) {
        // The jumping boots jump twice as high (Blood's pwupJumpZ)
        s.zvel = this.powerups[115] ? posture.pwupJumpZ : posture.normalJumpZ
        this.cantJump = true
        this.jumped = true
      }
      if (input.buttons & BUTTON.crouch) this.posture = CROUCH
    }
    // Looking up and down (keys), and back to level
    if (input.keys & KEY.lookCenter) this.lookCenter = true
    if (input.buttons & BUTTON.lookUp) { this.horiz = Math.min(this.horiz + 4, 200); this.lookCenter = false }
    if (input.buttons & BUTTON.lookDown) { this.horiz = Math.max(this.horiz - 4, 0); this.lookCenter = false }
    if (this.lookCenter && this.horiz !== 100) {
      this.horiz += this.horiz < 100 ? Math.min(4, 100 - this.horiz) : -Math.min(4, this.horiz - 100)
      if (this.horiz === 100) this.lookCenter = false
    }
    // As Blood's ProcessInput: the eye's and the weapon's heights follow the body, then isUnderwater (BLOOD.EXE
    // 0x3fd93: swimming, unless its eye is still above the water it is in), then the stance's sequence
    this.view()
    this.underwater = false
    if (this.posture === SWIM) {
      this.underwater = true
      const low = level.lowerLink ? level.lowerLink[s.sectnum] : -1
      if (low > 0 && (level.sprites[low].type === 14 || level.sprites[low].type === 10) && level.engine.getceilzofslope(s.sectnum, s.x, s.y) > this.zView) this.underwater = false
    }
    // out of the water its air is full again, the choke gone, the diving suit off (BLOOD.EXE 0x3fe25)
    if (!this.underwater) {
      this.underwaterTime = 1200
      this.chokeEffect = 0
      if (this.powerups[118]) delete this.powerups[118]
    }
    this.stance()
  }

  /**
   * The dude's move for the tick (Blood's MoveDude, in actProcessSprites: after the busy sectors, the events and
   * the sequences, which Blood runs after the players' input), then the view
   */
  move () {
    const s = this.sprite
    moveDude(this.level, this)
    if (this.health > 0) return
    const floor = s.z - 0x400
    if (this.zView < floor) this.zView = Math.min(floor, this.zView + 0x200)
  }

  /**
   * Blood's MoveDude, landing: the player's landing sound by the surface (playerLandingSound, a hard one past 30 << 4
   * of force squared), and the fall's damage past 100 << 4 of it
   */
  onLand (force, falling) {
    let damage = Math.floor(force * force / 2 ** 30)
    const game = this.game
    if (game) {
      if (damage > (15 << 4) && falling && this.floorHit) {
        const surfType = game.res.surfType, level = this.level, h = this.floorHit
        const pic = (h & 0xc000) === 0x4000 ? level.sectors[h & 0x3fff].floorpicnum : (h & 0xc000) === 0xc000 ? level.sprites[h & 0x3fff].picnum : level.walls[h & 0x3fff].picnum
        const surf = surfType ? surfType[pic] : 0
        const id = [-1, 600, 601, 602, 603, 604, 605, 605, 605, 600, 605, 605, 605, 604, 603][surf]
        if (surf && id > 0) game.sound(this.sprite, id)
      }
      if (damage > (30 << 4)) game.sound(this.sprite, 701)
    }
    damage -= 100 << 4
    if (damage > 0) { if (game) game.combat.damage(this.sprite, this.sprite, 0, damage); else this.damaged(this.sprite, 0, damage) }
  }

  /**
   * Where the player is: water (swimming, the air running out), a sector that hurts (Blood's damageType: lava,
   * fire, acid), and the pack's use keys (the doctor's bag heals from its store, up to 100)
   */
  environment (input) {
    const s = this.sprite, level = this.level, game = this.game
    // (swimming: by the water links, Blood's CheckLink; the air and drowning: dudeLoop; a floor that hurts: Blood's
    // ProcessTouchObjects, server/game/touch.mjs)
    if ((input.use & 8) && this.pack[0] > 0 && (this.health >> 4) < 100) {
      const heal = Math.min(this.pack[0], 100 - (this.health >> 4))
      this.health += heal << 4
      this.pack[0] -= heal
      if (game) game.sound(s, 776)
    }
  }

  /**
   * The player's part of Blood's first dude loop (BLOOD.EXE 0x34406), before its touches: the hand's choke (a
   * chance of drowning's damage), and under water its air (1200 clock ticks, the diving suit's while it is on, put on
   * as the air runs low), a choke's growing chance once the air is gone, the swimming sound, the bubbles thinning;
   * out of water in a game alone, a remark on a chance after ten seconds' rest
   */
  dudeLoop () {
    const s = this.sprite, game = this.game, R = game.random
    if (this.choked && R.Chance(0x8000)) game.combat.damage(s, s, 4, 12)
    if (this.underwater) {
      const suit = !!this.powerups[118]
      if (suit || this.godMode) this.underwaterTime = 1200
      else this.underwaterTime = Math.max((this.underwaterTime ?? 1200) - 4, 0)
      if (this.underwaterTime < 1080 && this.pack[1] > 0 && !suit) this.powerups[118] = this.pack[1]
      if (this.underwaterTime === 0) {
        this.chokeEffect = (this.chokeEffect || 0) + 4
        if (R.Chance(this.chokeEffect)) game.combat.damage(s, s, 4, 48)
      } else this.chokeEffect = 0
      if (s.xvel || s.yvel) game.sound(s, 709)
      if (this.bubbleTime) this.bubbleTime = Math.max(0, this.bubbleTime - 4)
    } else if (!game.options.gameType && this.health > 0 && this.restTime >= 1200 && R.Chance(0x200)) {
      this.restTime = -1
      game.sound(s, 3100 + R.Random(4))
    }
  }

  /** Dead: the body falls, the view sinks to the floor; a press of fire or open comes back (in a game of several) */
  deadTick (input) {
    // (its speed is its own still: Blood's dead player keeps what the blast gave it, BLOOD000 after tick 1162)
    if (this.game && this.game.frame - this.deadAt > 30 && (input.buttons & 4 || input.keys & KEY.action)) this.game.respawn(this)
  }

  /** The sequence for how the player stands and moves (Blood's playerProcess): idle, moving, crouching, swimming */
  stance () {
    if (!this.seqs) return
    const s = this.sprite
    // Blood's playerProcess: it walks while its speed >> 16 is not 0 (BLOOD.EXE 0x3fee0), measured before the
    // move's drag (BLOOD001's player stands at tick 292 at 61900, walks at 74000)
    const speed = approxDist(s.xvel, s.yvel) >= 0x10000
    let id
    // PLAY1's sequences: M4 (+11) crouching (the original shows its tiles 3917-3932 when crouched: fidelity/montecarlo),
    // M3 (+9) swimming
    if (this.posture === SWIM) id = this.seqBase + 9
    else if (this.posture === CROUCH) id = this.seqBase + 11
    else id = speed ? this.seqBase + 8 : this.seqBase
    this.seqs.spawn(s, id)
  }

  /** The eye's and the weapon's heights following the body, as springs (Blood's playerProcess) */
  view () {
    const s = this.sprite
    const posture = POSTURES[this.posture]
    // (BLOOD.EXE 0x3e664: each speed first moves toward the body's z speed, then the spring pulls it to its height)
    this.zViewVel += mulscale(s.zvel - this.zViewVel, 0x7000, 16)
    let dz = s.z - posture.eyeAboveZ - this.zView
    this.zViewVel += dz > 0 ? mulscale(dz << 8, 0xa000, 16) : mulscale(dz << 8, 0x1800, 16)
    this.zView += this.zViewVel >> 8
    this.zWeaponVel += mulscale(s.zvel - this.zWeaponVel, 0x5000, 16)
    dz = s.z - posture.weaponAboveZ - this.zWeapon
    this.zWeaponVel += dz > 0 ? mulscale(dz << 8, 0x8000, 16) : mulscale(dz << 8, 0xc00, 16)
    this.zWeapon += this.zWeaponVel >> 8
  }

  /** Through a link to the sector above or below (Blood's playerResetInertia, and into or out of water) */
  linked (type) {
    const p = POSTURES[this.posture]
    this.zView = this.sprite.z - p.eyeAboveZ
    this.zWeapon = this.sprite.z - p.weaponAboveZ
    if (type === 10 || type === 14) { // out of water or goo (BLOOD.EXE 0x301cf): standing, no bubbles, a splash
      if (this.x) this.x.medium = 0
      this.posture = STAND
      this.bubbleTime = 0
      if (!this.cantJump && (this.input.buttons & BUTTON.jump)) { this.sprite.zvel = -0x6aaaa; this.cantJump = true }
      if (this.game) this.game.sound(this.sprite, 721)
    } else if (type === 9 || type === 13) {
      // into water (Blood's CheckLink, BLOOD.EXE 0x302cb): swimming, bubbles by how fast it fell in (|zvel| >> 12,
      // Blood's bubbleTime) from now on, and the splash
      if (this.x) this.x.medium = type === 9 ? 1 : 2
      this.posture = SWIM
      if (this.game) this.game.unburn(this.sprite)
      this.bubbleTime = Math.abs(this.sprite.zvel) >> 12
      if (this.game) {
        this.game.triggers.post(this.sprite.index, 3, 0, 20, () => this.bubble())
        this.game.sound(this.sprite, 720)
      }
    }
  }

  /**
   * Blood's PlayerBubble callback (BLOOD.EXE 0x74640): while its bubbleTime lasts, bubbleTime >> 6 bubbles (effects
   * 23-25) about its body with its speed, give or take, and again 4 clock ticks on
   */
  bubble () {
    const s = this.sprite
    if (!this.bubbleTime || s.statnum >= 1024) return
    this.game.fx.bubbles(s, this.bubbleTime >> 6)
    this.game.triggers.post(s.index, 3, 4, 20, () => this.bubble())
  }

  /** Moved by a teleporter: facing its way, still, the eye where the body is */
  teleported (ang) {
    this.ang = ang & 2047
    this.sprite.ang = this.ang
    this.zViewVel = this.zWeaponVel = 0
    const p = POSTURES[this.posture]
    this.zView = this.sprite.z - p.eyeAboveZ
    this.zWeapon = this.sprite.z - p.weaponAboveZ
  }

  /** What the player's client is told of them: the view, and the status bar's numbers */
  status () {
    const s = this.sprite
    return {
      number: this.number, sprite: s.index, x: s.x, y: s.y, z: this.zView, ang: this.ang, horiz: this.horiz, sectnum: s.sectnum,
      health: this.health >> 4, armor: this.armor.slice(), weapon: this.weapon, ammo: this.ammo.slice(), keys: this.keys.map((k) => k ? 1 : 0),
      weapons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((n) => this.weapons[n]), pack: this.pack.slice(), powerups: Object.keys(this.powerups).map(Number),
      qav: this.weaponState ? this.weaponState.status() : null, zWeapon: this.zWeapon - this.zView, hurt: this.hurt, flash: Math.round(this.flash * 10),
      shake: this.shakeAmount, dead: this.health <= 0 ? 1 : 0, kills: this.kills, frags: this.frags || 0, deaths: this.deaths
    }
  }

  /** The camera: { x, y, z, ang, horiz, sectnum } */
  eye () {
    return { x: this.sprite.x, y: this.sprite.y, z: this.zView, ang: this.ang, horiz: this.horiz, sectnum: this.sprite.sectnum }
  }
}
