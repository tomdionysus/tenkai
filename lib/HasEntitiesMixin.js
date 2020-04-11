const _ = require('underscore')
const Mixin = require('./Mixin')

/**
 * The DOM CanvasRenderingContext2D interface.
 * @typedef CanvasRenderingContext2D Object
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D}
 */

/**
 * HasEntitiesMixin is a {@link Mixin} to add a collection of {@link Entity}s to a class
 * @hideconstructor
 */
class HasEntitiesMixin extends Mixin {
	static init(obj, options = {}) {
		obj._entitys = {}
		obj._entityOrder = null
		obj._entityOrderMap = null
	}

	/**
	* Add a entity to this container with the given name.
	* @param {String} name The name to assign to the entity
	* @param {Entity} entity The Entity to add
	*/
	addEntity(name, entity) {
		this._entitys[name] = entity
		entity.name = name
		if(entity.parent && entity.parent.removeEntity) entity.parent.removeEntity(name)
		entity.parent = this
		return entity
	}

	/**
	* Remove a named entity from this container, will trigger a redraw if defined on the container class
	* @param {String} name The name of the entity to remove
	*/
	removeEntity(name) {
		delete this._entitys[name]
		if(this.redraw) this.redraw()
	}

	/**
	* Return the entity with the given name. Throws an exception if the entity is not found.
	* @param {String} name The name of the entity to return
	* @returns {Entity} The Entity with the given name if found
	* @throws {Exception} 'Entity not found' if the entity is not found
	*/
	getEntity(name) {
		if (!this._entitys[name]) throw 'Entity not found: '+name
		return this._entitys[name]
	}

	/** 
	* Draw entities in z-order
	* @param {CanvasRenderingContext2D} context The context in which to draw
	* @param {integer} z If specified, only draw entities with this z-layer (mapped by [sortEntitiesZ()]{@link HasEntities#sortEntitiesZ})
	*/
	drawEntities(context, z = null) {
		if(!this._entityOrder) this.sortEntitiesZ()
		if(z === null) {
			for(var i in this._entityOrder) this._entityOrder[i].draw(context)
		} else {
			for(var i in this._entityOrderMap[z]) this._entityOrderMap[z][i].draw(context)
		}
	}

	/**
	* Get entities from a particular layer
	* @param {integer} z Entity z-order to get (mapped by [sortEntitiesZ()]{@link HasEntities#sortEntitiesZ})
	*/
	getEntitiesAtLayer(z) {
		if(!this._entityOrder) this.sortEntitiesZ()
		return this._entityOrderMap[z] || []
	}	

	/**
	* Recalculate the draw order of all entities based on their Z coordinate and store internally, for use by [drawEntities()]{@link HasEntities#drawEntities}) and [getEntitiesAtLayer()]{@link HasEntities#getEntitiesAtLayer})
	*/
	sortEntitiesZ() {
		this._entityOrder = _.sortBy(Object.values(this._entitys), 'z')
		var last = 0
		this._entityOrderMap = {}
		for(var i in this._entityOrder) {
			var entity = this._entityOrder[i]
			this._entityOrderMap[entity.z] = this._entityOrderMap[entity.z] || []
			this._entityOrderMap[entity.z].push(entity)
		}
	}

	/**
	* Call redraw on all entities in this container by calling [redraw()]{@link Entity#redraw}
	*/
	redrawEntities() {
		for(var i in this._entitys) this._entitys[i].redraw()
	}
}

module.exports = Mixin.export(HasEntitiesMixin)