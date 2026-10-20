// A player in the game on the server: its sprite, its input each tick (Blood's GINPUT: forward, strafe, turn,
// buttons, keys), and Blood's ProcessInput: accelerating along the facing, turning, jumping, crouching, looking up
// and down, and the eye's height following the body.
import { mulscale, mulscaler } from '../../common/engine.mjs'
import { moveDude, approxDist } from './physics.mjs'

// Blood's postures: [stand, swim, crouch], each { frontAccel, sideAccel, backAccel, pace, bobV, bobH, swayV, swayH,
// eyeAboveZ, weaponAboveZ, xOffset, zOffset, normalJumpZ, pwupJumpZ }
export const POSTURES = [
  { frontAccel: 0x4000, sideAccel: 0x4000, backAccel: 0x4000, pace: [14, 17], bobV: 24, bobH: 16, swayV: 32, swayH: 80, eyeAboveZ: 0x1600, weaponAboveZ: 0x1200, xOffset: 0xc00, zOffset: 0x90, normalJumpZ: -0xbaaaa, pwupJumpZ: -0x175555 },
  { frontAccel: 0x1200, sideAccel: 0x1200, backAccel: 0x1200, pace: [14, 17], bobV: 24, bobH: 16, swayV: 32, swayH: 80, eyeAboveZ: 0x1400, weaponAboveZ: 0x1000, xOffset: -0x600, zOffset: 0xb0, normalJumpZ: 0x5b05, pwupJumpZ: 0 },
  { frontAccel: 0x2000, sideAccel: 0x2000, backAccel: 0x2000, pace: [22, 28], bobV: 24, bobH: 16, swayV: 16, swayH: 40, eyeAboveZ: 0x800, weaponAboveZ: 0x600, xOffset: -0x600, zOffset: 0xb0, normalJumpZ: 0, pwupJumpZ: 0 }
]
export const STAND = 0, SWIM = 1, CROUCH = 2
/** The original moves 2032 for a demo's forward of 8 (2048): its acceleration fitted to its trace (fidelity/replay.mjs) */
export const INPUT_SCALE = 0xfe00

export const BUTTON = { jump: 1, crouch: 2, fire: 4, altFire: 8, lookUp: 16, lookDown: 32 }
export const KEY = { action: 1, jab: 2, prevItem: 4, nextItem: 8, useItem: 16, prevWeapon: 32, nextWeapon: 64, holster: 128, lookCenter: 256, lookLeft: 512, lookRight: 1024, spin180: 2048, pause: 4096, quit: 8192, restart: 16384 }

/** An input that does nothing */
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
    this.restTime = 0
    /** Player one's sequences (PLAY1*: idle 12032, then by offset); each player's own base */
    this.seqBase = 12032
  }

  get pos () { return this.sprite }

  /** Blood's ProcessInput, then the dude's move for the tick */
  tick (input = this.input) {
    this.input = input
    const s = this.sprite, level = this.level, trig = level.trig
    const posture = POSTURES[this.posture]
    if (input.buttons || input.forward || input.strafe || input.turn) this.restTime = 0
    else if (this.restTime >= 0) this.restTime += 4
    if (this.height < 256 || this.posture === SWIM) {
      const x = trig.Cos(s.ang), y = trig.Sin(s.ang)
      let speed = 0x10000
      if (this.height > 0 && this.posture !== SWIM) speed -= Math.trunc((this.height * 0x10000) / 256)
      if (input.forward) {
        let forward = input.forward
        forward = forward > 0 ? mulscale(posture.frontAccel, forward, 8) : mulscale(posture.backAccel, forward, 8)
        forward = mulscale(forward, INPUT_SCALE, 16)
        if (speed !== 0x10000) forward = mulscale(forward, speed, 16)
        s.xvel += mulscale(forward, x, 30)
        s.yvel += mulscale(forward, y, 30)
      }
      if (input.strafe) {
        let strafe = mulscale(posture.sideAccel, input.strafe, 8)
        strafe = mulscale(strafe, INPUT_SCALE, 16)
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
    if (this.posture === CROUCH) {
      if (!(input.buttons & BUTTON.crouch)) this.posture = STAND
    } else if (this.posture === STAND) {
      if (!this.cantJump && (input.buttons & BUTTON.jump) && this.height === 0) {
        s.zvel = posture.normalJumpZ
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
    this.stance()
    moveDude(level, this)
    this.view()
  }

  /** The sequence for how the player stands and moves (Blood's playerProcess): idle, moving, crouching, swimming */
  stance () {
    if (!this.seqs) return
    const s = this.sprite
    // The original stands idle again below about half its walking speed (its trace changes tile between 51900 and 30318)
    const speed = approxDist(s.xvel, s.yvel) >= 0x8000
    let id
    if (this.posture === SWIM) id = this.seqBase + 9
    else if (this.posture === CROUCH) id = speed ? this.seqBase + 15 : this.seqBase + 14
    else id = speed ? this.seqBase + 8 : this.seqBase
    this.seqs.spawn(s, id)
  }

  /** The eye's and the weapon's heights following the body, as springs (Blood's playerProcess) */
  view () {
    const s = this.sprite
    const posture = POSTURES[this.posture]
    let dz = s.z - posture.eyeAboveZ - this.zView
    this.zViewVel += dz > 0 ? mulscale(dz << 8, 0xa000, 16) : mulscale(dz << 8, 0x1800, 16)
    this.zView += this.zViewVel >> 8
    dz = s.z - posture.weaponAboveZ - this.zWeapon
    this.zWeaponVel += dz > 0 ? mulscale(dz << 8, 0x8000, 16) : mulscale(dz << 8, 0xc00, 16)
    this.zWeapon += this.zWeaponVel >> 8
    this.zViewVel = this.zViewVel - mulscaler(this.zViewVel, 0x7000, 16)
    this.zWeaponVel = this.zWeaponVel - mulscaler(this.zWeaponVel, 0x5000, 16)
  }

  /** Through a link to the sector above or below (Blood's playerResetInertia, and into or out of water) */
  linked (type) {
    const p = POSTURES[this.posture]
    this.zView = this.sprite.z - p.eyeAboveZ
    this.zWeapon = this.sprite.z - p.weaponAboveZ
    if (type === 10 || type === 14) { // out of water or goo
      this.posture = STAND
      if (!this.cantJump && (this.input.buttons & BUTTON.jump)) { this.sprite.zvel = -0x6aaaa; this.cantJump = true }
    } else if (type === 9 || type === 13) this.posture = SWIM
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
      health: this.health >> 4, armor: this.armor || [0, 0, 0], weapon: this.weapon || 1, ammo: this.ammo || [], keys: this.keys.map((k) => k ? 1 : 0),
      bob: this.bobHeight || 0, zWeapon: this.zWeapon - this.zView, tint: this.tint || null, dead: this.health <= 0 ? 1 : 0
    }
  }

  /** The camera: { x, y, z, ang, horiz, sectnum } */
  eye () {
    return { x: this.sprite.x, y: this.sprite.y, z: this.zView, ang: this.ang, horiz: this.horiz, sectnum: this.sprite.sectnum }
  }
}
