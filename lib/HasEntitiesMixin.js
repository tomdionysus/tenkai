const _ = require('underscore')
const Mixin = require('./Mixin')

/**
 * HasEntitiesMixin is a {@link Mixin} to add a collection of {@link Entity}s to a class
 * @hideconstructor
 */
class HasEntitiesMixin extends Mixin {
	static init(obj, options = {}) {
		obj._mobs = {}
		obj._mobOrder = null
		obj._mobOrderMap = null
	}

	/**
	* Add a entity to this container with the given name
	*/
	addEntity(name, entity) {
		this._mobs[name] = entity
		entity.name = name
		if(entity.parent && entity.parent.removeEntity) entity.parent.removeEntity(name)
		entity.parent = this
		return entity
	}

	// Remove a named entity from this container, will trigger a redraw if defined on the container class
	removeEntity(name) {
		delete this._mobs[name]
		if(this.redraw) this.redraw()
	}

	// Return the entity with the given name. Throws an exception if the entity is not found.
	getEntity(name) {
		if (!this._mobs[name]) throw 'Entity not found: '+name
		return this._mobs[name]
	}

	// Draw entities in z-order
	drawEntities(context, z = null) {
		if(!this._mobOrder) this.sortEntitiesZ()
		if(z === null) {
			for(var i in this._mobOrder) this._mobOrder[i].draw(context)
		} else {
			for(var i in this._mobOrderMap[z]) this._mobOrderMap[z][i].draw(context)
		}
	}

	// Get entities from a perticular layer
	getEntitiesAtLayer(z) {
		if(!this._mobOrder) this.sortEntitiesZ()
		return this._mobOrderMap[z] || []
	}	

	// Recalculate the draw order of all entities based on their Z coordinate
	sortEntitiesZ() {
		this._mobOrder = _.sortBy(Object.values(this._mobs), 'z')
		var last = 0
		this._mobOrderMap = {}
		for(var i in this._mobOrder) {
			var entity = this._mobOrder[i]
			this._mobOrderMap[entity.z] = this._mobOrderMap[entity.z] || []
			this._mobOrderMap[entity.z].push(entity)
		}
	}

	// Call redraw on all entities in this container
	redrawEntities() {
		for(var i in this._mobs) this._mobs[i].redraw()
	}
}

module.exports = Mixin.export(HasEntitiesMixin)