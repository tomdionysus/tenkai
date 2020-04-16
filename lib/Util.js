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

	static delay(func, wait, ...args) {
		return setTimeout(function() {
			return func.apply(null, args)
		}, wait)
	}

	static debounce(func, wait, immediate) {
		var timeout, result

		var later = function(context, args) {
			timeout = null
			if (args) result = func.apply(context, args)
		}

		var debounced = function(args) {
			if (timeout) clearTimeout(timeout)
			if (immediate) {
				var callNow = !timeout
				timeout = setTimeout(later, wait)
				if (callNow) result = func.apply(this, args)
			} else {
				timeout = Util.delay(later, wait, this, args)
			}

			return result
		}

		debounced.cancel = function() {
			clearTimeout(timeout)
			timeout = null
		}

		return debounced
	}
}

module.exports = Util