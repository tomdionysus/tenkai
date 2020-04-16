const BackgroundScene = require("../lib/BackgroundScene")
const ContextMock2D = require("./mocks/ContextMock2D")

describe('BackgroundScene', () => {
	it('should allow New', () => {
		var x1 = new BackgroundScene()
		var x2 = new BackgroundScene()

		expect(x1).not.toBe(x2)
	})

	it('should take defaults from the asset', () => {
		var x1 = new BackgroundScene({asset:{element:{width:'WIDTH',height:'HEIGHT'}}})

		expect(x1.width).toEqual('WIDTH')
		expect(x1.height).toEqual('HEIGHT')
	})

	describe('draw', () => {
		var x1, context
		beforeEach(() => {
			x1 = new BackgroundScene({asset:{element:{width:'WIDTH',height:'HEIGHT'}}})
			context = new ContextMock2D()
		})

		it('should return immediately if _doredraw is false', () => {
			x1.visible = true
			x1._doredraw = false
			x1.draw(context)
			expect(context.save).not.toHaveBeenCalled()
		})

		it('should return immediately if visible is false', () => {
			x1.visible = false
			x1._doredraw = true
			x1.draw(context)
			expect(context.save).not.toHaveBeenCalled()
		})

		it('should not call sortScenesZ if _sceneOrderMap is set', () => {
			spyOn(x1,'sortScenesZ')
			spyOn(x1,'drawScenes')
			x1._sceneOrderMap = {}
			x1.draw(context)

			expect(x1.sortScenesZ).not.toHaveBeenCalled()
		})

		it('should not call sortEntitiesZ if _entityOrderMap is set', () => {
			spyOn(x1,'sortEntitiesZ')
			spyOn(x1,'drawEntities')
			x1._entityOrderMap = {}
			x1.draw(context)

			expect(x1.sortEntitiesZ).not.toHaveBeenCalled()
		})

		it('should call context save, tranlate, scale, rotate with correct values', () => {
			x1.visible = true
			x1._doredraw = true

			x1.x = 4
			x1.y = 5
			x1.scale = 6
			x1.rotate = 7
			
			x1.draw(context)

			expect(context.save).toHaveBeenCalledWith()
			expect(context.translate).toHaveBeenCalledWith(4,5)
			expect(context.scale).toHaveBeenCalledWith(6,6)
			expect(context.rotate).toHaveBeenCalledWith(7)
			expect(context.drawImage).toHaveBeenCalledWith(x1.asset.element, 0, 0, 'WIDTH', 'HEIGHT', 0, 0, 'WIDTH', 'HEIGHT')
			expect(context.restore).toHaveBeenCalledWith()
		})

		it('should reset _doredraw', () => {
			x1.visible = true
			x1._doredraw = true

			x1.draw(context)
			
			expect(x1._doredraw).toBeFalsy()
		})
	})
})
