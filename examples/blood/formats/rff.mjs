// Blood's RFF archives (BLOOD.RFF, SOUNDS.RFF, GUI.RFF), as found from the shareware's files.
//
// Layout (all little-endian):
//   header, 32 bytes: "RFF\x1a", u16 version (0x301 here), u16 pad, u32 dirOffset, u32 fileCount, 16 bytes pad
//   directory at dirOffset: fileCount entries of 48 bytes, XORed byte by byte with (dirOffset + (i >> 1)) & 0xff
//     entry: 16 bytes unused, u32 offset, u32 size, 8 bytes unused, u8 flags, char[3] type, char[8] name, u32 id
//     flags: 0x01 has an id, 0x02 external, 0x04 preload, 0x08 locked, 0x10 encrypted
//   a file's data at its offset; an encrypted file has its first 256 bytes XORed with (i >> 1)
import fs from 'fs'

const CRYPT = 0x10

export default class RFF {
  /** @param {Buffer} buffer The whole archive */
  constructor (buffer) {
    this.buffer = buffer
    if (buffer.toString('latin1', 0, 4) !== 'RFF\x1a') throw new Error('not an RFF archive')
    this.version = buffer.readUInt16LE(4)
    const dirOffset = buffer.readUInt32LE(8)
    const count = buffer.readUInt32LE(12)
    const dir = Buffer.from(buffer.subarray(dirOffset, dirOffset + count * 48))
    if (this.version === 0x301) for (let i = 0; i < dir.length; i++) dir[i] ^= (dirOffset + (i >> 1)) & 0xff
    /** The entries in directory order: { name, type, key ("NAME.TYP"), offset, size, flags, id } */
    this.entries = []
    this.byKey = new Map()
    for (let k = 0; k < count; k++) {
      const e = dir.subarray(k * 48, k * 48 + 48)
      const text = (a, b) => e.toString('latin1', a, b).replace(/\0.*$/, '')
      const entry = { offset: e.readUInt32LE(16), size: e.readUInt32LE(20), flags: e[32], type: text(33, 36), name: text(36, 44), id: e.readUInt32LE(44) }
      entry.key = entry.name + '.' + entry.type
      this.entries.push(entry)
      this.byKey.set(entry.key.toUpperCase(), entry)
    }
  }

  static load (path) {
    return new RFF(fs.readFileSync(path))
  }

  /** The entry named "NAME.TYP" (any case), or undefined */
  entry (key) {
    return this.byKey.get(key.toUpperCase())
  }

  /** The entries of a type ("MAP", "SEQ" ...) */
  ofType (type) {
    return this.entries.filter((e) => e.type.toUpperCase() === type.toUpperCase())
  }

  /** A file's data, decrypted: a Buffer of its own */
  read (key) {
    const e = typeof key === 'string' ? this.entry(key) : key
    if (!e) throw new Error('no entry ' + key)
    const data = Buffer.from(this.buffer.subarray(e.offset, e.offset + e.size))
    if (e.flags & CRYPT) for (let i = 0; i < Math.min(256, data.length); i++) data[i] ^= i >> 1
    return data
  }
}
