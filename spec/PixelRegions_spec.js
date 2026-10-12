import PixelRegions from '../lib/PixelRegions.js'

describe('PixelRegions', () => {
  // A picture from rows of characters: '#' solid, '.' not
  const picture = (rows) => {
    const cells = rows.join('')
    return { regions: new PixelRegions(rows[0].length, rows.length), solid: (i) => cells[i] === '#' }
  }
  const show = (mask, width) => {
    const rows = []
    for (let i = 0; i < mask.length; i += width) rows.push(Array.from(mask.slice(i, i + width)).map((v) => (v ? 'x' : '.')).join(''))
    return rows
  }

  it('should flood from the starting pixels through those it may pass, side by side only by default', () => {
    const { regions, solid } = picture(['##.#', '.#..', '#..#'])
    const reached = regions.flood((i) => i === 0, solid)
    expect(show(reached, 4)).toEqual(['xx..', '.x..', '....'])
    const corners = regions.flood((i) => i === 0, solid, { diagonal: true })
    expect(show(corners, 4)).toEqual(['xx..', '.x..', 'x...'])
  })

  it('should tell the border pixels', () => {
    const r = new PixelRegions(3, 3)
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => r.edge(i))).toEqual([true, true, true, true, false, true, true, true, true])
  })

  it('should find the islands, joined at the corners unless told not to', () => {
    const { regions, solid } = picture(['#..#', '.#..', '...#'])
    expect(regions.islands(solid).map((s) => s.length).sort()).toEqual([1, 1, 2])
    expect(regions.islands(solid, { diagonal: false }).length).toBe(4)
  })

  it('should find the hollows inside solid parts, keeping the parts\' edges', () => {
    const { regions, solid } = picture([
      '.......',
      '.#####.',
      '.#...#.',
      '.#...#.',
      '.#####.',
      '.......'
    ])
    expect(show(regions.hollows(solid, 1), 7)).toEqual(['.......', '.......', '..xxx..', '..xxx..', '.......', '.......'])
    // An open ring is not hollow
    const open = picture(['.......', '.##.##.', '.#...#.', '.#####.', '.......'])
    expect(show(open.regions.hollows(open.solid, 0), 7).join('')).not.toContain('x')
  })
})
