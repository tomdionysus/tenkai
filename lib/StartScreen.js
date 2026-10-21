import TenkaiLogo from './TenkaiLogo.js'

/**
 * The screen a game shows before it starts: its cover art (if it has one) over its title, its publisher and year,
 * a gently pulsing "Click or press any key to start", and Tenkai's logo in the corner. Browsers let a page play sound only after the
 * player has clicked or pressed a key, so a game waits here for that first touch (the engine's `startScreen`
 * option shows one before `init`).
 *
 * It fits whatever it is shown on. On a page it draws on a canvas of its own laid over the window (or over the
 * game's canvas), at the screen's own pixel density, and lays itself out again whenever the window or the game
 * changes size: sizes follow the shorter side, a title too wide for a narrow window shrinks to fit, and the
 * logo stays in the corner. Without a page (in tests) it draws on the game's canvas instead.
 *
 * @example
new StartScreen({ title: 'WRECKERS', publisher: 'Audiogenic Software', year: 1991, cover: 'cover.png' })
  .show({ element: game.element, window, document, onStart: () => begin() })
 */
class StartScreen {
  /**
   * @param {object} options
   * @param {string} options.title Large text in the middle (default: the page's title)
   * @param {string} options.publisher The original publisher, under the title (optional)
   * @param {string|number} options.year The year, before the publisher (optional)
   * @param {string} options.subtitle The line under the title, instead of the year and publisher (optional)
   * @param {string} options.prompt Default 'Click or press any key to start'
   * @param {string|object|null} options.logo An image or its URL for the corner; default Tenkai's logo, null
   *   for none
   * @param {string} options.logoColor Draw the logo all in this colour (default: the text colour; '' for the
   *   logo's own colours)
   * @param {number} options.logoHeight The logo's height in pixels (default: a seventh of the shorter side)
   * @param {string|object} options.cover Cover art, an image or its URL, above the title in the middle of the screen,
   *   all of it centred together (optional)
   * @param {number} options.coverHeight The cover's height as a share of the shorter side (default 0.5); it is
   *   kept within the screen's width and the space left above the title
   * @param {string} options.background Default 'black'
   * @param {string} options.color Default '#e8e8e8'
   * @param {string} options.fontFamily Default 'sans-serif'
   * @param {string} options.titleFont, options.subtitleFont, options.font CSS fonts, instead of the sized ones
   * @param {string} options.fit 'viewport' (default) to cover the window, 'canvas' to cover the game's canvas
   */
  constructor (options = {}) {
    this.title = options.title
    this.publisher = options.publisher || ''
    this.year = options.year === undefined ? '' : String(options.year)
    this.subtitle = options.subtitle !== undefined ? options.subtitle : [this.year, this.publisher].filter((s) => s).join('  ')
    this.prompt = options.prompt || 'Click or press any key to start'
    this.logo = options.logo === undefined ? TenkaiLogo : options.logo
    this.background = options.background || 'black'
    this.color = options.color || '#e8e8e8'
    this.logoColor = options.logoColor === undefined ? this.color : options.logoColor
    this.logoHeight = options.logoHeight || null
    this.cover = options.cover || null
    this.coverHeight = options.coverHeight || 0.5
    this.fontFamily = options.fontFamily || 'sans-serif'
    this.titleFont = options.titleFont || null
    this.subtitleFont = options.subtitleFont || null
    this.font = options.font || null
    this.fit = options.fit || 'viewport'
    this.showing = false
    this._tinted = null
  }

