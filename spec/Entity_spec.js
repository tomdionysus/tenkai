const Entity = require("../lib/Entity")

describe('Entity', () => {
	it('should allow New', () => {
		var x1 = new Entity()
		var x2 = new Entity()

		expect(x1).not.toBe(x2)
	})
})
