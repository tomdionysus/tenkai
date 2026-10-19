import Screen from './Screen.js'
import IndexedSurface from './IndexedSurface.js'
import IndexedScene from './IndexedScene.js'

/**
 * A {@link Screen} drawn in palette numbers, as old games draw their windows and full screens: it owns an
 * {@link IndexedSurface} of its size, shown through a {@link Palette} by an {@link IndexedScene}, and paints it
 * afresh before each drawing (`paint(surface)`, which a subclass overrides), so what it shows follows the game's
 * state every frame. A transparent surface lets the game show through wherever the window paints nothing. Its
 * `palette` may be changed at any time (a window shown through the game's palette dimmed, a picture's own).
 *
 * @example
class Funds extends IndexedScreen {
  constructor (game) {
    super({ width: 320, height: 200, palette: windowPalette, transparent: true, modal: true })
    this.game = game
  }
  paint (surface) {
    surface.clear()
    frames.draw(surface, 'body', 0, 32)
    text.draw(surface, 'MONEY: ' + this.game.money, 16, 40, { colours: { 1: 28 } })
  }
}
 */
class IndexedScreen extends Screen {
  /**
   * @param {object} options As a Screen's, and:
   * @param {Palette} options.palette Its colours
   * @param {boolean} options.transparent Whether what it does not paint shows what is under it (default false)
   * @param {function} options.createCanvas For its scene, as {@link IndexedScene}'s (optional)
   */
  constructor (options = {}) {
    super(options)
    this.surface = new IndexedSurface({ width: this.width, height: this.height, transparent: !!options.transparent })
    this.picture = this.addScene('picture', new IndexedScene({ surface: this.surface, palette: options.palette, createCanvas: options.createCanvas }))
  }

  /** The palette it is shown through. */
  get palette () {
    return this.picture.palette
  }

  set palette (palette) {
    this.picture.palette = palette
  }

  /** Painted afresh, then drawn as a Screen is. */
  draw (context) {
    this.paint(this.surface)
    super.draw(context)
  }

  /**
   * What it shows, painted into its surface before each drawing. Does nothing; override it.
   * @param {IndexedSurface} surface
   */
  paint (surface) {}
}

export default IndexedScreen
