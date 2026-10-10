import { GameEngine, Entity, Scene } from '../../index.js'
import sheets from './sprites.js'
import Actor from './actor.js'
import { Ocean, Hud } from './scenes.js'

// Pixels per second
const OCEAN_SPEED = 50
const PLAYER_SPEED = 320
const PLAYER_SHOT_SPEED = 720
const ENEMY_SHOT_SPEED = 230

const rand = (min, max) => min + Math.random() * (max - min)
const randInt = (n) => Math.floor(Math.random() * n)
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

/**
 * 1945: a vertically scrolling shoot-em-up. Fly a P-38 over the Pacific, shoot down fighters and bombers, sink
 * battleships and submarines, and collect power-ups.
 */
class Game1945 extends GameEngine {
  constructor (options = {}) {
    super(Object.assign({
      enableScroll: false,
      enableZoom: false,
      // Pixel art: scale sprites without blurring, which would also bleed the sheet's tile borders into the edges
      pixelated: true,
      keys: {
        left: ['ArrowLeft', 'KeyA'],
        right: ['ArrowRight', 'KeyD'],
        up: ['ArrowUp', 'KeyW'],
        down: ['ArrowDown', 'KeyS'],
        fire: ['Space', 'KeyZ', 'KeyJ']
      }
    }, options))
    this.addAsset('sprites', 'assets/sprite.png')

    this.nextId = 0
    this.score = 0
    this.highScore = loadHighScore()
    this.health = 100
    this.weaponLevel = 0
  }

  init () {
    this.sprites = sheets(this.getAsset('sprites'))
    this.title = new Title(this)
    this.playing = new Playing(this)
    this.gameOverMode = new GameOver(this)

    // Layers, drawn in z order: the ocean and islands, ships on the water, aircraft, then the HUD
    this.ocean = this.addScene('ocean', new Ocean({ z: 0, width: this.width, height: this.height }))
    this.sea = this.addScene('sea', new Scene({ z: 1 }))
    this.air = this.addScene('air', new Scene({ z: 2 }))
    this.hud = this.addScene('hud', new Hud({ z: 3 }))

    this.actors = { scenery: [], enemies: [], playerShots: [], enemyShots: [], pickups: [], effects: [] }

    // Title and game over text
    this.logo = this.hud.addEntity('logo', new Entity({ sheet: this.sprites.logo, x: this.width / 2, y: 250 }))
    this.pressSpace = this.hud.addEntity('pressSpace', new Entity({ sheet: this.sprites.pressSpace, x: this.width / 2, y: 520 }))
    this.gameOver = this.hud.addEntity('gameOver', new Entity({ sheet: this.sprites.gameOver, x: this.width / 2, y: 400, scale: 2 }))

    // Start with islands already in view
    for (var i = 0; i < 5; i++) this.spawnIsland(rand(0, this.height))
    this.nextIsland = 0

    this.setMode(this.title)
  }

  startGame () {
    for (var list of ['enemies', 'playerShots', 'enemyShots', 'pickups', 'effects']) {
      this.actors[list].forEach((a) => a.remove())
      this.actors[list] = []
    }
    this.clearTimers()
    this.setMode(this.playing)

    this.score = 0
    this.health = 100
    this.weaponLevel = 0
    this.fireCooldown = 0
    this.invulnerable = 1.5
    this.playTime = 0

    // Each spawner first fires once playTime passes 'after', then roughly every 'every' seconds, getting faster
    this.spawners = [
      { after: 1, every: 3.2, spawn: () => this.spawnSquadron() },
      { after: 8, every: 4.5, spawn: () => this.spawnZero() },
      { after: 16, every: 13, spawn: () => this.spawnSubmarine() },
      { after: 24, every: 22, spawn: () => this.spawnBomber() },
      { after: 38, every: 34, spawn: () => this.spawnBattleship() }
    ]
    this.spawners.forEach((s) => { s.next = s.after })

    this.player = new Actor(this, this.air, this.sprites.p38, {
      x: this.width / 2, y: this.height - 110, z: 2, hitWidth: 28, hitHeight: 30
    })
    this.player.play('fly')

    // White silhouette over the player while it is invulnerable
    this.playerFlash = this.player.entity.addEntity('flash', new Entity({ sheet: this.sprites.flash, visible: false }))
  }

  endGame () {
    if (this.score > this.highScore) {
      this.highScore = this.score
      saveHighScore(this.score)
    }
    this.setMode(this.gameOverMode)
  }

  // Each game step: the scenery, the current mode (title, playing or game over), then every actor

