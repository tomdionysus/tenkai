const HasEntitiesMixin = require('../lib/HasEntitiesMixin')
const ContextMock2D = require('./mocks/ContextMock2D')

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
      var ent = { entity: 'ENTITY', parent: oldcontainer }

      spyOn(oldcontainer, 'removeEntity')

      x1.addEntity('NAME', ent)

      expect(oldcontainer.removeEntity).toHaveBeenCalledWith('NAME')
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

    it('should call redraw if defined on container', () => {
      x1.redraw = () => {}
      spyOn(x1, 'redraw')

      x1.removeEntity('NAME')

      expect(x1.redraw).toHaveBeenCalledWith()
    })
  })

  describe('drawEntities', () => {
    var context
    beforeEach(() => {
      context = new ContextMock2D()
    })

    it('should call draw on all entities if z is not defined', () => {
      x1._entityOrder = [
        { entity: 'ENTITY1', draw: () => {} },
        { entity: 'ENTITY2', draw: () => {} }
      ]

      spyOn(x1._entityOrder[0], 'draw')
      spyOn(x1._entityOrder[1], 'draw')

      x1.drawEntities(context)

      expect(x1._entityOrder[0].draw).toHaveBeenCalledWith(context)
      expect(x1._entityOrder[1].draw).toHaveBeenCalledWith(context)
    })

    it('should call draw on only correct entities if z is defined', () => {
      x1._entityOrder = []
      x1._entityOrderMap = {
        1: [
          { entity: 'ENTITY1', draw: () => {} },
          { entity: 'ENTITY2', draw: () => {} }
        ],
        2: [
          { entity: 'ENTITY3', draw: () => {} },
          { entity: 'ENTITY4', draw: () => {} }
        ],
        3: [
          { entity: 'ENTITY5', draw: () => {} }
        ]
      }

      spyOn(x1._entityOrderMap[1][0], 'draw')
      spyOn(x1._entityOrderMap[1][1], 'draw')
      spyOn(x1._entityOrderMap[2][0], 'draw')
      spyOn(x1._entityOrderMap[2][1], 'draw')
      spyOn(x1._entityOrderMap[3][0], 'draw')

      x1.drawEntities(context, 2)

      expect(x1._entityOrderMap[1][0].draw).not.toHaveBeenCalled()
      expect(x1._entityOrderMap[1][1].draw).not.toHaveBeenCalled()
      expect(x1._entityOrderMap[2][1].draw).toHaveBeenCalledWith(context)
      expect(x1._entityOrderMap[2][1].draw).toHaveBeenCalledWith(context)
      expect(x1._entityOrderMap[3][0].draw).not.toHaveBeenCalled()
    })
  })

  describe('redrawEntities', () => {
    it('should call redraw on all _entities', () => {
      var ent1 = { entity: 'ENTITY1', redraw: () => {} }
      var ent2 = { entity: 'ENTITY2', redraw: () => {} }

      x1._entities.NAME1 = ent1
      x1._entities.NAME2 = ent2
      spyOn(ent1, 'redraw')
      spyOn(ent2, 'redraw')

      x1.redrawEntities('NAME')

      expect(ent1.redraw).toHaveBeenCalledWith()
      expect(ent2.redraw).toHaveBeenCalledWith()
    })
  })
})
