import HasEntitiesMixin from '../lib/HasEntitiesMixin.js'
import ContextMock2D from './mocks/ContextMock2D.js'

describe('HasEntitiesMixin', () => {
  var x1
  beforeEach(() => {
    x1 = {}
    HasEntitiesMixin(x1)
  })

  describe('init', () => {
    it('should set properties on object', () => {
      expect(x1._entities).toEqual({})
    })
  })

  describe('addEntity', () => {
    it('should add entity with name to _entities and set parent on entity', () => {
      var ent = { entity: 'ENTITY' }

      x1.addEntity('NAME', ent)

      expect(x1._entities.NAME).toBe(ent)
      expect(ent.parent).toBe(x1)
    })

    it('should add entity with name to _entities', () => {
      var ent = { entity: 'ENTITY' }

      x1.addEntity('NAME', ent)

      expect(x1._entities.NAME).toBe(ent)
    })

    it('should call removeEntity on entity parent if it is already defined', () => {
      var oldcontainer = { removeEntity: () => {} }
      var ent = { entity: 'ENTITY', name: 'OLDNAME', parent: oldcontainer }

      spyOn(oldcontainer, 'removeEntity')

      x1.addEntity('NAME', ent)

      expect(oldcontainer.removeEntity).toHaveBeenCalledWith('OLDNAME')
      expect(x1.getEntity('NAME')).toBe(ent)
    })

    it('should keep the entity when re-added to the same container', () => {
      var ent = { entity: 'ENTITY' }

      x1.addEntity('NAME', ent)
      x1.addEntity('NAME', ent)

      expect(x1.getEntity('NAME')).toBe(ent)
    })
  })

  describe('getEntity', () => {
    it('should throw if not found in _entities', () => {
      var ent = { entity: 'ENTITY' }

      x1._entities.NAME = ent

      expect(() => { x1.getEntity('OTHERNAME') }).toThrow('Entity not found: OTHERNAME')
    })

    it('should return correct entity if found in _entities', () => {
      var ent = { entity: 'ENTITY' }

      x1._entities.NAME = ent

      expect(x1.getEntity('NAME')).toBe(ent)
    })
  })

  describe('removeEntity', () => {
    it('should delete entity from _entities', () => {
      var ent = { entity: 'ENTITY' }

      x1._entities.NAME = ent

      x1.removeEntity('NAME')

      expect(x1._entities.NAME).toBeUndefined()
    })
  })

  describe('drawEntities', () => {
    var context
    beforeEach(() => {
      context = new ContextMock2D()
    })

    it('should draw entities in z order in PERSPECTIVE_OVERHEAD mode', () => {
      var order = []
      x1.perspectiveMode = 1
      x1._entities = {
        A: { z: 3, y: 0, hotspotY: 0, draw: () => order.push('A') },
        B: { z: 1, y: 9, hotspotY: 0, draw: () => order.push('B') },
        C: { z: 2, y: 5, hotspotY: 0, draw: () => order.push('C') }
      }

      x1.drawEntities(context)

      expect(order).toEqual(['B', 'C', 'A'])
    })

    it('should draw entities by where they stand, then by elevation, in PERSPECTIVE_DEPTH mode', () => {
      var order = []
      x1.perspectiveMode = 2
      x1._entities = {
        A: { z: 3, y: 10, elevation: 8, draw: () => order.push('A') },
        B: { z: 1, y: 14, draw: () => order.push('B') },
        C: { z: 2, y: 5, draw: () => order.push('C') },
        D: { z: 0, y: 10, elevation: 0, draw: () => order.push('D') }
      }

      x1.drawEntities(context)

      expect(order).toEqual(['C', 'D', 'A', 'B'])
    })

    it('should put an entity with a negative sortOffset behind others at its depth', () => {
      var order = []
      x1.perspectiveMode = 2
      x1._entities = {
        rider: { y: 10, draw: () => order.push('rider') },
        car: { y: 10, sortOffset: -0.5, draw: () => order.push('car') }
      }
      x1.drawEntities(context)
      expect(order).toEqual(['car', 'rider'])
    })

    it('should draw entities in z order if perspectiveMode is not set, keeping insertion order for ties', () => {
      var order = []
      x1._entities = {
        A: { z: 1, draw: () => order.push('A') },
        B: { z: 0, draw: () => order.push('B') },
        C: { z: 1, draw: () => order.push('C') },
        D: { z: 0, draw: () => order.push('D') }
      }

      x1.drawEntities(context)

      expect(order).toEqual(['B', 'D', 'A', 'C'])
    })

    it('should pass the context to each entity', () => {
      var ent = { z: 0, draw: () => {} }
      spyOn(ent, 'draw')
      x1._entities = { A: ent }

      x1.drawEntities(context)

      expect(ent.draw).toHaveBeenCalledWith(context)
    })
  })
})
