/**
 * Util contains static utility functions for CompGeo and functional calls
 */
class Util {
	/**
	 * Return true if two rectangles intersect
	 * @param {Rectangle} r1 Rectangle 1
	 * @param {Rectangle} r2 Rectangle 2
	 * @returns {Boolean} True if the rectangles intersect
     */
	static intersects(r1,r2) {
		return !(r2[0] > r1[2] || r2[2] < r1[0] || r2[1] > r1[3] || r2[3] < r1[1])
	}
 
	/**
	 * Return the larger bounding rectangle of two rectangles
	 * @param {Rectangle} r1 Rectangle 1
	 * @param {Rectangle} r2 Rectangle 2
	 * @returns {Rectangle} The bounding rectangle containing both r1 and r2
     */
	static bounding(r1,r2) {
		return [
			Math.min(r1[0],r2[0]),
			Math.min(r1[1],r2[1]),
			Math.max(r1[2],r2[2]),
			Math.max(r1[3],r2[3])
		]
	}

	/**
	* Sort an array of objects in order by a property
	* @param {Object[]} arr The array of objects
	* @param {String} p The property name
	*/
	static sortBy(arr, p) {
		return arr.sort(function(a, b) { return (a[p] > b[p]) ? 1 : -1 })
	}

	/**
	* Delay calling a function by a specific time in µs
	* @param {function} func The function to call
	* @param {integer} wait The time to wait in µs
	* @param {...args} args The arguments to the function
	* @returns {integer} The setTimeout indentifier
	*/
	static delay(func, wait, ...args) {
		return setTimeout(function() {
			return func.apply(null, args)
		}, wait)
	}

	/**
	* Debounce a function. This means that the function can be called repeatedly during a timeout, but will only execute once after the timeout.
	* @param {function} func The function to call
	* @param {integer} wait The time to wait in µs
	* @returns {function} The debounced function
	*/
	static debounce(func, wait) {
		var to, res

		var callFn = function(obj, args) {
			to = null
			if (args) res = func.apply(obj, args)
		}

		var dbFn = function(args) {
			if (to) clearTimeout(to)
			to = Util.delay(callFn, wait, this, args)

			return res
		}

		dbFn.cancel = function() {
			clearTimeout(to)
			to = null
		}

		return dbFn
	}
}

module.exports = Util