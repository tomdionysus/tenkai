// The HUD over the view: for now the messages Blood shows in the top left (the server's text), held for a few
// seconds each. The status bar and the weapon in hand come with the weapons.
export default class Hud {
  constructor (game) {
    this.game = game
    this.messages = []
  }

  say (text) {
    if (!text) return
    this.messages.push({ text, until: performance.now() + 4000 })
    if (this.messages.length > 4) this.messages.shift()
  }

  draw (context) {
    const now = performance.now()
    this.messages = this.messages.filter((m) => m.until > now)
    const scale = Math.max(1, Math.floor(this.game.height / 240))
    context.save()
    context.font = (8 * scale) + 'px monospace'
    context.textBaseline = 'top'
    this.messages.forEach((m, i) => {
      context.fillStyle = 'black'
      context.fillText(m.text, 4 * scale + 1, 4 * scale + i * 10 * scale + 1)
      context.fillStyle = '#e0c8a0'
      context.fillText(m.text, 4 * scale, 4 * scale + i * 10 * scale)
    })
    context.restore()
  }
}