  update (dt) {
    this.ocean.scroll += OCEAN_SPEED * dt
    this.nextIsland -= dt
    if (this.nextIsland <= 0) {
      this.spawnIsland(-90)
      this.nextIsland = rand(2.5, 5)
    }

    super.update(dt)

    for (var list in this.actors) {
      for (var a of this.actors[list]) {
        if (a.dead) continue
        a.age += dt
        if (a.think) a.think(a, dt)
        a.x += a.vx * dt
        a.y += a.vy * dt
        if (this.isOffscreen(a)) a.remove()
      }
    }

    if (this.mode === this.playing) this.collide()

    for (list in this.actors) this.actors[list] = this.actors[list].filter((a) => !a.dead)
  }

  isOffscreen (a) {
    return a.y - a.height / 2 > this.height + 40 ||
      a.y + a.height / 2 < -a.cullTop ||
      a.x + a.width / 2 < -160 ||
      a.x - a.width / 2 > this.width + 160
  }

  updateSpawners (dt) {
    this.playTime += dt
    var difficulty = 1 + this.playTime / 90
    for (var s of this.spawners) {
      s.next -= dt
      if (s.next <= 0) {
        s.spawn()
        s.next = s.every / difficulty * rand(0.8, 1.2)
      }
    }
  }

  // Player

  updatePlayer (dt) {
    var p = this.player
    if (p.dead) return

    var dx = this.input.axis('left', 'right')
    var dy = this.input.axis('up', 'down')
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2 }
    p.x = clamp(p.x + dx * PLAYER_SPEED * dt, p.width / 2, this.width - p.width / 2)
    p.y = clamp(p.y + dy * PLAYER_SPEED * dt, p.height / 2 + 50, this.height - p.height / 2)

    this.fireCooldown -= dt
    if (this.input.down('fire') && this.fireCooldown <= 0) {
      this.firePlayer()
      this.fireCooldown = this.weaponLevel >= 3 ? 0.09 : 0.13
    }

