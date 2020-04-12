const Audio = require("../lib/Audio")

describe('Audio', () => {
	it('should allow New', () => {
		var x1 = new Audio()
		var x2 = new Audio()

		expect(x1).not.toBe(x2)
	})

	describe('load', () => {
		it('should call createElement and appendChild and set options', () => {
			var ele = { appendChild: ()=>{} }

			spyOn(document,'createElement').and.returnValue(ele)
			spyOn(ele,'appendChild')
			var x1 = new Audio({ 
				src: 'SOURCE', 
				type: 'TYPE',
				startTime: 'STARTTIME',
				endTime: 'ENDTIME',
				loop: true
			})

			x1.load()

			expect(document.createElement).toHaveBeenCalledWith('audio')
			expect(ele.appendChild).toHaveBeenCalledWith(ele)

			expect(x1.element).toBe(ele)

			expect(ele.src).toEqual('SOURCE')
			expect(ele.type).toEqual('TYPE')

			expect(x1.startTime).toEqual('STARTTIME')
			expect(x1.endTime).toEqual('ENDTIME')
			expect(x1.loop).toBeTruthy()
		})
	})

	describe('play', () => {
		it('should call play on element', () => {
			var ele = { play: ()=>{} }
			spyOn(ele,'play')

			var x1 = new Audio()
			x1.element = ele
			x1.play()

			expect(ele.play).toHaveBeenCalledWith()
		})
	})

	describe('playRange', () => {
		it('should set properties and call play on element', () => {
			var ele = { play: ()=>{} }
			spyOn(ele,'play')

			var x1 = new Audio()
			x1.element = ele
			x1.playRange('STARTTIME','ENDTIME',false)

			expect(ele.play).toHaveBeenCalledWith()
			expect(x1.startTime).toEqual('STARTTIME')
			expect(x1.endTime).toEqual('ENDTIME')
			expect(x1.loop).toBeFalsy()
		})

		it('should use existing properties call play on element', () => {
			var ele = { play: ()=>{} }
			spyOn(ele,'play')

			var x1 = new Audio()
			x1.element = ele
			x1.playRange(null,null,true)

			expect(ele.play).toHaveBeenCalledWith()
			expect(x1.startTime).toBeUndefined()
			expect(x1.endTime).toBeUndefined()
			expect(x1.loop).toBeTruthy()
		})
	})

	describe('pause', () => {
		it('should call pause on element', () => {
			var ele = { pause: ()=>{} }
			spyOn(ele,'pause')

			var x1 = new Audio()
			x1.element = ele
			x1.pause()

			expect(ele.pause).toHaveBeenCalledWith()
		})
	})

	describe('stop', () => {
		it('should reset oncanplaythrough and currentTime and call pause on element', () => {
			var ele = { pause: ()=>{} }
			spyOn(ele,'pause')

			var x1 = new Audio()
			x1.element = ele
			x1.stop()

			expect(ele.pause).toHaveBeenCalledWith()
			expect(ele.oncanplaythrough).toBeNull()
			expect(ele.currentTime).toEqual('0')

		})
	})

	describe('fadeIn', () => {
		it('should set volume and call play on element, then call _fade', () => {
			var ele = { play: ()=>{} }
			spyOn(ele,'play')

			var x1 = new Audio()
			x1.element = ele
			spyOn(x1,'_fade').and.callFake(function(v, d, c) { c() })

			x1.fadeIn()

			expect(ele.play).toHaveBeenCalledWith()
			expect(ele.volume).toEqual(0)

			expect(x1._fade).toHaveBeenCalledWith(1,1000,jasmine.any(Function))

		})

		it('should call supplied callback ', () => {
			var ele = { play: ()=>{} }
			var x1 = new Audio()
			x1.element = ele

			var cb = { cb: ()=>{} }
			spyOn(cb,'cb')

			spyOn(x1,'_fade').and.callFake(function(v, d, c) { c() })

			x1.fadeIn(200, cb.cb)

			expect(cb.cb).toHaveBeenCalledWith(null, x1)
		})
	})

	describe('fadeOut', () => {
		it('should set volume and call play on element, then call _fade', () => {
			var x1 = new Audio()
			spyOn(x1,'_fade')

			x1.fadeOut()

			expect(x1._fade).toHaveBeenCalledWith(0,1000,jasmine.any(Function))
		})

		it('should call _fade and pause', () => {
			var x1 = new Audio()
			spyOn(x1,'_fade').and.callFake(function(v, d, c) { c() })
			spyOn(x1,'pause')

			x1.fadeOut()

			expect(x1._fade).toHaveBeenCalledWith(0,1000,jasmine.any(Function))
			expect(x1.pause).toHaveBeenCalledWith()
		})


		it('should call _fade and pause and callback', () => {
			var x1 = new Audio()
			spyOn(x1,'_fade').and.callFake(function(v, d, c) { c() })
			spyOn(x1,'pause')

			var cb = { cb: ()=>{} }
			spyOn(cb,'cb')

			x1.fadeOut(500, cb.cb)

			expect(x1._fade).toHaveBeenCalledWith(0,500,jasmine.any(Function))
			expect(x1.pause).toHaveBeenCalledWith()
		})
	})
})