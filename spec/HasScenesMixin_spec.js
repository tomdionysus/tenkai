const HasScenesMixin = require("../lib/HasScenesMixin")
const ContextMock2D = require("./mocks/ContextMock2D")

describe('HasScenesMixin', () => {
	var x1
	beforeEach(()=>{
		x1 = {} 
		HasScenesMixin(x1)
	})

	describe('init', () => {
		it('should set properties on object', ()=>{
			expect(x1._scenes).toEqual({})
			expect(x1._sceneOrder).toBeNull()
			expect(x1._sceneOrderMap).toBeNull()
		})
	})

	describe('addScene', () => {
		it('should add scene with name to _scenes and set parent on scene', ()=>{
			var ent = { scene: 'SCENE' }

			x1.addScene('NAME',ent)

			expect(x1._scenes['NAME']).toBe(ent)
			expect(ent.parent).toBe(x1)
		})

		it('should add scene with name to _scenes', ()=>{
			var ent = { scene: 'SCENE' }

			x1.addScene('NAME',ent)

			expect(x1._scenes['NAME']).toBe(ent)
		})

		it('should call removeScene on scene parent if it is already defined', ()=>{
			var oldcontainer = { removeScene: ()=>{} }
			var ent = { scene: 'SCENE', parent: oldcontainer }

			spyOn(oldcontainer, 'removeScene')

			x1.addScene('NAME',ent)

			expect(oldcontainer.removeScene).toHaveBeenCalledWith('NAME')
		})
	})

	describe('getScene', () => {
		it('should throw if not found in _scenes', ()=>{
			var ent = { scene: 'SCENE' }

			x1._scenes['NAME'] = ent

			expect(()=>{ x1.getScene('OTHERNAME')}).toThrow('Scene not found: OTHERNAME')
		})

		it('should return correct scene if found in _scenes', ()=>{
			var ent = { scene: 'SCENE' }

			x1._scenes['NAME'] = ent

			expect(x1.getScene('NAME')).toBe(ent)
		})
	})

	describe('removeScene', () => {
		it('should delete scene from _scenes', ()=>{
			var ent = { scene: 'SCENE' }

			x1._scenes['NAME'] = ent

			x1.removeScene('NAME')

			expect(x1._scenes['NAME']).toBeUndefined()
		})

		it('should call redraw if defined on container', ()=>{
			x1.redraw = ()=>{}
			spyOn(x1,'redraw')

			x1.removeScene('NAME')

			expect(x1.redraw).toHaveBeenCalledWith()
		})
	})

	describe('drawScenes', () => {
		var context
		beforeEach(()=>{
			context = new ContextMock2D()
		})

		it('should call sortScenesZ if _sceneOrder is not defined', ()=>{
			spyOn(x1,'sortScenesZ').and.callThrough()

			x1.drawScenes(context)

			expect(x1.sortScenesZ).toHaveBeenCalled()
		})

		it('should call draw on all scenes if z is not defined', ()=>{
			x1._sceneOrder = [
				{ scene: 'SCENE1', draw: ()=>{} },
				{ scene: 'SCENE2', draw: ()=>{} },
			]

			spyOn(x1._sceneOrder[0],'draw')
			spyOn(x1._sceneOrder[1],'draw')

			x1.drawScenes(context)

			expect(x1._sceneOrder[0].draw).toHaveBeenCalledWith(context)
			expect(x1._sceneOrder[1].draw).toHaveBeenCalledWith(context)
		})

		it('should call draw on only correct scenes if z is defined', ()=>{
			x1._sceneOrder = []
			x1._sceneOrderMap = {
				1: [
					{ scene: 'SCENE1', draw: ()=>{} },
					{ scene: 'SCENE2', draw: ()=>{} },
				],
				2: [
					{ scene: 'SCENE3', draw: ()=>{} },
					{ scene: 'SCENE4', draw: ()=>{} },
				],
				3: [
					{ scene: 'SCENE5', draw: ()=>{} },
				]
			}

			spyOn(x1._sceneOrderMap[1][0],'draw')
			spyOn(x1._sceneOrderMap[1][1],'draw')
			spyOn(x1._sceneOrderMap[2][0],'draw')
			spyOn(x1._sceneOrderMap[2][1],'draw')
			spyOn(x1._sceneOrderMap[3][0],'draw')

			x1.drawScenes(context, 2)

			expect(x1._sceneOrderMap[1][0].draw).not.toHaveBeenCalled()
			expect(x1._sceneOrderMap[1][1].draw).not.toHaveBeenCalled()
			expect(x1._sceneOrderMap[2][1].draw).toHaveBeenCalledWith(context)
			expect(x1._sceneOrderMap[2][1].draw).toHaveBeenCalledWith(context)
			expect(x1._sceneOrderMap[3][0].draw).not.toHaveBeenCalled()
		})
	})

	describe('getScenesAtLayer', () => {
		it('should call sortScenesZ if _sceneOrder is not defined', ()=>{
			spyOn(x1,'sortScenesZ').and.callThrough()

			x1.getScenesAtLayer(0)

			expect(x1.sortScenesZ).toHaveBeenCalled()
		})

		it('should not call sortScenesZ if _sceneOrder is defined', ()=>{
			spyOn(x1,'sortScenesZ')

			x1._sceneOrder = {}
			x1._sceneOrderMap = {}
			x1.getScenesAtLayer(0)

			expect(x1.sortScenesZ).not.toHaveBeenCalled()
		})

		it('should return correct map', ()=>{
			x1._sceneOrder = {}
			x1._sceneOrderMap = { 0: [1,2,3], 1:[4,5,6] }
			

			expect(x1.getScenesAtLayer(1)).toEqual([4,5,6])
		})
	})

	describe('sortScenesZ', () => {
		it('should set _sceneOrder and _sceneOrderMap to correct values ', ()=>{
			var ent1 = { scene: 'SCENE1', redraw: ()=>{}, z: 22 }
			var ent2 = { scene: 'SCENE2', redraw: ()=>{}, z: 0 }
			var ent3 = { scene: 'SCENE3', redraw: ()=>{}, z: 4 }
			var ent4 = { scene: 'SCENE4', redraw: ()=>{}, z: 2 }
			var ent5 = { scene: 'SCENE5', redraw: ()=>{}, z: 2 }

			x1._scenes['NAME1'] = ent1
			x1._scenes['NAME2'] = ent2
			x1._scenes['NAME3'] = ent3
			x1._scenes['NAME4'] = ent4
			x1._scenes['NAME5'] = ent5

			x1.sortScenesZ()

			expect(x1._sceneOrder).toEqual([ent2,ent4,ent5,ent3,ent1])
			expect(x1._sceneOrderMap).toEqual({
				2: [ ent4, ent5 ],
				22: [ ent1 ],
				0: [ ent2 ],
				4: [ ent3 ],
			})
		})
	})

	describe('redrawScenes', () => {
		it('should call redraw on all _scenes', ()=>{
			var ent1 = { scene: 'SCENE1', redraw: ()=>{} }
			var ent2 = { scene: 'SCENE2', redraw: ()=>{} }

			x1._scenes['NAME1'] = ent1
			x1._scenes['NAME2'] = ent2
			spyOn(ent1,'redraw')
			spyOn(ent2,'redraw')

			x1.redrawScenes('NAME')

			expect(ent1.redraw).toHaveBeenCalledWith()
			expect(ent2.redraw).toHaveBeenCalledWith()
		})
	})
})