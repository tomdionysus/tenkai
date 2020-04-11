/**
 * Asset is the base class for graphical assets.
 * Assets can be used for {@link BackgroundScene}s, {@link TiledScene}s, {@link Mob}s etc. 
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
	constructor(options) {
		options = options || {}

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