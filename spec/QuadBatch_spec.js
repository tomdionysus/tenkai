import QuadBatch from '../lib/QuadBatch.js'

describe('QuadBatch', () => {
  it('should lay a quad out as two triangles of its corners, each followed by the shared numbers', () => {
    const b = new QuadBatch({ floats: 5 })
    b.begin()
    b.quad([[0, 0, 0, 0], [8, 0, 1, 0], [8, 8, 1, 1], [0, 8, 0, 1]], [7])
    expect(b.count).toEqual(6)
    expect(Array.from(b.vertices)).toEqual([
      0, 0, 0, 0, 7, 8, 0, 1, 0, 7, 8, 8, 1, 1, 7,
      0, 0, 0, 0, 7, 8, 8, 1, 1, 7, 0, 8, 0, 1, 7
    ])
  })

  it('should grow as quads are added, and start over on begin', () => {
    const b = new QuadBatch({ floats: 2, capacity: 1 })
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1]]
    for (let i = 0; i < 10; i++) b.quad(corners)
    expect(b.count).toEqual(60)
    expect(b.vertices.length).toEqual(120)
    expect(b.data.length).toBeGreaterThanOrEqual(120)
    b.begin()
    expect(b.count).toEqual(0)
    expect(b.vertices.length).toEqual(0)
  })
})