    this.invulnerable -= dt
    this.playerFlash.visible = this.invulnerable > 0 && Math.floor(this.invulnerable * 16) % 2 === 0
  }

  firePlayer () {
    var p = this.player
    this.spawnPlayerShot(p.x, p.y - 34, 0, 0)
    if (this.weaponLevel >= 1) {
      this.spawnPlayerShot(p.x - 18, p.y - 20, -0.12, 6)
      this.spawnPlayerShot(p.x + 18, p.y - 20, 0.12, 6)
    }
    if (this.weaponLevel >= 2) {
      this.spawnPlayerShot(p.x - 24, p.y - 10, -0.32, 6)
      this.spawnPlayerShot(p.x + 24, p.y - 10, 0.32, 6)
    }
  }

  spawnPlayerShot (x, y, angle, tile) {
    this.actors.playerShots.push(new Actor(this, this.air, this.sprites.shot, {
      x,
      y,
      vx: Math.sin(angle) * PLAYER_SHOT_SPEED,
      vy: -Math.cos(angle) * PLAYER_SHOT_SPEED,
      angle,
      tile: [tile, 0],
      z: 3,
      hitWidth: 14,
      hitHeight: 24,
      cullTop: 20
    }))
  }

  hurtPlayer (damage) {
    if (this.invulnerable > 0 || this.player.dead) return
    this.health -= damage
    this.invulnerable = 0.8
    this.explode(this.player.x + rand(-12, 12), this.player.y + rand(-12, 12), 'small')
    if (this.health <= 0) this.killPlayer()
  }

  killPlayer () {
    var p = this.player
    for (var i = 0; i < 6; i++) {
      var x = p.x + rand(-30, 30)
      var y = p.y + rand(-30, 30)
      this.after(i * 0.12, ((x, y) => () => this.explode(x, y, 'large'))(x, y))
    }
    p.remove()
    this.endGame()
  }

  // Enemies

  addEnemy (layer, sheet, options) {
    var enemy = new Actor(this, layer, sheet, options)
    this.actors.enemies.push(enemy)
    return enemy
  }

  // Fire a round at the player from (x, y), optionally offset from a direct line by angle radians
  enemyFire (x, y, angle = 0) {
    var p = this.player
    if (this.mode !== this.playing || p.dead || y < 0 || y > this.height * 0.8) return
    var a = Math.atan2(p.y - y, p.x - x) + angle
    this.actors.enemyShots.push(new Actor(this, this.air, this.sprites.shot, {
      x,
      y,
      vx: Math.cos(a) * ENEMY_SHOT_SPEED,
      vy: Math.sin(a) * ENEMY_SHOT_SPEED,
      tile: [2, 0],
      z: 3,
      hitWidth: 8,
      hitHeight: 8,
      cullTop: 20
    }))
  }

  // A line of five small fighters following a curved path
  spawnSquadron () {
    var livery = randInt(4)
    var pattern = ['column', 'fromLeft', 'fromRight'][randInt(3)]
    var x0 = rand(90, this.width - 90)
    var y0 = rand(90, 260)
    var path = {
      column: (t) => [x0 + Math.sin(t * 2.6) * 70, -30 + t * 210],
      fromLeft: (t) => [-30 + t * 250, y0 + t * 40 + Math.sin(t * 2.2) * 70],
      fromRight: (t) => [this.width + 30 - t * 250, y0 + t * 40 + Math.sin(t * 2.2) * 70]
    }[pattern]

    for (var i = 0; i < 5; i++) {
      this.after(i * 0.32, () => {
        var [x, y] = path(0)
        var fighter = this.addEnemy(this.air, this.sprites.fighter, {
          x,
          y,
          scale: 1.3,
          tile: [livery * 3, 0],
          points: 50,
          think: (a, dt) => {
            var lastX = a.x
            var lastY = a.y
            ;[a.x, a.y] = path(a.age)
            a.angle = Math.atan2(a.x - lastX, -(a.y - lastY))
            if (Math.random() < dt * 0.12) this.enemyFire(a.x, a.y)
          }
        })
        fighter.play('fly' + livery)
      })
    }
  }

  // A Zero dives in, then banks towards the player and fires
  spawnZero () {
    var turnAt = rand(140, 320)
    var zero = this.addEnemy(this.air, this.sprites.zero, {
      x: rand(60, this.width - 60),
      y: -40,
      vy: 180,
      scale: 0.9,
      hp: 3,
      points: 150,
      think: (a, dt) => {
        if (!a.turned && a.y > turnAt) {
          a.turned = true
          a.vx = Math.sign(this.player.x - a.x) * 130
          a.vy = 220
        }
        a.faceVelocity()
        a.fireIn = (a.fireIn || 0.6) - dt
        if (a.fireIn <= 0) {
          this.enemyFire(a.x, a.y + 20)
          a.fireIn = 1.4
        }
      }
    })
    zero.angle = Math.PI
    zero.play('fly')
    zero.flash = zero.entity.addEntity('flash', new Entity({ sheet: this.sprites.flash, tile: [0, 1], visible: false }))
  }

  // A slow bomber that soaks up damage and fires spreads
  spawnBomber () {
    var bomber = this.addEnemy(this.air, this.sprites.bomber, {
      x: rand(100, this.width - 100),
      y: -60,
      vy: 45,
      angle: Math.PI,
      hp: 30,
      points: 800,
      drop: 'weapon',
      think: (a, dt) => {
        a.fireIn = (a.fireIn || 1.5) - dt
        if (a.fireIn <= 0) {
          for (var spread of [-0.25, 0, 0.25]) this.enemyFire(a.x, a.y + 30, spread)
          a.fireIn = 2.2
        }
      }
    })
    bomber.play('fly')
    bomber.flash = bomber.entity.addEntity('flash', new Entity({ sheet: this.sprites.flash, tile: [0, 2], scale: 98 / 64, visible: false }))
  }

  // A battleship steaming down the screen with fore and aft turrets
  spawnBattleship () {
    var ship = this.addEnemy(this.sea, this.sprites.battleship, {
      x: rand(70, this.width - 70),
      y: -170,
      vy: OCEAN_SPEED + 12,
      angle: Math.PI,
      scale: 1.4,
      hitWidth: 40,
      hitHeight: 250,
      hp: 45,
      points: 2000,
      drop: 'health',
      think: (a, dt) => {
        a.fireIn = (a.fireIn || 1) - dt
        if (a.fireIn <= 0) {
          a.forward = !a.forward
          this.enemyFire(a.x, a.y + (a.forward ? 70 : -60))
          a.fireIn = 0.9
        }
      }
    })
    ship.play('steam')
  }

  // A submarine surfaces, fires twice, then dives. It can only be hit while surfaced.
  spawnSubmarine () {
    var sub = this.addEnemy(this.sea, this.sprites.submarine, {
      x: rand(60, this.width - 60),
      y: rand(90, 300),
      vy: OCEAN_SPEED,
      angle: Math.PI,
      scale: 1.2,
      tile: [5, 0],
      hp: 4,
      points: 400
    })
    sub.targetable = false
    // Surface, then go up as a target on the surfaced tile
    sub.play('surface', () => {
      sub.targetable = true
      sub.entity.tile = [0, 0]
      this.after(0.5, () => { if (!sub.dead) this.enemyFire(sub.x, sub.y) })
      this.after(1.4, () => { if (!sub.dead) this.enemyFire(sub.x, sub.y) })
      this.after(2.6, () => {
        if (sub.dead) return
        sub.targetable = false
        sub.play('dive', () => sub.remove())
      })
    })
  }

  damageEnemy (enemy, x, y) {
    enemy.hp -= 1
    this.explode(x, y, 'small', enemy.layer === this.sea ? OCEAN_SPEED : 0)
    if (enemy.hp <= 0) return this.killEnemy(enemy)

    if (enemy.flash) {
      enemy.flash.visible = true
      this.after(0.05, () => { enemy.flash.visible = false })
    }
  }

  killEnemy (enemy) {
    this.score += enemy.points
    var drift = enemy.layer === this.sea ? OCEAN_SPEED : 0
    if (enemy.height > 90) {
      // A chain of explosions along the length of large targets
      for (var i = 0; i < 6; i++) {
        var dx = rand(-enemy.hw, enemy.hw)
        var dy = rand(-enemy.hh, enemy.hh)
        this.after(i * 0.1, ((dx, dy) => () => this.explode(enemy.x + dx, enemy.y + dy, 'large', drift))(dx, dy))
      }
    } else {
      this.explode(enemy.x, enemy.y, 'large', drift)
    }

    var drop = enemy.drop || (Math.random() < 0.06 ? (Math.random() < 0.5 ? 'weapon' : 'health') : null)
    if (drop) this.spawnPickup(enemy.x, enemy.y, drop)
    enemy.remove()
  }

  // Effects and pick-ups

  explode (x, y, size, vy = 0) {
    var large = size === 'large'
    var boom = new Actor(this, this.air, large ? this.sprites.explosionLarge : this.sprites.explosionSmall, { x, y, vy, z: 4 })
    boom.play('explode', () => boom.remove())
    this.actors.effects.push(boom)
  }

  spawnPickup (x, y, type) {
    var x0 = x
    var pickup = new Actor(this, this.air, this.sprites.powerup, {
      x,
      y,
      vy: 70,
      scale: 1.25,
      tile: [type === 'weapon' ? 0 : 4, 0],
      z: 1,
      think: (a) => { a.x = x0 + Math.sin(a.age * 3) * 30 }
    })
    pickup.type = type
    this.actors.pickups.push(pickup)
  }

  collect (pickup) {
    if (pickup.type === 'weapon') {
      if (this.weaponLevel < 3) this.weaponLevel++
      else this.score += 1000
    } else {
      this.health = Math.min(100, this.health + 35)
    }
    this.score += 100
    pickup.remove()
  }

  spawnIsland (y) {
    this.actors.scenery.push(new Actor(this, this.ocean, this.sprites.island, {
      x: rand(0, this.width),
      y,
      vy: OCEAN_SPEED,
      scale: rand(1.4, 2.6),
      angle: randInt(4) * Math.PI / 2,
      tile: [randInt(3), 0]
    }))
  }

  // Collisions

  collide () {
    var { enemies, playerShots, enemyShots, pickups } = this.actors

    for (var shot of playerShots) {
      for (var enemy of enemies) {
        if (shot.dead || enemy.dead || !enemy.targetable || enemy.y + enemy.hh < 0) continue
        if (shot.overlaps(enemy)) {
          shot.remove()
          this.damageEnemy(enemy, shot.x, shot.y - 8)
        }
      }
    }

    var p = this.player
    if (p.dead) return

    for (shot of enemyShots) {
      if (!shot.dead && shot.overlaps(p)) {
        shot.remove()
        this.hurtPlayer(10)
      }
    }

    for (enemy of enemies) {
      if (!enemy.dead && enemy.layer === this.air && enemy.overlaps(p)) {
        this.hurtPlayer(25)
        if (!enemy.dead && enemy.hp <= 3) this.killEnemy(enemy)
      }
    }

    for (var pickup of pickups) {
      if (!pickup.dead && pickup.overlaps(p)) this.collect(pickup)
    }
  }
}

