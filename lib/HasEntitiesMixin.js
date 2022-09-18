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
    this._entities[name] = entity
    entity.name = name
    if (entity.parent && entity.parent.removeEntity) entity.parent.removeEntity(name)
    entity.parent = this
    return entity
  }

  /**
	* Remove a named entity from this container, will trigger a redraw if defined on the container class
	* @param {String} name The name of the entity to remove
	*/
  removeEntity (name) {
    delete this._entities[name]
    if (this.redraw) this.redraw()
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
	* Draw entities
	* @param {CanvasRenderingContext2D} context The context in which to draw
	*/
  drawEntities (context) {
    // Draw Entities
    var entities
    if (this.perspectiveMode == HasEntitiesMixin.PERSPECTIVE_ANGLE) {
      entities = Object.values(this._entities).sort(function (a, b) { return (a.y + a.hotspotY > b.y + b.hotspotY) ? 1 : -1 })
    }
    if (this.perspectiveMode == HasEntitiesMixin.PERSPECTIVE_OVERHEAD) {
      entities = Object.values(this._entities).sort(function (a, b) { return (a.z > b.z) ? 1 : -1 })
    }
    for (var i in entities) entities[i].draw(context)
  }

  /**
	* Call redraw on all entities in this container by calling [redraw()]{@link Entity#redraw}
	*/
  redrawEntities () {
    for (var i in this._entities) this._entities[i].redraw()
  }
}

HasEntitiesMixin.PERSPECTIVE_OVERHEAD = 1
HasEntitiesMixin.PERSPECTIVE_ANGLE = 2

module.exports = Mixin.export(HasEntitiesMixin)
