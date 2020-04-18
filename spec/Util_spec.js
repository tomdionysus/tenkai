const Util = require("../lib/Util")

describe('intersects', () => {
	it('should return true when rectangles intersect, case 1', () => {
		var r1 = [1,1,4,4]
		var r2 = [3,3,7,7]
		expect(Util.intersects(r1,r2)).toBeTruthy()
	})

	it('should return true when rectangles intersect, case 2', () => {
		var r1 = [1,3,4,7]
		var r2 = [3,1,7,4]
		expect(Util.intersects(r1,r2)).toBeTruthy()
	})

	it('should return false when rectangles do not intersect, case 2', () => {
		var r1 = [1,1,4,4]
		var r2 = [5,5,9,9]
		expect(Util.intersects(r1,r2)).toBeFalsy()
	})
}) 

describe('bounding', () => {
	it('should return bounding box for both rectangles case 1', () => {
		var r1 = [1,1,4,4]
		var r2 = [3,3,7,7]
		expect(Util.bounding(r1,r2)).toEqual([1,1,7,7])
	})

	it('should return bounding box for both rectangles case 2', () => {
		var r1 = [1,3,4,7]
		var r2 = [3,1,7,4]
		expect(Util.bounding(r1,r2)).toEqual([1,1,7,7])
	})
}) 

describe('sortBy', () => {
	it('should sort objects by property', () => {
		var r1 = { o: 5 }
		var r2 = { o: 1 }
		var r3 = { o: -1 }
		var r4 = { o: 6 }
		expect(Util.sortBy([r1,r2,r3,r4],'o')).toEqual([r3,r2,r1,r4])
	})
})

describe('delay', () => {
	it('should sort objects by property', () => {
		var cb = generateSpyObject(['callback']), f

		spyOn(global,'setTimeout').and.callFake((fn)=>{f=fn})

		Util.delay(cb.callback, 10, 1, 2, 'THREE')

		expect(global.setTimeout).toHaveBeenCalledWith(jasmine.any(Function),10)

		f()

		expect(cb.callback).toHaveBeenCalledWith(1, 2, 'THREE')
	})
})

describe('debounce', () => {
	it('should set up functions correctly', () => {
		var cb = generateSpyObject(['callback']), f, ff

		spyOn(Util,'delay').and.callFake((fn,w,t,a)=>{ ff=fn })

		var fn2 = Util.debounce(cb.callback, 10)

		expect(fn2).toEqual(jasmine.any(Function))

		fn2()
		ff()

		expect(Util.delay).toHaveBeenCalledWith(jasmine.any(Function), 10, undefined, undefined )
	})

	it('should not call if cancelled', () => {
		var cb = generateSpyObject(['callback']), f, ff

		spyOn(Util,'delay').and.callFake((fn)=>{ff=fn})

		var fn2 = Util.debounce(cb.callback, 10)

		expect(fn2).toEqual(jasmine.any(Function))

		fn2.cancel()
		fn2()

		expect(Util.delay).toHaveBeenCalledWith(jasmine.any(Function), 10, undefined, undefined )
		expect(cb.callback).not.toHaveBeenCalled()
	})
}) 