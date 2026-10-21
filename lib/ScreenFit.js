/**
 * ScreenFit places a screen of a fixed size (an old game's 320 by 200) in a window of any size: as large as fits,
 * keeping its shape, and where in the window it sits. The old screens were shown on 4:3 monitors with pixels
 * taller than wide (320 by 200 filled a 4:3 screen, so each pixel was 1.2 times as tall as wide): `pixelAspect`
 * keeps that look, so what was drawn for the original's screen comes out the shape it had.
 *
 * The answer places the screen's pixels: a point (x, y) on the screen is at (`x + x * scaleX`, `y + y * scaleY`)
 * in the window. A HUD drawn in the original's coordinates uses it as its frame; a 3D view behind it fills the
 * window and does not need it.
 *
 * @example
const f = ScreenFit.fit({ width: 320, height: 200 }, { width: 1920, height: 1080 }, { pixelAspect: 1.2, align: 'bottom' })
// f.scaleX 4.5, f.scaleY 5.4, f.x 240, f.y 0: the 320x200 screen is 1440 by 1080, centred, at the bottom
context.drawImage(statusBar, f.x + 34 * f.scaleX, f.y + 187 * f.scaleY, 68 * f.scaleX, 26 * f.scaleY)
 */
class ScreenFit {
  /**
   * @param {object} screen `{ width, height }` in the screen's own pixels
   * @param {object} window `{ width, height }` the space to fit it in
   * @param {object} options
   * @param {number} options.pixelAspect How much taller than wide a screen pixel is shown (default 1)
   * @param {string} options.align Where the screen sits when the window is taller than it: 'middle' (default),
   *   'top' or 'bottom' (a HUD at the bottom of a 3D view that fills the window)
   * @param {boolean} options.integer Scale by whole numbers only (default false): sharper for pixel art, with
   *   a border; never under 1
   * @returns {object} `{ x, y, width, height, scaleX, scaleY, scale }`: where the screen is in the window and its
   *   size there, the scales of its pixels, and the scale across (the one `integer` applies to)
   */
  static fit (screen, window, options = {}) {
    var aspect = options.pixelAspect || 1
    var scale = Math.min(window.width / screen.width, window.height / (screen.height * aspect))
    if (options.integer) scale = Math.max(1, Math.floor(scale))
    var width = screen.width * scale
    var height = screen.height * scale * aspect
    var x = (window.width - width) / 2
    var y = options.align === 'top' ? 0 : options.align === 'bottom' ? window.height - height : (window.height - height) / 2
    return { x, y, width, height, scaleX: scale, scaleY: scale * aspect, scale }
  }
}

export default ScreenFit
