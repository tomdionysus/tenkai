const _ = require('underscore')
const Mixin = require('./Mixin')

/**
 * HasScenesMixin is a {@link Mixin} to add a collection of {@link Scene}s to a class
 * @hideconstructor
 */
class HasScenesMixin extends Mixin {
	static init(obj, options = {}) {
		obj._scenes = {}
		obj._sceneOrder = null
		obj._sceneOrderMap = null
	}

	// Add the supplied scene to this container with the given name
	addScene(name, scene) {
		this._scenes[name] = scene
		scene.name = name
		if(scene.parent && scene.parent.removeScene) scene.parent.removeScene(name)
		scene.parent = this
		return scene
	}

	// Remove the named scene from this container, will trigger a redraw if defined on the container class
	removeScene(name) {
		delete this._scenes[name]
		if(this.redraw) this.redraw()
	}

	// Return the named scene. Throws an exception if the scene is not found.
	getScene(name) {
		if (!this._scenes[name]) throw 'scene not found: '+name
		return this._scenes[name]
	}

	// Draw scenes in z-order
	drawScenes(context, z = null) {
		if(!this._sceneOrder) this.sortScenesZ()
		if(z === null) {
			for(var i in this._sceneOrder) this._sceneOrder[i].draw(context)
		} else {
			for(var i in this._sceneOrderMap[z]) this._sceneOrderMap[z][i].draw(context)
		}
	}

	// Recalculate the draw order of all scenes based on their Z coordinate
	sortScenesZ() {
		this._sceneOrder = _.sortBy(Object.values(this._scenes), 'z')
		var last = 0
		this._sceneOrderMap = {}
		for(var i in this._sceneOrder) {
			var scene = this._sceneOrder[i]
			this._sceneOrderMap[scene.z] = this._sceneOrderMap[scene.z] || []
			this._sceneOrderMap[scene.z].push(scene)
		}
	}

	// Call redraw on all scenes in this container
	redrawScenes() {
		for(var i in this._scenes) this._scenes[i].redraw()
	}
}

module.exports = Mixin.export(HasScenesMixin)