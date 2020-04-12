const HasEventsMixin = require('../lib/HasEventsMixin')

describe('HasEventsMixin', () => {
	var x1
	beforeEach(()=>{
		x1 = {} 
		HasEventsMixin(x1)
	})

	describe('init', () => {
		it('should set properties on object', ()=>{
			expect(x1._events).toEqual({})
		})
	})

	describe('unon', () => {
		it('should throw on bad event', () => {
			expect(function(){x1.unon('bad',()=>{})}).toThrow('unon: no such event bad')
		})

		it('should not remove unknown handler', () => {
			x1.defineEvent('test')

			var cb = { callback: ()=>{}, callback2: ()=>{} }
			spyOn(cb,'callback')
			
			x1.on('test',cb.callback)
			x1.unon('test',cb.callback2)

			x1.trigger('test',{ one:1 },4,3)
			setImmediate(()=>{ expect(cb.callback).toHaveBeenCalledWith({ one: 1 },4,3) })
		})

		it('should correctly remove valid event', () => {
			x1.defineEvent('test')

			var cb = { callback: ()=>{} }
			spyOn(cb,'callback')
			
			x1.on('test',cb.callback)
			x1.unon('test',cb.callback)

			x1.trigger('test',{ one:1 })
			setImmediate(()=>{ expect(cb.callback).not.toHaveBeenCalled() })
		})
	})

	describe('defineEvents', () => {
		it('should add events', () => {
			x1.defineEvents(['test','test2'])
			expect(x1._events).toEqual({ test: [], test2: [] })
		})
	})

	describe('undefineEvents', () => {
		it('should remove events', () => {
			x1.defineEvent('test')
			x1.defineEvent('test2')
			x1.undefineEvents(['test'])
			expect(x1._events).toEqual({ test2: [] })
		})
	})

	describe('addEventListener', () => {
		it('should call on', () => {
			spyOn(x1,'on')

			var cb = { callback: ()=>{} }

			x1.addEventListener('test',cb.callback)
			expect(x1.on).toHaveBeenCalledWith('test',cb.callback)
		})
	})

	describe('removeEventListener', () => {
		it('should call on', () => {
			spyOn(x1,'unon')

			var cb = { callback: ()=>{} }

			x1.removeEventListener('test',cb.callback)
			expect(x1.unon).toHaveBeenCalledWith('test',cb.callback)
		})
	})

	describe('trigger', () => {
		it('should throw on bad event', () => {
			expect(function(){x1.trigger('bad')}).toThrow('trigger: no such event bad')
		})

		it('should call valid event', () => {
			x1.defineEvent('test')

			var cb = { callback: ()=>{} }
			spyOn(cb,'callback')
			
			x1.on('test',cb.callback)

			x1.trigger('test',{ one:1 },2)
			setImmediate(()=>{ expect(cb.callback).toHaveBeenCalledWith({ one: 1 },2) })
		})
	})


	describe('trigger', () => {
		it('should not throw on ok event that is not defined', () => {
			x1.defineEvent('item')
			expect(function(){x1.trigger('item')}).not.toThrow()
		})
	})

	describe('getEventListeners', () => {
		it('should throw on bad event', () => {
			expect(function(){x1.getEventListeners('bad')}).toThrow('getEventListeners: no such event bad')
		})

		it('should return handlers as an array', () => {
			x1.defineEvent('test')
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