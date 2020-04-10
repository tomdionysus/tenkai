const _ = require('underscore')

const HasMobsMixin = require('./HasMobsMixin')

// Mob is the base class for moving, animated subgraphics, also called 'Sprites' or 'Bobs' 
class Mob {
	constructor(options = {}) {
		options = options || {}

		// Mobs can have child mobs
		HasMobsMixin(this)

		// Asset is the graphical asset used for drawing this mob.
		// Usually, an asset will be divided up into 'tiles' of a specified width and height. A mob will display one
		// of these tiles at any given time, and can be animated - so each tile is a frame.
		this.asset = options.asset

		// The width and height of the tiles in the asset
		this.tileWidth = options.tileWidth
		this.tileHeight = options.tileHeight

		// The current tile coords as an array [x,y]
		this.tile = typeof(options.tile)=='undefined' ? null : options.tile

		// The current X/Y from the origin of the container (the Scene, or the parent Mob)
		this.x = options.x || 0
		this.y = options.y || 0

		// The Z index, in the stack of the container (the Scene, or the parent Mob)
		this.z = options.z || 0
		
		// The Parent container (the Scene, or the parent Mob)
		this.parent = typeof(options.parent)=='undefined' ? null : options.parent

		// The visible flag. Invisible Mobs and their children are not drawn
		this.visible = typeof(options.visible)=='undefined' ? true : !!options.visible

		// The scale and rotation settings for this mob. This context affects all child mobs also.
		this.scale = typeof(options.scale)=='undefined' ? 1 : options.scale
		this.rotate = typeof(options.rotate)=='undefined' ? 0 : options.rotate

		// Private props
		this._animations = {}
		this._currentanimation = null
		this.redraw()
	}

	// Mark the mob to be redrawn
	redraw() {
		// Mark us for redraw
		this._doredraw = true

		// Child Mobs
		this.redrawMobs()
	}

	// Draw the mob into the supplied 2DContext
	draw(context) {
		// If we're not marked for a redraw or we're invisible, return
		if(!this._doredraw || !this.visible) return

		// Save the context params
		context.save()

		// Reset the origin to our coordinates (so child mobs are relative to us)
		context.translate(this.x, this.y)
		context.scale(this.scale, this.scale)
		context.rotate(this.rotate)

		// Main Mob, omly draw if tile is not null and both tile coords are not null
		if(this.tile != null && this.tile[0] != null && this.tile[1] != null) {
			context.drawImage(
				this.asset.element, 
				this.tile[0]*this.tileWidth, 
				this.tile[1]*this.tileHeight, 
				this.tileWidth, 
				this.tileHeight,
				0, 
				0,
				this.tileWidth, 
				this.tileHeight
			)
		}

		// Draw all child mobs in their own order
		this.drawMobs(context)

		// Restore the context params for the next thing being drawn
		context.restore()

		// Reset the redraw flag
		this._doredraw = false
	}

	// Add an animation with the specified name and definition (def)
	// def is an array of the frame format [ tx, ty, dt, dx, dy ]:
	// * tx - Tile X Coordinate in the asset in units of tileWidth 
	// * ty - Tile Y Coordinate in the asset in units of tileHeight
	// * dt - (optional) Delay after this frame
	// * dx - (optional) x Delta at this frame (move x pixels) 
	// * dx - (optional) y Delta at this frame (move y pixels) 
	addAnimation(name, def) {
		this._animations[name] = def
	}

