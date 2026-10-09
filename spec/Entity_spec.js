const Entity = require('../lib/Entity')
const Sheet = require('../lib/Sheet')
const Scene = require('../lib/Scene')
const ContextMock2D = require('./mocks/ContextMock2D')

describe('Entity', () => {
  var image, sheet
  beforeEach(() => {
    image = { width: 256, height: 128 }
    sheet = new Sheet({
      image,
      tileWidth: 32,
      tileHeight: 32,
      anchor: [16, 30],
      clips: {
        walk: { row: 1, columns: [0, 1, 2, 3], delay: 100, loop: true },
        die: { row: 2, count: 3, delay: 100 },
        flash: { frames: [[0, 3], [1, 3, 0], [2, 3]], delay: 50 }
      }
    })
  })

  describe('construction', () => {
    it('should use defaults', () => {
      var e = new Entity()
      expect([e.x, e.y, e.z, e.elevation, e.scale, e.rotate]).toEqual([0, 0, 0, 0, 1, 0])
      expect(e.visible).toBe(true)
      expect(e.flipX).toBe(false)
      expect(e.sheet).toBeNull()
      expect(e.tile).toBeNull()
      expect(e.animating).toBe(false)
    })

    it('should show the first tile of a sheet, with the sheet anchor', () => {
      var e = new Entity({ sheet })
      expect(e.tile).toEqual([0, 0])
      expect(e.origin).toEqual([16, 30])
      expect([e.width, e.height]).toEqual([32, 32])
    })

    it('should let its own anchor replace the sheet anchor', () => {
      expect(new Entity({ sheet, anchor: [0, 0] }).origin).toEqual([0, 0])
    })

    it('should make a sheet from a single image', () => {
      var e = new Entity({ image: { element: { width: 40, height: 20 } } })
      expect([e.width, e.height]).toEqual([40, 20])
      expect(e.origin).toEqual([0, 0])
    })

    it('should find the game through its parents', () => {
      var game = { isGameEngine: true }
      var scene = new Scene()
      scene.parent = game
      var e = new Entity()
      var child = new Entity()
      scene.addEntity('e', e)
      e.addEntity('child', child)
      expect(child.game).toBe(game)
      expect(new Entity().game).toBeNull()
    })
  })

  describe('draw', () => {
    var context
    beforeEach(() => { context = new ContextMock2D() })

    it('should draw its tile with the anchor at its position, raised by its elevation', () => {
      var e = new Entity({ sheet, tile: [2, 1], x: 100, y: 50, elevation: 8 })
      e.draw(context)
      expect(context.translate).toHaveBeenCalledWith(100, 42)
      expect(context.drawImage).toHaveBeenCalledWith(image, 64, 32, 32, 32, -16, -30, 32, 32)
    })

    it('should scale, rotate and flip about the anchor', () => {
      var e = new Entity({ sheet, scale: 2, rotate: 1, flipX: true })
      e.draw(context)
      expect(context.scale).toHaveBeenCalledWith(2, 2)
      expect(context.rotate).toHaveBeenCalledWith(1)
      expect(context.scale).toHaveBeenCalledWith(-1, 1)
    })

    it('should use the sheet offset and spacing', () => {
      var spaced = new Sheet({ image, tileWidth: 32, tileHeight: 32, offsetX: 1, offsetY: 2, spacing: 3 })
      new Entity({ sheet: spaced, tile: [2, 1] }).draw(context)
      expect(context.drawImage).toHaveBeenCalledWith(image, 71, 37, 32, 32, 0, 0, 32, 32)
    })

    it('should draw children relative to its position, after itself', () => {
      var e = new Entity({ sheet })
      var child = new Entity()
      spyOn(child, 'draw')
      e.addEntity('child', child)
      e.draw(context)
      expect(child.draw).toHaveBeenCalledWith(context)
    })

    it('should draw nothing when invisible', () => {
      new Entity({ sheet, visible: false }).draw(context)
      expect(context.save).not.toHaveBeenCalled()
    })
  })

  describe('animation', () => {
    var e
    beforeEach(() => { e = new Entity({ sheet }) })

    it('should show the first frame of a clip at once', () => {
      e.play('walk')
      expect(e.tile).toEqual([0, 1])
      expect(e.clip).toBe(sheet.clips.walk)
      expect(e.animating).toBe(true)
    })

    it('should show each frame for its delay of game time', () => {
      e.play('walk')
      e.animate(99)
      expect(e.tile).toEqual([0, 1])
      e.animate(1)
      expect(e.tile).toEqual([1, 1])
    })

    it('should carry over time, catching up several frames at once', () => {
      e.play('walk')
      e.animate(250)
      expect(e.frame).toEqual(2)
      e.animate(50)
      expect(e.frame).toEqual(3)
    })

    it('should loop a looping clip', () => {
      e.play('walk')
      e.animate(400)
      expect(e.frame).toEqual(0)
      expect(e.animating).toBe(true)
    })

    it('should hold the last frame of a clip for its delay, then complete', () => {
      var complete = jasmine.createSpy('onComplete')
      e.play('die', { onComplete: complete })
      e.animate(200)
      expect(e.tile).toEqual([2, 2])
      e.animate(99)
      expect(complete).not.toHaveBeenCalled()
      e.animate(1)
      expect(complete).toHaveBeenCalledWith(e)
      expect(e.done).toBe(true)
      expect(e.animating).toBe(false)
      expect(e.tile).toEqual([2, 2])
    })

    it('should use a frame delay over the clip delay, and show a frame with delay 0 for one step', () => {
      e.play('flash')
      e.animate(50)
      expect(e.tile).toEqual([1, 3])
      e.animate(1)
      expect(e.tile).toEqual([2, 3])
    })

    it('should keep playing a clip that is asked for again, unless restarted', () => {
      e.play('walk')
      e.animate(150)
      e.play('walk')
      expect(e.frame).toEqual(1)
      e.play('walk', { restart: true })
      expect(e.frame).toEqual(0)
    })

    it('should scale delays by speed, and hold the frame at speed 0', () => {
      e.play('walk', { speed: 2 })
      e.animate(50)
      expect(e.frame).toEqual(1)
      e.play('walk', { speed: 0 })
      e.animate(1000)
      expect(e.frame).toEqual(1)
    })

    it('should let a play override whether the clip loops', () => {
      e.play('walk', { loop: false })
      e.animate(400)
      expect(e.done).toBe(true)
      e.play('die', { loop: true })
      e.animate(300)
      expect(e.animating).toBe(true)
      expect(e.frame).toEqual(0)
    })

    it('should show a chosen frame with setFrame', () => {
      e.play('die', { speed: 0 })
      e.setFrame(2)
      expect(e.tile).toEqual([2, 2])
      e.setFrame(9)
      expect(e.frame).toEqual(2)
    })

    it('should stop animating, keeping the tile', () => {
      e.play('walk')
      e.animate(100)
      e.stop()
      e.animate(500)
      expect(e.tile).toEqual([1, 1])
    })

    it('should play a clip again once it has completed', () => {
      e.play('die')
      e.animate(300)
      e.play('die')
      expect(e.frame).toEqual(0)
      expect(e.animating).toBe(true)
    })

    it('should animate its children', () => {
      var child = new Entity()
      spyOn(child, 'animate')
      e.addEntity('child', child)
      e.animate(16)
      expect(child.animate).toHaveBeenCalledWith(16)
    })

    it('should complain about a clip it does not have', () => {
      expect(() => e.play('fly')).toThrowError(/No such clip/)
    })
  })
})
