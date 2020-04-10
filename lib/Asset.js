/**
 * Asset is the base class for graphical assets, loaded as a HTML element 'img' tag.
 */
class Asset {
	constructor(options) {
		options = options || {}

		this.src = options.src
	}

	// Load the asset and optionally trigger the supplied callback when available. 
	load(callback) {
		this.element = document.createElement('img')
		if(callback) this.element.onload = () => callback()
		this.element.src = this.src
	}
}

module.exports = Asset