# Mixin

`lib/Mixin.js`

How Tenkai shares behaviour between classes that do not share a base class. `GameEngine`, `Scene` and
`Entity` all hold entities, for example, through [HasEntitiesMixin](HasEntitiesMixin.md).

A mixin is written as a class. Its static `init(obj, options)` sets up state, and its methods are copied
onto each instance that uses it.

## Defining a mixin

```js
const { Mixin } = require('tenkai')

class HasHealth {
  static init (obj, options = {}) {
    obj.health = options.health || 100
  }

  damage (amount) {
    this.health -= amount
  }

  get alive () {
    return this.health > 0
  }
}

module.exports = Mixin.export(HasHealth)
```

## Using a mixin

```js
const HasHealth = require('./HasHealth')

class Enemy extends Entity {
  constructor (options) {
    super(options)
    HasHealth(this, options)
  }
}

var e = new Enemy({ health: 30 })
e.damage(10)
```

## Methods

### `Mixin.export(klass)`

Returns a function `(obj, options)`. When called, it copies every method of `klass`, including inherited
ones, onto `obj`, bound to `obj`. It then calls `klass.init(obj, options)` if there is one.

## Notes

- Methods are bound copies on each instance, not shared through the prototype.
- Methods the using class already has, its own or inherited, are left alone. A class can therefore
  override what a mixin provides, but cannot reach the mixin's version through `super`.
- Within a mixin, a subclass's methods take precedence over its superclass's.
- Getters and setters are supported. They are defined on the instance, bound to it.
- Constants attached to the mixin class, such as `HasEntitiesMixin.PERSPECTIVE_DEPTH`, are not on the
  exported function. Use the copies on `Scene` and `TiledScene` instead.
