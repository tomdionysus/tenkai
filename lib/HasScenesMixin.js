const Util = require('./Util')
const Mixin = require('./Mixin')

/**
 * HasScenesMixin is a {@link Mixin} to add a collection of {@link Scene} objects to a class.
 * @hideconstructor
 */
class HasScenesMixin extends Mixin {
  static init (obj, options = {}) {
    obj._scenes = {}
    obj._sceneOrder = null
    obj._sceneOrderMap = null
  }

  /**
	* Add a scene to this container with the given name.
	* @param {String} name The name to assign to the scene
	* @param {Scene} scene The Scene to add
	*/
  addScene (name, scene) {
    this._scenes[name] = scene
    scene.name = name
    if (scene.parent && scene.parent.removeScene) scene.parent.removeScene(name)
    scene.parent = this
    return scene
  }

  /**
	* Remove a named scene from this container, will trigger a redraw if defined on the container class
	* @param {String} name The name of the scene to remove
	*/
  removeScene (name) {
    delete this._scenes[name]
    if (this.redraw) this.redraw()
  }

  /**
	* Return the scene with the given name. Throws an exception if the scene is not found.
	* @param {String} name The name of the scene to return
	* @returns {Scene} The Scene with the given name if found
	* @throws {Exception} 'Scene not found' if the scene is not found
	*/
  getScene (name) {
    if (!this._scenes[name]) throw 'Scene not found: ' + name
    return this._scenes[name]
  }

  /**
	* Draw scenes in z-order
	* @param {CanvasRenderingContext2D} context The context in which to draw
	* @param {integer} z If specified, only draw scenes with this z-layer (mapped by [sortScenesZ()]{@link HasScenes#sortScenesZ})
	*/
  drawScenes (context, z = null) {
    if (!this._sceneOrder) this.sortScenesZ()
    if (z === null) {
      for (var i in this._sceneOrder) this._sceneOrder[i].draw(context)
    } else {
      for (var i in this._sceneOrderMap[z]) this._sceneOrderMap[z][i].draw(context)
    }
  }

  /**
	* Get scenes from a particular layer
	* @param {integer} z Scene z-order to get (mapped by [sortScenesZ()]{@link HasScenes#sortScenesZ})
	*/
  getScenesAtLayer (z) {
    if (!this._sceneOrder) this.sortScenesZ()
    return this._sceneOrderMap[z] || []
  }

  /**
	* Recalculate the draw order of all scenes based on their Z coordinate and store internally, for use by [drawScenes()]{@link HasScenes#drawScenes}) and [getScenesAtLayer()]{@link HasScenes#getScenesAtLayer})
	*/
  sortScenesZ () {
    this._sceneOrder = Util.sortBy(Object.values(this._scenes), 'z')
    var last = 0
    this._sceneOrderMap = {}
    for (var i in this._sceneOrder) {
      var scene = this._sceneOrder[i]
      this._sceneOrderMap[scene.z] = this._sceneOrderMap[scene.z] || []
      this._sceneOrderMap[scene.z].push(scene)
    }
  }

  /**
	* Call redraw on all scenes in this container by calling [redraw()]{@link Scene#redraw}
	*/
  redrawScenes () {
    for (var i in this._scenes) this._scenes[i].redraw()
  }
}

module.exports = Mixin.export(HasScenesMixin)
