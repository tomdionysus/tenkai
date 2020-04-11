const Scene = require("../lib/Scene")
const ContextMock2D = require("./mocks/ContextMock2D")

describe('Scene', () => {
	it('should allow New', () => {
		var x1 = new Scene()
		var x2 = new Scene()

		expect(x1).not.toBe(x2)
	})

	it('should have the correct defaults', () => {
		var x1 = new Scene()

		expect(x1.x).toEqual(0)
		expect(x1.y).toEqual(0)
		expect(x1.z).toEqual(0)
		expect(x1.parent).toBeNull()
		expect(x1.visible).toBeTruthy()
		expect(x1.scale).toEqual(1)
		expect(x1.rotate).toEqual(0)
	})

	it('should load options', () => {
		var x1 = new Scene({
			asset: 'ASSET',
			x: 'X',
			y: 'Y',
			z: 'Z',
			parent: 'PARENT',
			visible: false,
			scale: 'SCALE',
			rotate: 'ROTATE',
		})

		expect(x1.asset).toEqual('ASSET')
		expect(x1.x).toEqual('X')
		expect(x1.y).toEqual('Y')
		expect(x1.z).toEqual('Z')
		expect(x1.parent).toEqual('PARENT')
		expect(x1.visible).toBeFalsy()
		expect(x1.scale).toEqual('SCALE')
		expect(x1.rotate).toEqual('ROTATE')
	})

	describe('draw', () => {
		var x1, context
		beforeEach(() => {
			x1 = new Scene({asset:{element:{width:'WIDTH',height:'HEIGHT'}}})
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