  /**
   * Where everything goes on a screen `width` by `height` (in CSS pixels): font sizes, the lines' centres, the
   * cover's box and the logo's. Sizes follow the shorter side, so a tall narrow window gets the same proportions
   * as a wide one. With a cover, the cover and the lines under it are centred on the screen together.
   * @returns {object} { unit, title: { size, y }, subtitle: { size, y }, prompt: { size, y }, cover: { x, y,
   *   width, height } | null, logo: { x, y, width, height } | null, margin }
   */
  layout (width, height) {
    var unit = Math.min(width, height)
    var title = { size: Math.round(unit / 12), y: height / 2 - unit / 12 }
    var subtitle = { size: Math.round(unit / 28), y: title.y + unit / 14 }
    var prompt = { size: Math.round(unit / 24), y: height / 2 + unit / 12 }
    var margin = Math.round(unit / 40)
    var cover = null
    var art = this._coverImage
    if (art && art.complete && art.naturalWidth) {
      // The lines take from the title's top to the prompt's bottom; the cover goes above them with a gap, all
      // of it in the middle, the cover kept to the space the lines leave and to the screen's width
      var lines = (prompt.y + prompt.size / 2) - (title.y - title.size / 2)
      var gap = Math.round(unit / 24)
      var ch = Math.min(Math.round(unit * this.coverHeight), height - lines - gap - margin * 2)
      var cw = Math.round(ch * art.naturalWidth / art.naturalHeight)
      if (cw > width - margin * 2) {
        cw = width - margin * 2
        ch = Math.round(cw * art.naturalHeight / art.naturalWidth)
      }
      if (ch > 0) {
        var top = Math.round((height - (ch + gap + lines)) / 2)
        cover = { x: Math.round((width - cw) / 2), y: top, width: cw, height: ch }
        var shift = top + ch + gap + title.size / 2 - title.y
        title.y += shift
        subtitle.y += shift
        prompt.y += shift
      }
    }
    var logo = null
    var image = this._logoImage
    if (image && image.complete && image.naturalWidth) {
      var lh = this.logoHeight || Math.round(unit / 7)
      var lw = Math.round(lh * image.naturalWidth / image.naturalHeight)
      logo = { x: width - lw - margin, y: height - lh - margin, width: lw, height: lh }
    }
    return { unit, title, subtitle, prompt, cover, logo, margin }
  }

  /**
   * Draw the screen on a 2D context `width` by `height`, at time `now` (milliseconds, for the prompt's pulse).
   */
  draw (context, width, height, now) {
    var title = this.title !== undefined ? this.title : ((this._document && this._document.title) || '')
    var l = this.layout(width, height)
    context.save()
    context.fillStyle = this.background
    context.fillRect(0, 0, width, height)
    if (l.cover) context.drawImage(this._coverImage, l.cover.x, l.cover.y, l.cover.width, l.cover.height)
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = this.color
    if (title) {
      context.font = this.titleFont || ('bold ' + l.title.size + 'px ' + this.fontFamily)
      // A title wider than the screen shrinks to fit it
      if (!this.titleFont && context.measureText) {
        var w = context.measureText(title).width
        if (w > width * 0.9) context.font = 'bold ' + Math.floor(l.title.size * width * 0.9 / w) + 'px ' + this.fontFamily
      }
      context.fillText(title, width / 2, l.title.y)
    }
    if (this.subtitle) {
      context.font = this.subtitleFont || (l.subtitle.size + 'px ' + this.fontFamily)
      context.fillText(this.subtitle, width / 2, l.subtitle.y)
    }
    if (l.logo) context.drawImage(this._tintedLogo(l.logo.width, l.logo.height) || this._logoImage, l.logo.x, l.logo.y, l.logo.width, l.logo.height)
    context.globalAlpha = 0.55 + 0.45 * Math.sin((now || 0) / 400)
    context.font = this.font || (l.prompt.size + 'px ' + this.fontFamily)
    context.fillText(this.prompt, width / 2, l.prompt.y)
    context.restore()
  }

  // The logo all in logoColor, made once per size
  _tintedLogo (width, height) {
    if (!this.logoColor || !this._document || !this._document.createElement) return null
    var t = this._tinted
    if (t && t.width === width && t.height === height) return t
    t = this._document.createElement('canvas')
    t.width = width
    t.height = height
    var c = t.getContext ? t.getContext('2d') : null
    if (!c) return null
    c.drawImage(this._logoImage, 0, 0, width, height)
    c.globalCompositeOperation = 'source-in'
    c.fillStyle = this.logoColor
    c.fillRect(0, 0, width, height)
    this._tinted = t
    return t
  }

