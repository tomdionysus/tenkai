const STYLE = `
  position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.85); z-index: 10; font: 15px/1.5 system-ui, sans-serif; color: #ccc;
`
const PANEL = 'background: #111; border: 1px solid #555; padding: 24px 28px; width: min(460px, 90vw); box-sizing: border-box;'

/**
 * The config screen for a game server's address: an HTML form over the game (text entry is the browser's own), for
 * a {@link ServerFinder} to show when the page cannot reach a server or loses its connection. It says why, offers
 * an address to try, and answers with what the player entered. The game's own keys stay out of the form.
 *
 * @example
const config = new ServerConfig({ document, example: 'ws://192.168.1.10:8053/game' })
const address = await config.ask({ message: 'Could not connect.', address: 'ws://127.0.0.1:8053/game' })
config.hide()
 */
class ServerConfig {
  /**
   * @param {object} options
   * @param {Document} options.document The page's document
   * @param {string} options.title The screen's heading (default `Game server`)
   * @param {string} options.example An address shown as an example under the field (optional)
   */
  constructor ({ document, title = 'Game server', example = 'ws://192.168.1.10:8053/game' }) {
    this.document = document
    this.title = title
    this.example = example
    this.root = null
  }

  /**
   * Show the screen: `message` says why (the connection failed, it was lost), `address` fills the field. Resolves
   * with the address entered (trimmed, with ws:// added when no scheme is given), when the player connects.
   */
  ask ({ message, address }) {
    this.hide()
    const d = this.document
    const root = d.createElement('div')
    root.setAttribute('style', STYLE)
    root.innerHTML = `
      <form style="${PANEL}">
        <h1 style="margin: 0 0 8px; font-size: 18px; color: #eee;"></h1>
        <p class="why" style="margin: 0 0 16px;"></p>
        <label style="display: block; margin-bottom: 6px;">Server address
        <input name="address" spellcheck="false" autocomplete="off"
          style="display: block; margin-top: 6px; width: 100%; box-sizing: border-box; padding: 8px; font: 15px monospace; background: #000; color: #eee; border: 1px solid #666;"></label>
        <p class="example" style="margin: 8px 0 16px; font-size: 13px; color: #888;"></p>
        <button type="submit" style="padding: 8px 18px; font: inherit; background: #333; color: #eee; border: 1px solid #777; cursor: pointer;">Connect</button>
      </form>`
    root.querySelector('h1').textContent = this.title
    root.querySelector('.why').textContent = message
    root.querySelector('.example').textContent = this.example ? 'For example ' + this.example : ''
    const input = root.querySelector('input')
    input.value = address || ''
    root.addEventListener('keydown', (e) => e.stopPropagation())
    root.addEventListener('keyup', (e) => e.stopPropagation())
    d.body.appendChild(root)
    this.root = root
    input.focus()
    input.select()
    return new Promise((resolve) => {
      root.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault()
        const address = ServerConfig.address(input.value)
        if (address) resolve(address)
      })
    })
  }

  /** What the player typed as an address: trimmed, with ws:// added when no scheme is given; null if empty. */
  static address (typed) {
    const raw = typed.trim()
    if (!raw) return null
    return /^wss?:\/\//.test(raw) ? raw : 'ws://' + raw
  }

  /** Say something new on the screen while it shows (connecting, failed again). */
  say (message) {
    if (this.root) this.root.querySelector('.why').textContent = message
  }

  /** Take the screen away. */
  hide () {
    if (this.root) this.root.remove()
    this.root = null
  }
}

export default ServerConfig
