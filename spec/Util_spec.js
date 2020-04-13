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