  /**
   * Show the screen until the player clicks, taps or presses a key (not Tab or a modifier on its own, so
   * keyboard users can move focus), then take it away and call `onStart`.
   * @param {object} where { element: the game's canvas, window, document, onStart }
   */
  show (where) {
    var win = where.window
    var doc = where.document || (win && win.document)
    var element = where.element
    this._document = doc
    this.showing = true
    if (typeof this.logo === 'string') {
      this._logoImage = win && win.Image ? new win.Image() : null
      if (this._logoImage) this._logoImage.src = this.logo
    } else this._logoImage = this.logo
    if (typeof this.cover === 'string') {
      this._coverImage = win && win.Image ? new win.Image() : null
      if (this._coverImage) this._coverImage.src = this.cover
    } else this._coverImage = this.cover

    // On a page: a canvas of its own over the window (or the game's canvas); otherwise the game's canvas
    var overlay = null
    if (doc && doc.body && doc.createElement && win && win.getComputedStyle) {
      overlay = doc.createElement('canvas')
      overlay.className = 'tenkai-start-screen'
      Object.assign(overlay.style, { position: 'fixed', left: '0px', top: '0px', zIndex: 2147483000, cursor: 'pointer', display: 'block' })
      doc.body.appendChild(overlay)
    }
    var target = overlay || element
    var context = target.getContext('2d')
    var frame = null
    var size = ''

    var draw = (now) => {
      if (!this.showing) return
      var width = element.width
      var height = element.height
      if (overlay) {
        // The area to cover, in CSS pixels, and the screen's pixel density
        var r = { x: 0, y: 0, width: win.innerWidth, height: win.innerHeight }
        if (this.fit === 'canvas' && element.getBoundingClientRect) {
          var b = element.getBoundingClientRect()
          var x0 = Math.max(0, b.left)
          var y0 = Math.max(0, b.top)
          r = { x: x0, y: y0, width: Math.max(1, Math.min(win.innerWidth, b.right) - x0), height: Math.max(1, Math.min(win.innerHeight, b.bottom) - y0) }
        }
        var density = win.devicePixelRatio || 1
        var key = [r.x, r.y, r.width, r.height, density].join(',')
        if (key !== size) {
          size = key
          Object.assign(overlay.style, { left: r.x + 'px', top: r.y + 'px', width: r.width + 'px', height: r.height + 'px' })
          overlay.width = Math.round(r.width * density)
          overlay.height = Math.round(r.height * density)
        }
        context.setTransform(density, 0, 0, density, 0, 0)
        width = r.width
        height = r.height
      }
      this.draw(context, width, height, now)
      frame = win && win.requestAnimationFrame ? win.requestAnimationFrame(draw) : null
    }

    var go = (e) => {
      if (!this.showing) return
      if (e && e.type === 'keydown' && (e.key === 'Tab' || e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta')) return
      this.hide()
      if (where.onStart) where.onStart(e)
    }
    this._hide = () => {
      target.removeEventListener('pointerdown', go)
      if (overlay && element) element.removeEventListener('pointerdown', go)
      if (win) win.removeEventListener('keydown', go)
      if (frame !== null && win && win.cancelAnimationFrame) win.cancelAnimationFrame(frame)
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay)
    }
    target.addEventListener('pointerdown', go)
    if (overlay && element) element.addEventListener('pointerdown', go)
    if (win) win.addEventListener('keydown', go)
    draw()
    return this
  }

  /** Take the screen away without starting. */
  hide () {
    if (!this.showing) return
    this.showing = false
    if (this._hide) this._hide()
  }
}

export default StartScreen
