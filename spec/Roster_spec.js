import Roster from '../lib/Roster.js'
import Entity from '../lib/Entity.js'
import Scene from '../lib/Scene.js'

describe('Roster', () => {
  it('should keep an entity for each thing, made once, shown each update, taken off when gone', () => {
    var scene = new Scene()
    var made = 0
    var roster = new Roster({ scene, name: 'unit', make: () => { made++; return new Entity() } })
    roster.update([[1, { x: 4 }], [2, { x: 8 }]], (e, t) => { e.x = t.x })
    expect(scene.getEntity('unit1').x).toBe(4)
    roster.update([[2, { x: 9 }]], (e, t) => { e.x = t.x })
    expect(made).toBe(2)
    expect(() => scene.getEntity('unit1')).toThrow()
    expect(roster.get(2).x).toBe(9)
    expect(roster.size).toBe(1)
    roster.clear()
    expect(() => scene.getEntity('unit2')).toThrow()
  })
})
