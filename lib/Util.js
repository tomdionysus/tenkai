class Util {
	static intersects(x1,y1,x2,y2,x3,y3,x4,y4) {
		return !(x3 > x2 || x4 < x1 || y3 > y2 || y4 < y1)
	}

	static sortBy(arr, property) {
		return arr.sort(function(a, b) { return (a[property] > b[property]) ? 1 : -1 })
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
				timeout = delay(later, wait, this, args)
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