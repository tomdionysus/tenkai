const TiledScene = require("../lib/TiledScene")

describe('TiledScene', () => {
	it('should allow New', () => {
		var x1 = new TiledScene()
		var x2 = new TiledScene()

		expect(x1).not.toBe(x2)
	})

	it('should have the correct defaults', () => {
		var x1 = new TiledScene()

		expect(x1.tileWidth).toEqual(32)
		expect(x1.tileHeight).toEqual(32)
		expect(x1.perspectiveMode).toEqual(TiledScene.PERSPECTIVE_OVERHEAD)
		expect(x1._doredraw).toBeTruthy()
	})
})