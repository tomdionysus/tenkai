/**
 * Mixin contains functions for creating mixins - a way to do multiple inheritance in JavaScript.
 * Mixin classes can be defined, and their functionality merged into an instance of another class
 * when it is instantiated.
 * @hideconstructor
 * @example
<caption>To define a Mixin class</caption>
import { Mixin } from 'tenkai'

class YourMixinClass extends Mixin {
	static init(obj, options) {
		// Do your initialisation here, like you would in a constructor.
		// obj is the new object, eqivalent of 'this'.
		// The user class can pass options, etc.
		obj.testValue = 'This is a Mixin Class'
	}

	// Add methods as per a standard class:
	mixinMethod() {
		...
		console.log('mixinMethod: '+this.testValue)
		...
	}
}

// Use the Mixin.export() function to export the class.
export default Mixin.export(YourMixinClass)
 *
 * @example
<caption>To use a Mixin class</caption>
import YourMixinClass from './YourMixinClass.js'

class YourMixinUserClass {
	constructor(options = {}) {

		// Call the mixin with this and any options
		YourMixinClass(this, options)
	}

	anotherMethod() {
		// Now you can use the properties and methods on the mixin

		console.log(this.testValue)
		this.mixinMethod()
	}
}
 */
class Mixin {
  /**
	* Use export to export the class from the module as a mixin.
	* @param {Class} klass The class to export as a mixin
	* @example
	* export default Mixin.export(YourMixinClass)
	*/
  static export (klass) {
    return function (obj, options) {
      var members = Mixin._getMembers(klass)
      for (var name in members) {
        // The using class's own methods win, so a class can override what a mixin provides
        if (name in obj) continue
        var d = members[name]
        if (typeof d.value === 'function') {
          obj[name] = d.value.bind(obj)
        } else {
          Object.defineProperty(obj, name, {
            get: d.get && d.get.bind(obj),
            set: d.set && d.set.bind(obj),
            enumerable: false,
            configurable: true
          })
        }
      }
      if (klass.init) klass.init(obj, options)
    }
  }

  // The methods and accessors of a class and its superclasses, nearest first
  static _getMembers (klass) {
    var out = {}
    for (var proto = klass.prototype; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
      var descriptors = Object.getOwnPropertyDescriptors(proto)
      for (var name in descriptors) {
        if (name === 'constructor' || name in out) continue
        out[name] = descriptors[name]
      }
    }
    return out
  }
}

export default Mixin
