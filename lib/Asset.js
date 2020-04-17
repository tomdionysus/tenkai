/**
 * Asset is the base class for graphical assets.
 * Assets are used with {@link Scene}, {@link Entity} etc. 
 * They are loaded as a HTML element 'img' tag.
 */
class Asset {
	/**
	* Create a new Asset with the specified options
	* @param {object} options The options object for the Asset - see below
	* @example
const { Asset } = require('tenkai')

var asset = new Asset({
  name: 'tilesAsset',
  src: 'assets/tileset.png'
})
	*/
	constructor(options = {}) {
		this.src = options.src
	}

	/**
	* Load the Asset asynchronously from its src and optionally trigger the supplied callback when available. 
	* @param {function} callback The callback function to invoke when the asset has been loaded
	* @example
asset.load((err, as) => {
  console.log("Asset "+as.name+" Loaded")
}) 
	*/
	load(callback = null) {
		this.element = document.createElement('img')
		if(callback) this.element.onload = (err) => callback(err.returnValue ? null : err.returnValue, this)
		this.element.src = this.src
	}
}

module.exports = Asset