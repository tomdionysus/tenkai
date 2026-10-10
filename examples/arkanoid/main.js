import { GameEngine, Scene, Entity, Sheet } from '../../index.js'

const COLUMNS = 10
const BRICK_WIDTH = 64
const BRICK_HEIGHT = 32
const BRICKS_TOP = 90
// One row per colour, top to bottom. Grey bricks take two hits.
const ROWS = ['grey', 'red', 'yellow', 'green', 'blue', 'purple']
const PADDLE_SPEED = 600
const BALL_SPEED = 380

class Arkanoid extends GameEngine {
  constructor (options = {}) {
    super(Object.assign({
      enableScroll: false,
      enableZoom: false,
      keys: { left: ['ArrowLeft'], right: ['ArrowRight'], launch: ['Space'] }
    }, options))
    this.addAsset('paddle', 'assets/paddleBlu.png')
    this.addAsset('ball', 'assets/ballBlue.png')
    this.addAsset('cracked', 'assets/element_grey_rectangle.png')
    for (var colour of ROWS) this.addAsset(colour, 'assets/element_' + colour + '_rectangle_glossy.png')
  }

  init () {
    // Each sprite is a whole image, so each sheet is one tile
    this.sheets = {}
    for (var name of ['paddle', 'ball', 'cracked'].concat(ROWS)) this.sheets[name] = new Sheet({ image: this.getAsset(name) })

    // The playfield: a background colour, the paddle, ball and bricks, then the score and messages on top
    this.board = this.addScene('board', new Scene({
      background: (context) => {
        context.fillStyle = '#1c2340'
        context.fillRect(0, 0, this.width, this.height)
      },
      foreground: (context) => this.drawText(context)
    }))

    this.paddle = this.board.addEntity('paddle', new Entity({ sheet: this.sheets.paddle }))
    this.ball = this.board.addEntity('ball', new Entity({ sheet: this.sheets.ball }))

    // The mouse moves the paddle; a click launches the ball
    this.on('mousemove', () => { this.paddle.x = this.mouseX - this.paddle.width / 2 })
    this.on('mousedown', () => this.launch())

    this.newGame()
  }

  newGame () {
    this.score = 0
    this.lives = 3
    this.level = 0
    this.nextLevel()
  }

  nextLevel () {
    this.level++
    this.bricks = []
    ROWS.forEach((colour, row) => {
      for (var col = 0; col < COLUMNS; col++) {
        var brick = this.board.addEntity('brick' + row + '_' + col, new Entity({
          sheet: this.sheets[colour],
          x: col * BRICK_WIDTH,
          y: BRICKS_TOP + row * BRICK_HEIGHT
        }))
        brick.hits = colour === 'grey' ? 2 : 1
        brick.points = (ROWS.length - row) * 10
        this.bricks.push(brick)
      }
    })
    this.serve()
  }

  // Put the ball on the paddle, waiting to be launched
  serve () {
    this.serving = true
    this.message = 'CLICK OR PRESS SPACE TO LAUNCH'
  }

  launch () {
    if (this.lives === 0) return this.newGame()
    if (!this.serving) return
    this.serving = false
    this.message = null
    var speed = BALL_SPEED * (1 + (this.level - 1) * 0.1)
    this.vx = speed * 0.5
    this.vy = -speed * Math.sqrt(0.75)
  }

  update (dt) {
    if (this.input.pressed('launch')) this.launch()

    var paddle = this.paddle
    var ball = this.ball
    paddle.x = Math.max(0, Math.min(this.width - paddle.width, paddle.x + this.input.axis('left', 'right') * PADDLE_SPEED * dt))
    paddle.y = this.height - 60

    if (this.serving) {
      ball.x = paddle.x + (paddle.width - ball.width) / 2
      ball.y = paddle.y - ball.height
      return
    }

    // Move in small steps so a fast ball cannot pass through a brick between frames
    var steps = Math.ceil(Math.hypot(this.vx, this.vy) * dt / 4)
    for (var i = 0; i < steps && !this.serving; i++) this.move(dt / steps)
  }

  move (dt) {
    var ball = this.ball
    var paddle = this.paddle
    var size = ball.width
    ball.x += this.vx * dt
    ball.y += this.vy * dt

    // Walls
    if (ball.x < 0) { ball.x = 0; this.vx = Math.abs(this.vx) }
    if (ball.x + size > this.width) { ball.x = this.width - size; this.vx = -Math.abs(this.vx) }
    if (ball.y < 0) { ball.y = 0; this.vy = Math.abs(this.vy) }

    // Paddle: the further from the centre the ball lands, the steeper it leaves, up to 60 degrees
    if (this.vy > 0 && overlaps(ball, paddle)) {
      var hit = (ball.x + size / 2 - (paddle.x + paddle.width / 2)) / (paddle.width / 2)
      var angle = Math.max(-1, Math.min(1, hit)) * Math.PI / 3
      var speed = Math.hypot(this.vx, this.vy)
      this.vx = Math.sin(angle) * speed
      this.vy = -Math.cos(angle) * speed
    }

    // Missed
    if (ball.y > this.height) {
      this.lives--
      if (this.lives > 0) return this.serve()
      this.serving = true
      this.message = 'GAME OVER - CLICK OR PRESS SPACE TO PLAY AGAIN'
      return
    }

    // Bricks: bounce off the side the ball went in furthest from, then damage the brick
    for (var brick of this.bricks) {
      if (!overlaps(ball, brick)) continue
      var dx = Math.min(ball.x + size - brick.x, brick.x + BRICK_WIDTH - ball.x)
      var dy = Math.min(ball.y + size - brick.y, brick.y + BRICK_HEIGHT - ball.y)
      if (dx < dy) this.vx = -this.vx
      else this.vy = -this.vy

      brick.hits--
      if (brick.hits > 0) {
        brick.sheet = this.sheets.cracked
      } else {
        this.score += brick.points
        this.board.removeEntity(brick.name)
        this.bricks.splice(this.bricks.indexOf(brick), 1)
        if (this.bricks.length === 0) this.nextLevel()
      }
      break
    }
  }

  drawText (context) {
    context.fillStyle = '#ffffff'
    context.font = 'bold 20px system-ui, sans-serif'
    context.textAlign = 'left'
    context.fillText('SCORE ' + this.score, 16, 40)
    context.textAlign = 'right'
    context.fillText('LEVEL ' + this.level + '   BALLS ' + this.lives, this.width - 16, 40)
    if (this.message) {
      context.textAlign = 'center'
      context.fillText(this.message, this.width / 2, this.height - 160)
    }
  }
}

function overlaps (a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

var game = new Arkanoid({ targetId: 'game' })
game.start()
window.game = game
