const Mixin = require('./Mixin')

// const Scene = require('./Scene')

/**
 * HasEntitiesMixin is a {@link Mixin} to add a collection of {@link Entity} objects to a class.
 * @hideconstructor
 */
class HasEntitiesMixin {
  static init (obj, options = {}) {
    obj._entities = {}
  }

  /**
	* Add a entity to this container with the given name.
	* @param {String} name The name to assign to the entity
	* @param {Entity} entity The Entity to add
	*/
  addEntity (name, entity) {
    if (entity.parent && entity.parent.removeEntity) entity.parent.removeEntity(entity.name)
    this._entities[name] = entity
    entity.name = name
    entity.parent = this
    return entity
  }

  /**
	* Remove a named entity from this container
	* @param {String} name The name of the entity to remove
	*/
  removeEntity (name) {
    delete this._entities[name]
  }

  /**
	* Return the entity with the given name. Throws an exception if the entity is not found.
	* @param {String} name The name of the entity to return
	* @returns {Entity} The Entity with the given name if found
	* @throws {Exception} 'Entity not found' if the entity is not found
	*/
  getEntity (name) {
    if (!this._entities[name]) throw 'Entity not found: ' + name
    return this._entities[name]
  }

  /**
	* The entities in drawing order: by `z`, or in depth order when the container's `perspectiveMode` is
	* `PERSPECTIVE_DEPTH` (by `y`, which is where an entity stands, then by `elevation`). Entities that tie
	* keep the order they were added in.
	* @returns {Entity[]}
	*/
  sortedEntities () {
    var entities = Object.values(this._entities)
    if (this.perspectiveMode === HasEntitiesMixin.PERSPECTIVE_DEPTH) {
      return entities.sort((a, b) => (a.y - b.y) || ((a.elevation || 0) - (b.elevation || 0)))
    }
    return entities.sort((a, b) => a.z - b.z)
  }

  /**
	* Draw entities in order (see [sortedEntities()]{@link HasEntitiesMixin#sortedEntities}).
	* @param {CanvasRenderingContext2D} context The context in which to draw
	*/
  drawEntities (context) {
    for (var entity of this.sortedEntities()) entity.draw(context)
  }

  /**
	* Advance the animations of all entities by the given game time, by calling [animate()]{@link Entity#animate}
	* @param {number} ms Milliseconds of game time
	*/
  animateEntities (ms) {
    for (var entity of Object.values(this._entities)) {
      if (entity.animate) entity.animate(ms)
    }
  }
}

HasEntitiesMixin.PERSPECTIVE_OVERHEAD = 1
HasEntitiesMixin.PERSPECTIVE_DEPTH = 2

module.exports = Mixin.export(HasEntitiesMixin)
