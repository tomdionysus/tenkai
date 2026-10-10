import IsometricWorld from '../lib/IsometricWorld.js'

describe('IsometricWorld', () => {
  var world
  beforeEach(() => {
    world = new IsometricWorld()
    world.addRegion({ name: 'upper', x0: 0, x1: 100, y0: 0, y1: 100, z0: 500, z1: 1000 })
    world.addRegion({ name: 'lower', x0: 0, x1: 100, y0: 0, y1: 100, z0: 0, z1: 500 })
  })

  it('should find regions by point, with or without height', () => {
    expect(world.regionAt(10, 10, 600).name).toEqual('upper')
    expect(world.regionAt(10, 10, 0).name).toEqual('lower')
    expect(world.regionAt(10, 10).name).toEqual('upper')
    expect(world.regionAt(100, 10, 0)).toBeNull()
  })

  it('should include low edges and exclude high ones', () => {
    var box = { x0: 0, x1: 10, y0: 0, y1: 10 }
    expect(IsometricWorld.contains(box, 0, 0)).toBe(true)
    expect(IsometricWorld.contains(box, 10, 5)).toBe(false)
    expect(IsometricWorld.contains({ x0: 0, x1: 10, y0: 0, y1: 10, z0: 0, z1: 5 }, 1, 1, 5)).toBe(false)
  })

  it('should scope colliders to their region, and apply unscoped ones everywhere', () => {
    var wall = world.addCollider({ region: 'upper', x0: 0, x1: 100, y0: 0, y1: 5, type: 'wall' })
    var post = world.addCollider({ x0: 50, x1: 52, y0: 50, y1: 52, type: 'post' })
    expect(world.collidersAt(10, 2, 600)).toEqual([wall])
    expect(world.collidersAt(10, 2, 0)).toEqual([])
    expect(world.collidersAt(51, 51, 0)).toEqual([post])
    expect(world.colliders.length).toEqual(2)
    expect(world.collidersIn('upper')).toEqual([wall])
    expect(world.collidersIn(world.regions[0], true)).toEqual([wall, post])
    expect(world.collidersIn('lower')).toEqual([])
  })

  it('should block moves into colliders without a handler, and ask handlers otherwise', () => {
    world.addCollider({ region: 'lower', x0: 0, x1: 100, y0: 0, y1: 5, type: 'wall' })
    var door = world.addCollider({ region: 'lower', x0: 40, x1: 60, y0: 90, y1: 100, type: 'door', open: false })
    world.on('door', (body, d) => d.open)
    var b = world.addBody({ x: 50, y: 10, z: 0 })
    var r = world.move(b, 0, -6)
    expect(r.moved).toBe(false)
    expect(r.collider.type).toEqual('wall')
    expect([b.x, b.y]).toEqual([50, 10])
    b.y = 85
    expect(world.move(b, 0, 6).moved).toBe(false)
    door.open = true
    r = world.move(b, 0, 6)
    expect(r.moved).toBe(true)
    expect(r.region.name).toEqual('lower')
    expect(b.y).toEqual(91)
  })

  it('should let handlers change the body or the world', () => {
    world.addCollider({ region: 'lower', x0: 0, x1: 10, y0: 0, y1: 10, type: 'lift' })
    world.on('lift', (body, lift, w, to) => { to.z = 600; return true })
    var b = world.addBody({ x: 20, y: 5, z: 0 })
    world.move(b, -15, 0)
    expect(b.z).toEqual(600)
  })

  it('should stop bodies running into each other, by their boxes', () => {
    var a = world.addBody({ x: 10, y: 10, z: 0, size: [8, 8, 32] })
    var b = world.addBody({ x: 30, y: 10, z: 0, size: [8, 8, 32] })
    var r = world.move(a, 13, 0)
    expect(r.moved).toBe(false)
    expect(r.blocker).toBe(b)
    expect(world.move(a, 11, 0).moved).toBe(true)
    // Far enough apart in height, they pass
    b.z = 40
    expect(world.move(a, 8, 0).moved).toBe(true)
    world.removeBody(b)
    expect(world.bodies).toEqual([a])
  })
})
