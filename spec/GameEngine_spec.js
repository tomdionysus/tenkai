const GameEngine = require("../lib/GameEngine")

describe('Entity', () => {
	it('should allow New', () => {
		var x1 = new GameEngine()
		var x2 = new GameEngine()

		expect(x1).not.toBe(x2)
	})

	it('should have correct mixins', () => {
		var x1 = new GameEngine()

		expect(x1._events).not.toBeUndefined()
		expect(x1._scenes).not.toBeUndefined()
		expect(x1._entities).not.toBeUndefined()
	})

	it('should use option defaults', () => {
		var options = {
			targetId: 'targetId',
			fullscreen: 'fullscreen',
			showHUD: 'showHUD',
			scale: 'scale',
			x: 3,
			y: 4,
			maxScale: 5,
			minScale: 6,
			minX: 7,
			minY: 8,
			maxX: 9,
			maxY: 10,
			globalAlpha: 11,
			enableScroll: 'enableScroll',
			enableZoom: 'enableZoom'
		}

		var x1 = new GameEngine(options)

		expect(x1.targetId).toEqual('targetId')
		expect(x1.fullscreen).toBeTruthy()
		expect(x1.showHUD).toBeTruthy()
		expect(x1.scale).toEqual('scale')
		expect(x1.x).toEqual(3)
		expect(x1.y).toEqual(4)
		expect(x1.maxScale).toEqual(5)
		expect(x1.minScale).toEqual(6)
		expect(x1.minX).toEqual(7)
		expect(x1.minY).toEqual(8)
		expect(x1.maxX).toEqual(9)
		expect(x1.maxY).toEqual(10)
		expect(x1.globalAlpha).toEqual(11)
		expect(x1.enableScroll).toBeTruthy()
		expect(x1.enableZoom).toBeTruthy()
	})

	it('should have correct events', () => {
		var x1 = new GameEngine()

		expect(Object(x1._events).keys).toEqual()
	})

	describe('setGlobalAlpha', () => {
		it('should set globalAlpha', () => {
			var x1 = new GameEngine()

			x1.setGlobalAlpha(19)

			expect(x1.globalAlpha).toEqual(19)
		})
	})

	describe('init', () => {
		it('should log debug and call callback', () => {
			var x1 = new GameEngine()
			var cb = generateSpyObject(['callback'])

			spyOn(console,'debug')
			x1.init(cb.callback)

			expect(cb.callback).toHaveBeenCalledWith()
			expect(console.debug).toHaveBeenCalledWith('init')
		})
	})

	describe('stop', () => {
		it('should set running to false', () => {
			var x1 = new GameEngine()

			x1.running = true
			x1.stop()

			expect(x1.running).toBeFalsy()
		})
	})

	describe('addAsset', () => {
		it('should set asset name and src', () => {
			var x1 = new GameEngine()

			x1.addAsset('asset','source')

			expect(x1._assetDefs['asset']).toEqual('source')
		})
	})

	describe('getAsset', () => {
		it('should return asset with name', () => {
			var x1 = new GameEngine()

			x1.assets = {}
			x1.assets['asset'] = 'source'
			
			expect(x1.getAsset('asset')).toEqual('source')

		})

		it('should throw if asset not found', () => {
			var x1 = new GameEngine()

			x1.assets = {}
			x1.assets['asset'] = 'source'

			expect(()=>{x1.getAsset('asset2')}).toThrow('Asset not found: asset2')

		})
	})

	describe('addAudio', () => {
		it('should set audio name, type and src', () => {
			var x1 = new GameEngine()

			x1.addAudio('audio','source','type')

			expect(x1._audioDefs['audio']).toEqual({ src: 'source', type: 'type' })
		})
	})

	describe('getAudio', () => {
		it('should return audio with name', () => {
			var x1 = new GameEngine()

			x1.audio = {}
			x1.audio['audio'] = 'source'
			
			expect(x1.getAudio('audio')).toEqual('source')

		})

		it('should throw if audio not found', () => {
			var x1 = new GameEngine()

			x1.audio = {}
			x1.audio['audio'] = 'source'

			expect(()=>{x1.getAudio('audio2')}).toThrow('Audio not found: audio2')

		})
	})

	describe('redraw', () => {
		it('should set _doredraw and call redrawScenes and redrawEntities', () => {
			var x1 = new GameEngine()

			spyOn(x1,'redrawScenes')
			spyOn(x1,'redrawEntities')
			
			x1.redraw()

			expect(x1._doredraw).toBeTruthy()

			expect(x1.redrawScenes).toHaveBeenCalledWith()
			expect(x1.redrawEntities).toHaveBeenCalledWith()
		})
	})

})
