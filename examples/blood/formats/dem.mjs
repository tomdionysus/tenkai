// Blood's demos (BLOOD000.DEM ...), version 0x10a, read as found: a 411-byte header and 22-byte inputs, one a game
// tick (30 a second) for each player in turn.
//   header: "DEM\x1a", u16 version, i32 build?, i32 inputs, i32 players, i16 myconnectindex, i16 connecthead,
//     i16 connectpoints[8], then the game options: u8 gameType, u8 difficulty, i32 episode, i32 level,
//     char levelName[144], char song[144], i32 track, ... (to 411)
//   input: u8 syncFlags (bit 5 the run key, not played back), 3 pad, i8 forward (x 256 the game's), i16 turn, i8 strafe (x 256),
//     u32 buttons (jump 1, crouch 2, fire 4, alt fire 8, look up 16, look down 32), u32 keys (open 1, ...),
//     u32 use (beast vision 1, crystal ball 2, jump boots 4, medkit 8), u8 newWeapon, i8 mlook
import fs from 'fs'

export default class Demo {
  constructor (b) {
    if (b.toString('latin1', 0, 4) !== 'DEM\x1a') throw new Error('not a demo')
    this.version = b.readUInt16LE(4)
    this.count = b.readInt32LE(10)
    this.players = b.readInt32LE(14)
    const text = (o, n) => b.toString('latin1', o, o + n).replace(/\0.*$/s, '')
    this.options = { gameType: b[38], difficulty: b[39], episode: b.readInt32LE(40), level: b.readInt32LE(44), levelName: text(48, 144), song: text(192, 144), track: b.readInt32LE(336) }
    const H = 411, R = 22
    if (H + this.count * R !== b.length) throw new Error('demo of ' + b.length + ' bytes for ' + this.count + ' inputs')
    this.inputs = []
    for (let i = 0; i < this.count; i++) {
      const o = H + i * R
      this.inputs.push({
        // (the first byte's bit 5 is the recording's run key, but Blood's playback leaves its player not running: its
        // isRunning, d:0xf3956, read 0 all through BLOOD000, and its cultists choose their throws by it)
        syncFlags: b[o], run: 0, forward: b.readInt8(o + 4) * 256, turn: b.readInt16LE(o + 5), strafe: b.readInt8(o + 7) * 256,
        buttons: b.readUInt32LE(o + 8), keys: b.readUInt32LE(o + 12), use: b.readUInt32LE(o + 16), newWeapon: b[o + 20], mlook: b.readInt8(o + 21)
      })
    }
  }

  static load (path) { return new Demo(fs.readFileSync(path)) }

  /**
   * A demo of the given inputs, with another demo's header (its map, skill and options): for the original to play
   * (fidelity/montecarlo.mjs puts it where attract mode plays BLOOD000.DEM)
   */
  static write (header, inputs, patch = {}) {
    const H = 411, R = 22
    const b = Buffer.alloc(H + inputs.length * R)
    header.copy(b, 0, 0, H)
    b.writeInt32LE(inputs.length, 10)
    for (const [offset, value] of Object.entries(patch)) b[Number(offset)] = value
    inputs.forEach((n, i) => {
      const o = H + i * R
      b[o] = n.syncFlags ?? (n.run ? 0x20 : 0)
      b.writeInt8(Math.max(-128, Math.min(127, Math.round((n.forward || 0) / 256))), o + 4)
      b.writeInt16LE(n.turn || 0, o + 5)
      b.writeInt8(Math.max(-128, Math.min(127, Math.round((n.strafe || 0) / 256))), o + 7)
      b.writeUInt32LE(n.buttons || 0, o + 8)
      b.writeUInt32LE(n.keys || 0, o + 12)
      b.writeUInt32LE(n.use || 0, o + 16)
      b[o + 20] = n.newWeapon || 0
      b.writeInt8(n.mlook || 0, o + 21)
    })
    return b
  }
}
