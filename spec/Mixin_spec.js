import Mixin from '../lib/Mixin.js'

describe('Mixin', () => {
  class Base {
    static init (obj, options = {}) { obj.health = options.health || 100 }
    damage (n) { this.health -= n }
    describe () { return 'base' }
  }

  class Health extends Base {
    describe () { return 'health' }
    get alive () { return this.health > 0 }
    set alive (v) { this.health = v ? 1 : 0 }
  }

  const HealthMixin = Mixin.export(Health)

  it('should copy methods, bound to the object, and run init', () => {
    var obj = {}
    HealthMixin(obj, { health: 30 })
    var damage = obj.damage
    damage(10)
    expect(obj.health).toEqual(20)
  })

  it('should prefer a subclass method over its superclass', () => {
    var obj = {}
    HealthMixin(obj)
    expect(obj.describe()).toEqual('health')
  })

  it('should support getters and setters', () => {
    var obj = {}
    HealthMixin(obj)
    expect(obj.alive).toBe(true)
    obj.alive = false
    expect(obj.health).toEqual(0)
  })

  it('should not replace methods the using class defines', () => {
    class User {
      constructor () { HealthMixin(this) }
      describe () { return 'user' }
    }
    expect(new User().describe()).toEqual('user')
  })
})
