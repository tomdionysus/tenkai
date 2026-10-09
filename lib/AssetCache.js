/**
 * AssetCache loads images by path on demand and caches them, for games with too many images to define
 * up front with [addAsset()]{@link GameEngine#addAsset}, such as the hundreds of pre-rendered views of a
 * point-and-click adventure.
 *
 * @example
const cache = new AssetCache({ base: 'images/' })
const view = cache.image('dock.jpg')
view.ready.then((img) => { if (img) context.drawImage(img, 0, 0) })
 */
class AssetCache {
  /**
   * @param {object} options
   * @param {string} options.base Prefix for every path (optional)
   */
  constructor (options = {}) {
    this.base = options.base || ''
    this._images = {}
  }

  /**
   * Get an image, starting to load it if needed.
   * @param {string} src Path relative to the base
   * @returns {{element: HTMLImageElement, ready: Promise<HTMLImageElement|null>}} The element, and a promise
   * that resolves with it once loaded, or with null if it failed to load.
   */
  image (src) {
    if (!this._images[src]) {
      var element = document.createElement('img')
      // onload rather than decode(): browsers may defer decode() while a tab is in the background
      var ready = new Promise((resolve) => {
        element.onload = () => resolve(element)
        element.onerror = () => resolve(null)
      })
      element.src = this.base + src
      this._images[src] = { element, ready }
    }
    return this._images[src]
  }

  /**
   * Load several images.
   * @param {string[]} srcs Paths relative to the base
   * @returns {Promise<Array>} Resolves when all have loaded or failed
   */
  preload (srcs) {
    return Promise.all(srcs.map((src) => this.image(src).ready))
  }

  /**
   * Whether an image has finished loading successfully.
   * @param {string} src Path relative to the base
   */
  loaded (src) {
    var entry = this._images[src]
    return !!(entry && entry.element.complete && entry.element.naturalWidth)
  }
}

module.exports = AssetCache
