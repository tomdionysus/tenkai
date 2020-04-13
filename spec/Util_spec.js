const Util = require("../lib/Util")

describe('intersects', () => {
	it('should return true when rectangles intersect, case 1', () => {
		var r1 = [1,1,6,6]
		var r2 = [3,3,8,8]
		expect(Util.intersects(r1,r2)).toBeTruthy()
	})
}) 