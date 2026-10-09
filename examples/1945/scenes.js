const { Scene } = require('../../index')

/**
 * The sea: a flat colour with scrolling wave highlights, drawn underneath its entities (the islands).
 */
class Ocean extends Scene {
  constructor (options = {}) {
    super(options)
    this.width = options.width
    this.height = options.height
    this.scroll = 0

    this.waves = []
    for (var i = 0; i < 90; i++) {
      this.waves.push({
        x: Math.random() * this.width,
        y: Math.random() * (this.height + 20),
        length: 8 + Math.random() * 18
      })
    }
  }

  background (context) {
    context.save()
    context.fillStyle = '#1b4f86'
    context.fillRect(0, 0, this.width, this.height)

    context.strokeStyle = 'rgba(255, 255, 255, 0.13)'
    context.lineWidth = 2
    context.beginPath()
    var span = this.height + 20
    for (var wave of this.waves) {
      var y = ((wave.y + this.scroll) % span) - 10
      context.moveTo(wave.x, y)
      context.quadraticCurveTo(wave.x + wave.length / 2, y - 3, wave.x + wave.length, y)
    }
    context.stroke()
    context.restore()
  }
}

/**
 * Score, high score and health bar, drawn over the title and game over entities.
 */
class Hud extends Scene {
  foreground (context) {
    var game = this.game
    context.save()
    context.font = 'bold 20px ui-monospace, Menlo, Consolas, monospace'
    context.textBaseline = 'top'
    context.shadowColor = 'rgba(0, 0, 0, 0.6)'
    context.shadowOffsetX = 2
    context.shadowOffsetY = 2

    context.fillStyle = '#ffffff'
    context.textAlign = 'right'
    context.fillText(String(game.score).padStart(7, '0'), game.width - 16, 14)
    context.fillStyle = '#ffd34d'
    context.textAlign = 'center'
    context.fillText('HI ' + String(game.highScore).padStart(7, '0'), game.width / 2, 14)

    if (game.mode === game.playing) {
      // Health bar
      context.shadowColor = 'transparent'
      context.fillStyle = 'rgba(0, 0, 0, 0.45)'
      context.fillRect(16, 16, 164, 16)
      var health = Math.max(game.health, 0) / 100
      context.fillStyle = health > 0.5 ? '#5fd35f' : health > 0.25 ? '#f2c230' : '#e8483b'
      context.fillRect(18, 18, 160 * health, 12)

      // Weapon level pips
      context.fillStyle = '#ffd34d'
      for (var i = 0; i < game.weaponLevel; i++) context.fillRect(18 + i * 14, 38, 10, 6)
    }

    if (game.mode === game.title) {
      context.font = '16px ui-monospace, Menlo, Consolas, monospace'
      context.fillStyle = '#ffffff'
      context.fillText('ARROWS / WASD  MOVE      SPACE / Z  FIRE', game.width / 2, game.height - 70)
    }

    context.restore()
  }
}

module.exports = { Ocean, Hud }
