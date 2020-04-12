/**
 *  Audio is the base class for game audio, loaded into a HTML5 'audio' tag.
 */
class Audio {
	/**
	* Create a new Audio with the specified options.
	* @param {object} options The options object for the Asset - see below
	* @example
const { Asset } = require('tenkai')

var asset = new Asset({
  src: 'music/maintitle.mp3',   // Source file
  type: 'audio/mpeg',           // MIME type of the asset file
  startTime: 0,                 // Start offset in ms (optional)
  endTime: 1040,                // End offset in ms (optional)
  loop: true                    // Loop the audio continuously (optional, default false)
})
	*/
	constructor(options = {}) {
		this.src = options.src
		this.type = options.type

		this.startTime = options.startTime
		this.endTime = options.endTime
		this.loop = !!options.loop

		this._callonloaded = null
	}

	/**
	* Load the Audio asynchronously from its src and optionally trigger the supplied callback when available. 
	* @param {function} callback The callback function to invoke when the asset has been loaded
	* @example
audio.load((err, au) => {
  console.log("Audio "+au.name+" Loaded")
}) 
	*/
	load(callback) {
		this.element = document.createElement('audio')
		this._callonloaded = callback
		this.element.oncanplaythrough = this._oncanplaythrough.bind(this)
		this.element.onloadedmetadata = this._onloadedmetadata.bind(this)
		this.element.ontimeupdate = this._ontimeupdate.bind(this)
		var source = document.createElement('source')
		source.src = this.src
		source.type = this.type
		this.element.appendChild(source)
	}

	/**
	* Play the audio from the current position.
	*/
	play() {
		this.element.play()
	}

	/**
	* Play the audio from the start time index to the end time index and optionally loop.
	* @param {float} start The start offset in ms (optional)
	* @param {float} end The end offset in ms (optional)
	* @param {boolean} start Loop the audio (optional)
	*/
	playRange(start = null, end = null, loop = null) {
		if(start) this.startTime = start
		if(end) this.endTime = end
		if(loop) this.loop = loop
		this.play()
	}

	/**
	* Pause the audio at the current position.
	*/
	pause() {
		this.element.pause()
	}

	/**
	* Stop the audio and reset it to the beginning
	*/
	stop() {
		this.element.oncanplaythrough = null
		this.element.pause()
		this.element.currentTime = '0'
	}

	/**
	* Fade out the audio over the given duration then call the optional callback
	* @param {integer} duration Fade duration in ms
	* @param {function} callback The callback function to invoke when the fade has completed
	*/
	fadeOut(duration = 1000, callback) { 
		this._fade(0, duration, ()=>{
			this.pause()
			if (callback) callback(null, this)
		})
	}

	/**
	* Fade in the audio over the given duration then call the optional callback
	* @param {integer} duration Fade duration in ms
	* @param {function} callback The callback function to invoke when the fade has completed
	*/
	fadeIn(duration = 1000, callback) { 
		this.element.volume = 0
		this.play()
		this._fade(1, duration, ()=>{
			if (callback) callback(null, this)
		})
	}

	_fade(toValue, duration, callback) {
		if(this._fadeTimeout) clearTimeout(this._fadeTimeout)
			
		var dv = (toValue - this.element.volume) / (duration/10)
		var x = () => {
			var p = this.element.volume + dv
			if((dv<0 && p <= toValue) || (dv>0 && p >= toValue)) {
				this.element.volume = toValue
				if(callback) {
					delete this._fadeTimeout
					return callback()
				}
			} else {
				this.element.volume = p
				this._fadeTimeout = setTimeout(x, 10)
			}
		}
		x()
	}

	_oncanplaythrough() {
		if(this._callonloaded) {
			var x = this._callonloaded
			this._callonloaded = null
			x()
		}
	}
	
	_onloadedmetadata() {
		this.duration = this.element.duration * 1000
		if(!this.endTime) this.endTime = this.duration
		this.element.playbackRate = 1
		this.element.currentTime = (this.startTime || 0)/1000
	}

	_ontimeupdate() {
		if (this.element.currentTime * 1000 >= this.endTime) {
			if(this.loop) {
				this.element.currentTime = this.startTime/1000
			} else {
				this.element.pause()
			}
		}
	}
}

module.exports = Audio