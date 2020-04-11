const Asset = require("../lib/Asset")

describe('Asset', () => {
	it('should allow New', () => {
		var x1 = new Asset()
		var x2 = new Asset()

		expect(x1).not.toBe(x2)
	})

	describe('load', () => {
		it('should call createElement', () => {

			var ele = { }

			spyOn(document,'createElement').and.returnValue(ele)
			var x1 = new Asset({ src: 'SOURCE' })

			x1.load()

			expect(document.createElement).toHaveBeenCalledWith('img')
			expect(x1.element).toBe(ele)
			expect(ele.src).toEqual('SOURCE')
		})

		it('should call callback', () => {
			var ele = { }
			var cb = { cb: ()=>{} }
			spyOn(document,'createElement').and.returnValue(ele)
			spyOn(cb,'cb')

			var x1 = new Asset({ src: 'SOURCE' })
			
			x1.load(cb.cb)
			ele.onload({ returnValue: true })

			expect(cb.cb).toHaveBeenCalledWith(null, x1)
		})

		it('should call callback with error', () => {
			var ele = { }
			var cb = { cb: ()=>{} }
			spyOn(document,'createElement').and.returnValue(ele)
			spyOn(cb,'cb')

			var x1 = new Asset({ src: 'SOURCE' })
			
			x1.load(cb.cb)
			ele.onload({ returnValue: false })

			expect(cb.cb).toHaveBeenCalledWith(false, x1)
		})
	})
})