// Modes

/** The title screen: the logo and a blinking prompt until fire is pressed. */
class Title {
  constructor (game) { this.game = game }

  enter () {
    this.game.logo.visible = true
    this.game.gameOver.visible = false
  }

  update () {
    var game = this.game
    game.pressSpace.visible = Math.floor(game.time * 2) % 2 === 0
    if (game.input.pressed('fire')) game.startGame()
  }

  exit () {
    this.game.logo.visible = false
    this.game.pressSpace.visible = false
  }
}

/** Flying: the player and the waves of enemies. */
class Playing {
  constructor (game) { this.game = game }

  update (dt) {
    this.game.updatePlayer(dt)
    this.game.updateSpawners(dt)
  }
}

/** Game over: the message for a few seconds, then back to the title. */
class GameOver {
  constructor (game) { this.game = game }

  enter () {
    this.game.gameOver.visible = true
    this.game.after(4, () => this.game.setMode(this.game.title))
  }
}

function loadHighScore () {
  try {
    return parseInt(window.localStorage.getItem('tenkai-1945-high-score'), 10) || 0
  } catch (e) {
    return 0
  }
}

function saveHighScore (score) {
  try {
    window.localStorage.setItem('tenkai-1945-high-score', String(score))
  } catch (e) {}
}

var game = new Game1945({ targetId: 'game' })
game.start()
window.game = game
