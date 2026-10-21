// What a player picks up by walking over it (Blood's CheckPickUp and PickUp): weapons, ammo, keys, health, armour and
// the powerups, from the original's item tables (BLOOD.EXE: weapons from 40, ammo from 60, items from 100), within
// 48 << 4 units and in sight.
import { approxDist } from './physics.mjs'
import { STAT, CMD } from './triggers.mjs'

// What the items do (Blood's PickupItem): health (amount, up to), armour (body, fire, spirit; up to), keys, the pack
const HEALTH = { 108: [10, 100], 109: [20, 100], 110: [100, 200], 111: [10, 100] }
const ARMOR = { 140: [50, 50, 50, 100], 141: [100, 0, 0, 100], 142: [0, 100, 0, 100], 143: [0, 0, 100, 100], 144: [200, 200, 200, 200] }
export const AMMO_MAX = [0, 100, 100, 500, 100, 50, 2400, 500, 100, 100, 50, 50, 50]
export const NAMES = {
  41: 'Sawed-off', 42: 'Tommy Gun', 43: 'Flare Pistol', 44: 'Voodoo Doll', 45: 'Tesla Cannon', 46: 'Napalm Launcher', 48: 'Spray Can', 49: 'Bundle of TNT', 50: 'Life Leech',
  62: 'Bundle of TNT', 63: 'Case of TNT', 64: 'Proximity Detonator', 65: 'Remote Detonator', 67: 'Few shotgun shells', 68: 'Box of shotgun shells', 69: 'A few bullets',
  72: 'Full drum of bullets', 73: 'Tesla Charge', 76: 'Flares', 79: 'Gasoline Can',
  100: 'Skull Key', 101: 'Eye Key', 102: 'Fire Key', 103: 'Dagger Key', 104: 'Spider Key', 105: 'Moon Key', 107: "Doctor's Bag", 108: 'Medicine Pouch',
  109: 'Life Essence', 110: 'Life Seed', 111: 'Red Potion', 113: 'Cloak of Invisibility', 114: 'Death Mask', 115: 'Jumping Boots', 117: 'Guns Akimbo',
  118: 'Diving Suit', 121: 'Crystal Ball', 124: 'Reflective Shots', 125: 'Beast Vision', 140: 'Basic Armor', 141: 'Body Armor', 142: 'Fire Armor',
  143: 'Spirit Armor', 144: 'Super Armor'
}

export default class Pickups {
  constructor (game) {
    this.game = game
    this.level = game.level
    this.tables = game.res.tables
  }

  /** Blood's CheckPickUp, each tick for each living player */
  check (p) {
    const level = this.level, engine = level.engine, s = p.sprite
    const { top, bottom } = level.extents(s)
    for (const item of level.sprites) {
      if (item.statnum !== STAT.item || item.sectnum < 0 || (item.flags & 32)) continue
      const dx = Math.abs(s.x - item.x) >> 4
      if (dx > 48) continue
      const dy = Math.abs(s.y - item.y) >> 4
      if (dy > 48) continue
      let vb = 0
      if (item.z < top) vb = (top - item.z) >> 8
      else if (item.z > bottom) vb = (item.z - bottom) >> 8
      if (vb > 32 || approxDist(dx, dy) > 48) continue
      const e = level.extents(item)
      if (engine.cansee(s.x, s.y, s.z, s.sectnum, item.x, item.y, item.z, item.sectnum) || engine.cansee(s.x, s.y, s.z, s.sectnum, item.x, item.y, e.top, item.sectnum) ||
        engine.cansee(s.x, s.y, s.z, s.sectnum, item.x, item.y, e.bottom, item.sectnum)) this.pickUp(p, item)
    }
  }

  pickUp (p, item) {
    const type = item.type
    let took = false, sound = 775
    if (type >= 40 && type < 60) { took = this.weapon(p, type); sound = 777 } else if (type >= 60 && type < 100) { took = this.ammo(p, type); sound = 782 } else if (type >= 100 && type < 200) took = this.item(p, type)
    if (!took) return
    this.game.message(p, 'Picked up ' + (NAMES[type] || 'item'))
    this.game.sound(item, sound)
    const x = this.level.x(item)
    if (x && x.pickup) this.game.triggers.triggerSprite(item.index, CMD.spritePickup)
    p.flash = 1
    // In Bloodbath, weapons and items come back; otherwise they are gone
    // (a pickup a player dropped on dying does not come back)
    if (this.game.options.gameType === 2 && type < 100 && !item.dropped) this.game.respawnLater(item, type >= 60 ? 30 : 30)
    else { this.game.seqs.kill(item); this.level.remove(item) }
  }

  weapon (p, type) {
    const w = this.tables.weaponItems[type]
    if (!w) return false
    const had = p.weapons[w.weapon]
    const ammoHad = w.ammoType >= 0 ? p.ammo[w.ammoType] : 0
    if (had && (w.ammoType < 0 || ammoHad >= AMMO_MAX[w.ammoType])) return false
    p.weapons[w.weapon] = true
    if (w.ammoType >= 0) p.ammo[w.ammoType] = Math.min(AMMO_MAX[w.ammoType], ammoHad + w.count)
    // Blood's WeaponUpgrade (0x4e3a4): a new weapon is taken up when its table says it beats the one in hand,
    // unless that is a lit TNT bundle or spray can
    if (!had) {
      const lit = (p.weapon === 6 || p.weapon === 7) && p.weaponState && ['lit', 'throw', 'drop'].includes(p.weaponState.state)
      const row = this.tables.weaponUpgrade[p.weapon]
      if (!lit && row && row[w.weapon] && w.weapon !== p.weapon) p.weapons.want = w.weapon
    }
    return true
  }

  ammo (p, type) {
    const a = this.tables.ammoItems[type]
    if (!a || a.ammoType === 255) return false
    if (p.ammo[a.ammoType] >= AMMO_MAX[a.ammoType]) return false
    p.ammo[a.ammoType] = Math.min(AMMO_MAX[a.ammoType], p.ammo[a.ammoType] + a.count)
    // (Blood's PickupAmmo, 0x3a3a0: the weapon it is for is had from now on, but not taken up)
    if (a.weapon) p.weapons[a.weapon] = true
    return true
  }

  item (p, type) {
    if (type >= 100 && type <= 106) {
      const key = type - 99
      if (p.keys[key]) return false
      p.keys[key] = true
      return true
    }
    if (HEALTH[type]) {
      const [amount, max] = HEALTH[type]
      const hp = p.health >> 4
      if (hp >= max) return false
      p.health = Math.min(max, hp + amount) << 4
      return true
    }
    if (ARMOR[type]) {
      const [b, f, s, max] = ARMOR[type]
      const before = p.armor.join()
      p.armor = [Math.min(max, p.armor[0] + b), Math.min(max, p.armor[1] + f), Math.min(max, p.armor[2] + s)]
      return p.armor.join() !== before
    }
    const info = this.tables.items[type]
    if (type === 107) return p.packAdd(0)
    if (info && info.packSlot >= 0) return p.packAdd(info.packSlot)
    // The powerups: held for a time (Blood counts them down)
    p.powerups[type] = (p.powerups[type] || 0) + 30 * 30
    return true
  }
}
