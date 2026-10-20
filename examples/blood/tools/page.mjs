// Drives a page in headless Chromium through the DevTools protocol: load it, run expressions in it, press keys,
// save screenshots. For checking the client by script (the view, the HUD, a whole game against the server).
//   const page = await Page.open('http://127.0.0.1:8471/fly.html', { width: 960, height: 600 })
//   await page.eval('fly.view.eye.ang = 512'); await page.shot('out.png'); await page.close()
// Command line: node tools/page.mjs <url> <out.png> [expression ...]   (each run in order, a frame apart)
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const CHROME = process.env.CHROME || '/usr/bin/chromium'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export default class Page {
  static async open (url, options = {}) {
    const page = new Page()
    const port = 9300 + Math.floor(Math.random() * 600)
    page.profile = fs.mkdtempSync(path.join(os.tmpdir(), 'blood-page-'))
    page.chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--remote-debugging-port=' + port, '--user-data-dir=' + page.profile, '--mute-audio',
      '--autoplay-policy=no-user-gesture-required', '--window-size=' + (options.width || 960) + ',' + (options.height || 600), 'about:blank'], { stdio: 'ignore' })
    for (let i = 0; i < 100; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break } catch (e) { await sleep(100) } }
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
    page.ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve) => { page.ws.onopen = resolve })
    page.n = 0
    page.waiting = {}
    page.errors = []
    page.logs = []
    page.ws.onmessage = (m) => {
      const d = JSON.parse(m.data)
      if (d.id && page.waiting[d.id]) { page.waiting[d.id](d.result || { error: d.error }); delete page.waiting[d.id] }
      if (d.method === 'Runtime.exceptionThrown') page.errors.push(String(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 500))
      if (d.method === 'Runtime.consoleAPICalled') {
        const text = d.params.args.map((a) => a.value !== undefined ? a.value : a.description).join(' ')
        if (d.params.type === 'error') page.errors.push('console: ' + text.slice(0, 500))
        page.logs.push(text)
      }
    }
    await page.send('Runtime.enable')
    await page.send('Emulation.setDeviceMetricsOverride', { width: options.width || 960, height: options.height || 600, deviceScaleFactor: 1, mobile: false })
    await page.send('Page.navigate', { url })
    if (options.ready) await page.until(options.ready, options.timeout || 20000)
    return page
  }

  send (method, params = {}) {
    return new Promise((resolve) => { this.n++; this.waiting[this.n] = resolve; this.ws.send(JSON.stringify({ id: this.n, method, params })) })
  }

  /** An expression's value in the page (awaited if a promise) */
  async eval (expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error('page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
    return r.result ? r.result.value : undefined
  }

  /** Waits until an expression holds */
  async until (expression, timeout = 20000) {
    const end = Date.now() + timeout
    while (Date.now() < end) {
      try { if (await this.eval(expression)) return true } catch (e) {}
      await sleep(100)
    }
    throw new Error('timed out waiting for ' + expression + (this.errors.length ? '; page errors: ' + this.errors.join(' | ') : ''))
  }

  async key (code, type = 'both', key) {
    const k = key || (code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code === 'Space' ? ' ' : code)
    for (const t of type === 'both' ? ['keyDown', 'keyUp'] : [type]) await this.send('Input.dispatchKeyEvent', { type: t, code, key: k })
  }

  async click (x, y) {
    for (const type of ['mousePressed', 'mouseReleased']) await this.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 })
  }

  async shot (file) {
    const png = await this.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(file, Buffer.from(png.data, 'base64'))
  }

  async close () {
    try { this.ws.close() } catch (e) {}
    this.chrome.kill()
    try { fs.rmSync(this.profile, { recursive: true, force: true }) } catch (e) {}
  }
}

if (process.argv[1] && process.argv[1].endsWith('page.mjs') && process.argv.length > 3) {
  const [url, out, ...exprs] = process.argv.slice(2)
  const page = await Page.open(url)
  try {
    await sleep(1500)
    for (const e of exprs) { const v = await page.eval(e); if (v !== undefined) console.log(typeof v === 'string' ? v : JSON.stringify(v)); await sleep(200) }
    await page.shot(out)
  } finally {
    if (page.errors.length) console.log('page errors:', page.errors.join(' | '))
    await page.close()
  }
}
