const Evented = require('../lib/Evented')

describe('Evented', () => {
	it('should allow New', () => {
		var x1 = new Evented({})
		var x2 = new Evented({})

		expect(x1).not.toBe(x2)
	})

	describe('on', () => {
		it('should throw on bad event', () => {
			var x1 = new Evented()
			expect(function(){x1.on('bad')}).toThrow('on: no such event bad')
		})
	})

	describe('unon', () => {
		it('should throw on bad event', () => {
			var x1 = new Evented()
			expect(function(){x1.unon('bad',()=>{})}).toThrow('unon: no such event bad')
		})

		it('should not remove alien handler', () => {
			var x1 = new Evented()
			x1.addEvent('test')

			var cb = { callback: ()=>{}, callback2: ()=>{} }
			spyOn(cb,'callback')
			
			x1.on('test',cb.callback)

			x1.unon('test',cb.callback2)

			x1.trigger('test',{ one:1 },4,3)
			expect(cb.callback).toHaveBeenCalledWith({ one: 1 },4,3)
		})

		it('should correctly remove valid event', () => {
			var x1 = new Evented()
			x1.addEvent('test')

			var cb = { callback: ()=>{} }
			spyOn(cb,'callback')
			
			x1.on('test',cb.callback)

			x1.unon('test',cb.callback)

			x1.trigger('test',{ one:1 })
			expect(cb.callback).not.toHaveBeenCalled()
		})
	})

	describe('addEvents', () => {
		it('should add events', () => {
			var x1 = new Evented()
			x1.addEvents(['test','test2'])
			expect(x1._events).toEqual({ test: [], test2: [] })
		})
	})

	describe('removeEvents', () => {
		it('should remove events', () => {
			var x1 = new Evented()
			x1.addEvent('test')
			x1.addEvent('test2')
			x1.removeEvents(['test'])
			expect(x1._events).toEqual({ test2: [] })
		})
	})

	describe('addEventListener', () => {
		it('should call on', () => {
			var x1 = new Evented()
			spyOn(x1,'on')

			var cb = { callback: ()=>{} }

			x1.addEventListener('test',cb.callback)
			expect(x1.on).toHaveBeenCalledWith('test',cb.callback)
		})
	})

	describe('removeEventListener', () => {
		it('should call on', () => {
			var x1 = new Evented()
			spyOn(x1,'unon')

			var cb = { callback: ()=>{} }

			x1.removeEventListener('test',cb.callback)
			expect(x1.unon).toHaveBeenCalledWith('test',cb.callback)
		})
	})

	describe('trigger', () => {
		it('should throw on bad event', () => {
			var x1 = new Evented()
			expect(function(){x1.trigger('bad')}).toThrow('trigger: no such event bad')
		})

		it('should call valid event', () => {
			var x1 = new Evented()
			x1.addEvent('test')

			var cb = { callback: ()=>{} }
			spyOn(cb,'callback')
			
			x1.on('test',cb.callback)

			x1.trigger('test',{ one:1 },2)
			expect(cb.callback).toHaveBeenCalledWith({ one: 1 },2)
		})
	})


	describe('trigger', () => {
		it('should not throw on ok event that is not defined', () => {
			var x1 = new Evented()
			x1.addEvent('item')
			expect(function(){x1.trigger('item')}).not.toThrow()
		})
	})

	describe('getEventListeners', () => {
		it('should throw on bad event', () => {
			var x1 = new Evented()
			expect(function(){x1.getEventListeners('bad')}).toThrow('getEventListeners: no such event bad')
		})

		it('should return handlers as an array', () => {
			var x1 = new Evented()
			x1.addEvent('test')
			var cb = { 
				callback1() {},
				callback2() {},
			}
			x1.on('test',cb.callback1)
			x1.on('test',cb.callback2)
			expect(x1.getEventListeners('test')).toEqual([ cb.callback1, cb.callback2 ])
		})
	})
})