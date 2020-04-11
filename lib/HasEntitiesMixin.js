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
	* Add a mob to this container with the given name
	*/
	addEntity(name, mob) {
		this._mobs[name] = mob
		mob.name = name
		if(mob.parent && mob.parent.removeEntity) mob.parent.removeEntity(name)
		mob.parent = this
		return mob
	}

	// Remove a named mob from this container, will trigger a redraw if defined on the container class
	removeEntity(name) {
		delete this._mobs[name]
		if(this.redraw) this.redraw()
	}

	// Return the mob with the given name. Throws an exception if the mob is not found.
	getEntity(name) {
		if (!this._mobs[name]) throw 'Entity not found: '+name
		return this._mobs[name]
	}

	// Draw mobs in z-order
	drawEntities(context, z = null) {
		if(!this._mobOrder) this.sortEntitiesZ()
		if(z === null) {
			for(var i in this._mobOrder) this._mobOrder[i].draw(context)
		} else {
			for(var i in this._mobOrderMap[z]) this._mobOrderMap[z][i].draw(context)
		}
	}

	// Get mobs from a perticular layer
	getEntitiesAtLayer(z) {
		if(!this._mobOrder) this.sortEntitiesZ()
		return this._mobOrderMap[z] || []
	}	

	// Recalculate the draw order of all mobs based on their Z coordinate
	sortEntitiesZ() {
		this._mobOrder = _.sortBy(Object.values(this._mobs), 'z')
		var last = 0
		this._mobOrderMap = {}
		for(var i in this._mobOrder) {
			var mob = this._mobOrder[i]
			this._mobOrderMap[mob.z] = this._mobOrderMap[mob.z] || []
			this._mobOrderMap[mob.z].push(mob)
		}
	}

	// Call redraw on all mobs in this container
	redrawEntities() {
		for(var i in this._mobs) this._mobs[i].redraw()
	}
}

module.exports = Mixin.export(HasEntitiesMixin)