const Entity = require("../lib/Entity")

describe('Entity', () => {
	it('should allow New', () => {
		var x1 = new Entity()
		var x2 = new Entity()

		expect(x1).not.toBe(x2)
	})

	it('should use option defaults', () => {
		var options = {
			tile: [1,1],
			parent: 'PARENT',
			visible: 'VISIBLE',
			scale: 5,
			rotate: 6,
		}

		var x1 = new Entity(options)

		expect(x1.tile).toEqual([1,1])
		expect(x1.parent).toEqual('PARENT')
		expect(x1.visible).toEqual(true)
		expect(x1.scale).toEqual(5)
		expect(x1.rotate).toEqual(6)
	})

	describe('draw', () => {
		it('should return immediately if _doredraw is not set', () => {
			var context = { drawImage: ()=>{} }
			spyOn(context,'drawImage')

			var x1 = new Entity()
			x1._doredraw = false
			x1.draw(context)
			
			expect(context.drawImage).not.toHaveBeenCalled()
		})

		it('should return immediately if visible is not false', () => {
			var context = { drawImage: ()=>{} }
			spyOn(context,'drawImage')

			var x1 = new Entity()
			x1.visible = false
			x1.draw(context)
			
			expect(context.drawImage).not.toHaveBeenCalled()
		})

		it('should call context functions and drawEntities and reset _doredraw', () => {
			var context = generateSpyObject(['drawImage', 'save', 'translate', 'scale', 'rotate', 'restore'])

			var x1 = new Entity({
				x: 3,
				y: 4,
				scale: 5,
				rotate: 6
			})
			x1._doredraw = true

			spyOn(x1,'drawEntities')

			x1.tile = null
			x1.draw(context)
			
			expect(x1.drawEntities).toHaveBeenCalledWith(context)

			expect(context.save).toHaveBeenCalledWith()
			expect(context.translate).toHaveBeenCalledWith(3,4)
			expect(context.scale).toHaveBeenCalledWith(5,5)
			expect(context.rotate).toHaveBeenCalledWith(6)
			expect(context.drawImage).not.toHaveBeenCalled()
			expect(context.restore).toHaveBeenCalledWith()

			expect(x1._doredraw).toBeFalsy()
		})

		it('should call drawImage with correct params', () => {
			var context = generateSpyObject(['drawImage', 'save', 'translate', 'scale', 'rotate', 'restore'])

			var x1 = new Entity({
				x: 3,
				y: 4,
				scale: 5,
				rotate: 6,
				asset: { element: 'ELEMENT' },
				tileWidth: 500,
				tileHeight: 600
			})

			x1._doredraw = true

			spyOn(x1,'drawEntities')

			x1.tile = [10,11]
			x1.draw(context)
			
			expect(x1.drawEntities).toHaveBeenCalledWith(context)

			expect(context.drawImage).toHaveBeenCalledWith('ELEMENT', 5000, 6600, 500, 600, 0, 0, 500, 600)

			expect(x1._doredraw).toBeFalsy()
		})

		it('should not call drawImage if tile x is null', () => {
			var context = generateSpyObject(['drawImage', 'save', 'translate', 'scale', 'rotate', 'restore'])

			var x1 = new Entity({
				x: 3,
				y: 4,
				scale: 5,
				rotate: 6
			})
			x1._doredraw = true

			spyOn(x1,'drawEntities')

			x1.tile = [null,1]
			x1.draw(context)
			
			expect(context.drawImage).not.toHaveBeenCalled()
		})

		it('should not call drawImage if tile y is null', () => {
			var context = generateSpyObject(['drawImage', 'save', 'translate', 'scale', 'rotate', 'restore'])

			var x1 = new Entity({
				x: 3,
				y: 4,
				scale: 5,
				rotate: 6
			})
			x1._doredraw = true

			spyOn(x1,'drawEntities')

			x1.tile = [5,null]
			x1.draw(context)
			
			expect(context.drawImage).not.toHaveBeenCalled()
		})
	})

	describe('animateStart', () => {
		it('should animateStop current animation if defined', () => {
			var x1 = new Entity()

			spyOn(x1,'animateStop')

			var anim = [[0,0]]
			var anim2 = [[0,0],[1,1]]
			var runAnim = { name:'testanim' }
			
			x1.addAnimation('testanim',anim)
			x1._currentanimation = anim2

			x1.animateStart(runAnim)

			expect(x1.animateStop).toHaveBeenCalledWith(Entity.STOPSTATUS_REPLACED)
			expect(x1._currentanimation).toBe(runAnim)
		})

		it('should continue existing animation', () => {
			var x1 = new Entity()

			spyOn(x1,'animateStop')

			var anim = [ [0,0] ]
			var runAnim = { name:'testanim', frame:0 }
			
			x1.addAnimation('testanim',anim)
			x1._currentanimation = runAnim
			x1.animateStart()

			expect(x1._currentanimation).toBe(runAnim)
		})

		it('should return if no existing animation', () => {
			var x1 = new Entity()

			x1.animateStart()

			expect(x1._currentanimation).toBeNull()
		})

		it('should run animation with one frame', () => {
			var x1 = new Entity()

			spyOn(x1,'animateStop')

			var anim = [[0,0]]
			var anim2 = [[0,0],[1,1]]
			var runAnim = { name:'testanim' }
			
			x1.addAnimation('testanim',anim)

			x1.animateStart(runAnim)

			expect(x1.animateStop).toHaveBeenCalledWith(Entity.STOPSTATUS_COMPLETED)
			expect(x1._currentanimation).toBe(runAnim)
		})

		it('should run animation with two frames using anim delay', () => {
			var x1 = new Entity()

			spyOn(x1,'animateStop')
			spyOn(global,'setTimeout')

			var anim = [[0,0],[1,1]]
			var runAnim = { name:'testanim', delay: 145 }
			
			x1.addAnimation('testanim',anim)

			x1.animateStart(runAnim)

			expect(x1.animateStop).not.toHaveBeenCalled()
			expect(global.setTimeout).toHaveBeenCalledWith(jasmine.any(Function), 145)
		})

		it('should run animation with two frames and frame delay', () => {
			var x1 = new Entity()

			spyOn(x1,'animateStop')
			spyOn(global,'setTimeout')

			var anim = [[0,0,11],[1,1]]
			var runAnim = { name:'testanim', delay: 145 }
			
			x1.addAnimation('testanim',anim)

			x1.animateStart(runAnim)

			expect(x1.animateStop).not.toHaveBeenCalled()
			expect(global.setTimeout).toHaveBeenCalledWith(jasmine.any(Function), 11)
		})

		it('should run animation with two frames and anim dx, modifying entity x', () => {
			var x1 = new Entity()

			x1.x = 99

			spyOn(x1,'animateStop')
			spyOn(global,'setTimeout')

			var anim = [[0,0,null,100],[1,1]]
			var runAnim = { name:'testanim', delay: 145, dx: 22 }
			
			x1.addAnimation('testanim',anim)

			x1.animateStart(runAnim)

			expect(x1.animateStop).not.toHaveBeenCalled()
			expect(global.setTimeout).toHaveBeenCalledWith(jasmine.any(Function), 145)
			expect(x1.x).toEqual(199)
		})

		it('should run animation with two frames and anim dy, modifying entity y', () => {
			var x1 = new Entity()

			x1.y = 79

			spyOn(x1,'animateStop')
			spyOn(global,'setTimeout')

			var anim = [[0,0],[1,1]]
			var runAnim = { name:'testanim', delay: 145, dy: 22 }
			
			x1.addAnimation('testanim',anim)

			x1.animateStart(runAnim)

			expect(x1.animateStop).not.toHaveBeenCalled()
			expect(global.setTimeout).toHaveBeenCalledWith(jasmine.any(Function), 145)
			expect(x1.y).toEqual(101)
		})

		it('should run animation with two frames and frame dx/dy, modifying entity x and y', () => {
			var x1 = new Entity()

			x1.x = -5
			x1.y = -10

			spyOn(x1,'animateStop')
			spyOn(global,'setTimeout')

			var anim = [[0,0,null,32,33],[1,1]]
			var runAnim = { name:'testanim', delay: 145, dy: 22 }
			
			x1.addAnimation('testanim',anim)

			x1.animateStart(runAnim)

			expect(x1.animateStop).not.toHaveBeenCalled()
			expect(global.setTimeout).toHaveBeenCalledWith(jasmine.any(Function), 145)
			expect(x1.x).toEqual(27)
			expect(x1.y).toEqual(23)
		})

		it('should run animation with two frames and minX boundary, calling animateStop', () => {
			var x1 = new Entity()

			x1.x = -5

			spyOn(x1,'animateStop')

			var anim = [[0,0],[1,1]]
			var runAnim = { name:'testanim', minX: -2 }
			
			x1.addAnimation('testanim',anim)

			x1.animateStart(runAnim)

			expect(x1.animateStop).toHaveBeenCalledWith(Entity.STOPSTATUS_COMPLETED)
		})

		it('should run animation with two frames and minY boundary, calling animateStop', () => {
			var x1 = new Entity()

			x1.y = -10

			spyOn(x1,'animateStop')

			var anim = [[0,0],[1,1]]
			var runAnim = { name:'testanim', minY: -5 }
			
			x1.addAnimation('testanim',anim)

			x1.animateStart(runAnim)

			expect(x1.animateStop).toHaveBeenCalledWith(Entity.STOPSTATUS_COMPLETED)
		})

		it('should run animation with two frames and maxX boundary, calling animateStop', () => {
			var x1 = new Entity()

			x1.x = 100

			spyOn(x1,'animateStop')

			var anim = [[0,0],[1,1]]
			var runAnim = { name:'testanim', maxX: 100 }
			
			x1.addAnimation('testanim',anim)

			x1.animateStart(runAnim)

			expect(x1.animateStop).toHaveBeenCalledWith(Entity.STOPSTATUS_COMPLETED)
		})

		it('should run animation with two frames and maxY boundary, calling animateStop', () => {
			var x1 = new Entity()

			x1.y = 200

			spyOn(x1,'animateStop')

			var anim = [[0,0],[1,1]]
			var runAnim = { name:'testanim', maxY: 150 }
			
			x1.addAnimation('testanim',anim)

			x1.animateStart(runAnim)

			expect(x1.animateStop).toHaveBeenCalledWith(Entity.STOPSTATUS_COMPLETED)
		})

		it('should run animation and loop if set true', () => {
			var x1 = new Entity()

			spyOn(x1,'animateStop')
			spyOn(global,'setTimeout')

			var anim = [[0,0],[1,1]]
			var runAnim = { name:'testanim', delay: 145, frame: 1, loop: true }
			
			x1.addAnimation('testanim',anim)

			x1._currentanimation = runAnim
			x1.animateStart()

			expect(x1.animateStop).not.toHaveBeenCalled()
			expect(global.setTimeout).toHaveBeenCalledWith(jasmine.any(Function), 145)
			expect(runAnim.frame).toEqual(0)
		})

		it('should run animation and decrement loop if number', () => {
			var x1 = new Entity()

			spyOn(x1,'animateStop')
			spyOn(global,'setTimeout')

			var anim = [[0,0],[1,1]]
			var runAnim = { name:'testanim', delay: 145, frame: 1, loop: 4 }
			
			x1.addAnimation('testanim',anim)

			x1._currentanimation = runAnim
			x1.animateStart()

			expect(x1.animateStop).not.toHaveBeenCalled()
			expect(global.setTimeout).toHaveBeenCalledWith(jasmine.any(Function), 145)
			expect(runAnim.frame).toEqual(0)
			expect(runAnim.loop).toEqual(3)
		})
	})

	describe('addAnimation', () => {
		it('should set _animations with name and animation', () => {
			var x1 = new Entity()
			
			x1.addAnimation('NAME','ANIMATION')
			expect(x1._animations['NAME']).toEqual('ANIMATION')
		})
	})

	describe('animateStop', () => {
		it('should return immediately if _currentanimation is not set', () => {
			spyOn(global,'setTimeout')

			var x1 = new Entity()
			
			x1.animateStop()
			expect(global.setTimeout).not.toHaveBeenCalled()
		})

		it('should clear _currentanimation if it is set and call redraw()', () => {
			spyOn(global,'setTimeout')

			var x1 = new Entity()
			x1._currentanimation = { 1:2 }
			
			x1.animateStop()
			expect(global.setTimeout).not.toHaveBeenCalled()
			expect(x1._currentanimation).toBeNull()
		})

		it('should call clearTimeout if _timeout set on _currentanimation', () => {
			spyOn(global,'clearTimeout')

			var x1 = new Entity()
			x1._currentanimation = { _timeout: 'TIMEOUTFN' }
			
			x1.animateStop()
			expect(global.clearTimeout).toHaveBeenCalledWith('TIMEOUTFN')
			expect(x1._currentanimation).toBeNull()
		})

		it('should set tile if stopTile is defined on _currentanimation', () => {
			spyOn(global,'clearTimeout')

			var x1 = new Entity()
			x1._currentanimation = { stopTile: [5,5] }
			
			x1.animateStop()
			expect(x1.tile).toEqual([5,5])
		})

		it('should call setImmediate if _currentanimation.onStop is set, callback should call correctly', () => {
			var fn
			spyOn(global,'setImmediate').and.callFake( f => fn=f )

			var x1 = new Entity()
			var cb = { callback: ()=>{} }
			spyOn(cb,'callback')
			x1._currentanimation = { onStop: cb.callback }
			
			x1.animateStop()
			expect(global.setImmediate).toHaveBeenCalledWith(jasmine.any(Function))

			fn()

			expect(cb.callback).toHaveBeenCalledWith(null, x1, Entity.STOPSTATUS_STOPPED)
		})

		it('should call callback correctly with a different stop status', () => {
			var fn
			spyOn(global,'setImmediate').and.callFake( f => fn=f )

			var x1 = new Entity()
			var cb = { callback: ()=>{} }
			spyOn(cb,'callback')
			x1._currentanimation = { onStop: cb.callback }
			
			x1.animateStop(Entity.STOPSTATUS_REPLACED)
			expect(global.setImmediate).toHaveBeenCalledWith(jasmine.any(Function))

			fn()

			expect(cb.callback).toHaveBeenCalledWith(null, x1, Entity.STOPSTATUS_REPLACED)
		})
	})
})