	// Start an animation
	// animation is an object with the following properties:
	// * name     - The name of the animation to start, must have been previously defined by addAnimation
	// * delay    - Default delay for each frame (unless overridden by the dt in the frame)
	// * frame    - (optional) The starting frame, defaults to 0
	// * loop     - (optional) Loop the animation (i) indefinitely if 'true' (ii) this number of times.
	// * dx       - (optional) x Delta at every frame (move x pixels), unless overridden by the dx in the frame
	// * dy       - (optional) y Delta at every frame (move y pixels), unless overridden by the dy in the frame
	// * minX     - (optional) Stop the animation when the x is equal or less than this value
	// * minY     - (optional) Stop the animation when the y is equal or less than this value
	// * maxX     - (optional) Stop the animation when the x is equal or greater than this value
	// * maxY     - (optional) Stop the animation when the y is equal or greater than this value
	// * stopTile - (optional) Set this tile [x,y] when the animation stops
	// * onStop   - (optional) A function to call when the animation stops, fn(mob) where mob is this mob.
	animateStart(animation) {
		if(animation) {
			if(this._currentanimation) this.animateStop(Mob.STOPSTATUS_REPLACED)
			this._currentanimation = animation
			this._currentanimation.frame = 0
		}

		var nextFrame = ()=>{
			// Return immediately if there is no current animation
			if(!this._currentanimation) return
			
			// Get the Frame and default Delay
			var delay = this._currentanimation.delay 
			var anim = this._animations[this._currentanimation.name]
			var frame = anim[this._currentanimation.frame]

			// Set the tile
			this.tile = frame.slice(0,2)
			// Override the default delay if specified in the frame
			if(frame.length>2) delay = frame[2]

			// Translation deltaX/Y default from animation itself
			var dx = this._currentanimation.dx || 0
			var dy = this._currentanimation.dy || 0

			// Override that deltaX/Y if specified in the frame
			if(frame.length>3 && frame[3]!=null) dx = frame[3]
			if(frame.length>4 && frame[4]!=null) dy = frame[4]

			// If deltaX/Y is specified, move us
			if(dx) this.x += dx
			if(dy) this.y += dy

			// End Conditions
			if (
				// We have moved to or past a specifed boundary (maxX, maxY)
				(this._currentanimation.maxX && this.x>=this._currentanimation.maxX) ||
				(this._currentanimation.maxY && this.y>=this._currentanimation.maxY) ||
				(this._currentanimation.minX && this.x<=this._currentanimation.minX) ||
				(this._currentanimation.minY && this.y<=this._currentanimation.minY)
			) {
				return this.animateStop(Mob.STOPSTATUS_COMPLETED)
			}

			// Increment the frame
			this._currentanimation.frame++

			// End / Loop conditions
			if(this._currentanimation.frame>=anim.length) {
				if (this._currentanimation.loop) {
					// Loop is specifed, restart from first frame
					this._currentanimation.frame = 0
					// Loop can be true, or a counter. If it's a counter, decrement it.
					if(this._currentanimation.loop!==true) this._currentanimation.loop--
				} else {
					// Loop not specifed, end the animation
					return this.animateStop(Mob.STOPSTATUS_COMPLETED)
				}
			}

			// Mark to redraw
			this.redraw()

			// If the animation is ongoing, schedule the next frame
			if(this._currentanimation) this._currentanimation._timeout = setTimeout(nextFrame, delay)
		}

		// Start the animation
		nextFrame()
	}

	// Stop with an optional Stop Status
	animateStop(stopStatus = Mob.STOPSTATUS_STOPPED) {
		if(!this._currentanimation) return
		if (this._currentanimation._timeout) clearTimeout(this._currentanimation._timeout)
		if(this._currentanimation.stopTile) this.tile = this._currentanimation.stopTile
		if(this._currentanimation.onStop) {
			var func = this._currentanimation.onStop, self = this, f = () =>{ func(self, stopStatus) }
			setImmediate(f)
		}
		this._currentanimation = null
		this.redraw()
	}
}

// Mob Animation stop status values:

// The animation stopped because it was finished (non-looped) or a boundary condition was met (maxX, maxY)
Mob.STOPSTATUS_COMPLETED = 1
// The animation was stopped with animateStop
Mob.STOPSTATUS_STOPPED = 2
// The animation was stopped because animateStart was called with a new animation, replacing it
Mob.STOPSTATUS_REPLACED = 3

module.exports = Mob
