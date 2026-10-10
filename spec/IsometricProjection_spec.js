import IsometricProjection from '../lib/IsometricProjection.js'

describe('IsometricProjection', () => {
  it('should project classic 2:1 isometric by default', () => {
    var p = new IsometricProjection()
    expect(p.project(10, 0, 0)).toEqual({ x: 20, y: 10, elevation: 0 })
    expect(p.project(0, 10, 4)).toEqual({ x: -20, y: 10, elevation: 4 })
    expect(p.toScreen(10, 0, 5)).toEqual({ x: 20, y: 5 })
  })

  it('should reproduce a game projection exactly (Wreckers, 1991)', () => {
    // The game: screen x = 2(Y - X + 1024), screen y = 3072 - X - Y - Z
    var p = new IsometricProjection({ xAxis: [-2, -1], yAxis: [2, -1], origin: [2048, 3072] })
    expect(p.toScreen(1020, 356, 896)).toEqual({ x: 720, y: 800 })
    expect(p.project(1020, 356, 896)).toEqual({ x: 720, y: 1696, elevation: 896 })
  })

  it('should find the world position under a screen point, at a height', () => {
    var p = new IsometricProjection({ xAxis: [-2, -1], yAxis: [2, -1], origin: [2048, 3072] })
    expect(p.toWorld(720, 800, 896)).toEqual({ x: 1020, y: 356 })
    var q = new IsometricProjection()
    expect(q.toWorld(20, 10)).toEqual({ x: 10, y: 0 })
  })

  it('should turn screen directions into world ones', () => {
    var p = new IsometricProjection()
    // Straight up the screen is back along both axes
    var v = p.vectorToWorld(0, -2)
    expect(v.x).toBeCloseTo(-1)
    expect(v.y).toBeCloseTo(-1)
  })

  it('should order depth so that nearer is larger', () => {
    var p = new IsometricProjection({ xAxis: [-2, -1], yAxis: [2, -1], origin: [2048, 3072] })
    // In Wreckers, greater X + Y is farther
    expect(p.depth(1000, 400)).toBeLessThan(p.depth(900, 400))
  })

  it('should refuse parallel axes', () => {
    expect(() => new IsometricProjection({ xAxis: [2, 1], yAxis: [4, 2] })).toThrowError(/parallel/)
  })
})
