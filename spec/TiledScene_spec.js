const TiledScene = require("../lib/TiledScene")
const ContextMock2D = require("./mocks/ContextMock2D")

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

	describe('draw', () => {
		var x1, context
		beforeEach(() => {
			x1 = new TiledScene({asset:{element:{width:'WIDTH',height:'HEIGHT'}}})
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

		it('should call context save, tranlate, scale, rotate and _drawLayer with correct values', () => {
			x1.visible = true
			x1._doredraw = true

			x1.x = 4
			x1.y = 5
			x1.scale = 6
			x1.rotate = 7
			x1.layers = { 1: {} }
			spyOn(x1,'_drawLayer')
			
			x1.draw(context)

			expect(context.save).toHaveBeenCalledWith()
			expect(context.translate).toHaveBeenCalledWith(4,5)
			expect(context.scale).toHaveBeenCalledWith(6,6)
			expect(context.rotate).toHaveBeenCalledWith(7)
			expect(context.restore).toHaveBeenCalledWith()
			
			expect(x1._drawLayer).toHaveBeenCalledWith(context, '0')
		})

		it('should reset _doredraw', () => {
			x1.visible = true
			x1._doredraw = true

			x1.draw(context)
			
			expect(x1._doredraw).toBeFalsy()
		})
	})

	describe('_drawLayer', () => {
		var x1, context, ele
		beforeEach(() => {
			ele = {width:'WIDTH',height:'HEIGHT'}
			x1 = new TiledScene({asset:{element:ele}})
			context = new ContextMock2D()
		})

		it('should not call drawImage if layer does not exist', () => {
			x1.visible = true
			x1._doredraw = true

			x1.tileWidth = 16
			x1.tileHeight = 32

			x1.x = 4
			x1.y = 5
			x1.scale = 6
			x1.rotate = 7
			x1.layers = { 1: [ [ [0,1],[1,1],[2,1],null ], [] ] }
			
			x1._drawLayer(context, 2)

			expect(context.drawImage).not.toHaveBeenCalled()
		})

		it('should call drawImage repeatedly with correct values', () => {
			x1.visible = true
			x1._doredraw = true

			x1.tileWidth = 16
			x1.tileHeight = 32

			x1.x = 4
			x1.y = 5
			x1.scale = 6
			x1.rotate = 7
			x1.layers = { 1: [ [ [0,1],[1,1],[2,1],null ], [] ] }
			
			x1._drawLayer(context, 1)

			expect(context.drawImage).toHaveBeenCalledWith(ele, 0, 32, 16, 32, 0, 0, 16, 32)
			expect(context.drawImage).toHaveBeenCalledWith(ele, 16, 32, 16, 32, 16, 0, 16, 32)
			expect(context.drawImage).toHaveBeenCalledWith(ele, 32, 32, 16, 32, 32, 0, 16, 32)
		})

		it('should call getEntitiesAtLayer and process perspective if mode is PERSPECTIVE_ANGLE', () => {
			x1.visible = true
			x1._doredraw = true
			x1.perspectiveMode = TiledScene.PERSPECTIVE_ANGLE

			x1.tileWidth = 16
			x1.tileHeight = 32

			x1.x = 4
			x1.y = 5
			x1.scale = 6
			x1.rotate = 7
			x1.layers = { 1: [ [ [0,1],[1,1],[2,1],null ], [] ] }

			var entity = {
				x: 2,
				y: 3,
				hotspotX: 4,
				hotspotY: 5,
				draw: ()=>{}
			}

			spyOn(entity,'draw')

			spyOn(x1,'getEntitiesAtLayer').and.returnValue([
				 entity
			])
			
			x1._drawLayer(context, 1)

			expect(context.drawImage).toHaveBeenCalledWith(ele, 0, 32, 16, 32, 0, 0, 16, 32)
			expect(context.drawImage).toHaveBeenCalledWith(ele, 16, 32, 16, 32, 16, 0, 16, 32)
			expect(context.drawImage).toHaveBeenCalledWith(ele, 32, 32, 16, 32, 32, 0, 16, 32)
			expect(x1.getEntitiesAtLayer).toHaveBeenCalledWith(1)

			expect(entity.draw).toHaveBeenCalledWith(context)
		})
	})
})