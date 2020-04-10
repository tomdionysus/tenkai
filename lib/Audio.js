// Audio is the base class for game audio, loaded into a HTML5 'audio' tag.
class Audio {
	constructor(options) {
		options = options || {}
		
		this.src = options.src
		this.type = options.type

		this.startTime = options.startTime
		this.endTime = options.endTime
		this.loop = !!options.loop

		this._callonloaded = null
	}

	// Load the audio into a DOM 'audio' element
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

	// Play the audio from the current position
	play() {
		this.element.play()
	}

	// Play the audio from the start time index to the end time index and optionally loop 
	playRange(start, end, loop = false) {
		this.startTime = start
		this.endTime = end
		this.loop = loop
		this.play()
	}

	// Pause the audio
	pause() {
		this.element.pause()
	}

	// Stop the audio and reset it to the beginning
	stop() {
		this.element.oncanplaythrough = null
		this.element.pause()
		this.element.currentTime = '0'
	}

	// Fade out the audio over the given duration
	fadeOut(duration = 1000) { 
		this._fade(0, duration, this.pause.bind(this))
	}

	// Play and fade in the audio over the given duration
	fadeIn(duration = 1000) { 
		this.element.volume = 0
		this.play()
		this._fade(1, duration) 
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
		this.duration = this.element.duration
		if(!this.endTime) this.endTime = this.duration
		this.element.playbackRate = 1;
		this.element.currentTime = this.startTime || 0;
	}

	_ontimeupdate() {
		if (this.element.currentTime >= this.endTime) {
			if(this.loop) {
				this.element.currentTime = this.startTime
			} else {
    			this.element.pause()
			}
  		}
	}
}

module.exports = Audio