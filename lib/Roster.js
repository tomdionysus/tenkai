/**
 * Roster keeps one {@link Entity} in a scene for each thing of a collection that changes: the units of a game's
 * state, the players in a room. Each update makes an entity for each new thing, brings every entity up to date with
 * its thing, and takes off the entities of things that are gone. The entity can be the game's own subclass of
 * Entity, which knows how to show its thing.
 *
 * @example
const units = new Roster({ scene: things, name: 'unit', make: (id, unit) => new UnitEntity(unit) })
// each frame (or each tick):
units.update(Object.entries(state.units), (entity, unit) => entity.show(unit))
 */
class Roster {
  /**
   * @param {object} options
   * @property {Scene|Entity} scene Where the entities go (anything with addEntity and removeEntity)
   * @property {function} make `(id, thing) => entity`, for a thing seen for the first time
   * @property {string} name Prefix of the entities' names in the scene (default 'thing')
   */
  constructor (options) {
    this.scene = options.scene
    this.make = options.make
    this.name = options.name || 'thing'
    this.entities = new Map()
  }

  /** The entity for a thing's id, if it has one. */
  get (id) {
    return this.entities.get(String(id))
  }

  /** How many entities. */
  get size () {
    return this.entities.size
  }

  /**
   * Brings the entities up to date with the things.
   * @param {Iterable} things `[id, thing]` pairs: every thing to show now
   * @param {function} each `(entity, thing, id) => {}`, to show each thing as it is now (optional)
   */
  update (things, each) {
    var live = new Set()
    for (var [id, thing] of things) {
      var key = String(id)
      live.add(key)
      var e = this.entities.get(key)
      if (!e) {
        e = this.scene.addEntity(this.name + key, this.make(id, thing))
        this.entities.set(key, e)
      }
      if (each) each(e, thing, id)
    }
    for (var [k, entity] of this.entities) {
      if (live.has(k)) continue
      this.scene.removeEntity(entity.name)
      this.entities.delete(k)
    }
  }

  /** Takes every entity off. */
  clear () {
    for (var entity of this.entities.values()) this.scene.removeEntity(entity.name)
    this.entities.clear()
  }
}

export default Roster
