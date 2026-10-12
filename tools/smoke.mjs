// Smoke test of the Tenkai games: each served by esbuild (built in memory, nothing written), loaded in headless
// Chrome, started (a click and Space), run a few seconds; page errors reported, the largest canvas checked for
// drawing, and a screenshot of each saved. For checking that a change to Tenkai leaves the other games working
// (no baselines compared).
//
//   node tools/smoke.mjs [outdir] [game...]        (default outdir: a temporary folder; games: all)
/* global WebSocket */
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const args = process.argv.slice(2)
const OUT = args[0] && !args[0].match(/^[a-z0-9-]+$/) ? args.shift() : fs.mkdtempSync(path.join(os.tmpdir(), 'tenkai-smoke-'))
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
// Samples the page's largest canvas: its size and how many colours a sparse grid of its pixels has
const SAMPLE = `(() => {
  const cs = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)
  if (!cs.length) return 'no canvas'
  const c = cs[0]
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  const seen = new Set()
  for (let i = 0; i < d.length; i += 4 * 97) seen.add(d[i] << 16 | d[i + 1] << 8 | d[i + 2])
  return c.width + 'x' + c.height + ', ' + seen.size + ' colours sampled'
})()`
const games = [
  ['1945', 'examples/1945', 'examples/1945/main.js'],
  ['arkanoid', 'examples/arkanoid', 'examples/arkanoid/main.js'],
  ['tim', 'examples/tim-the-enchanter', 'examples/tim-the-enchanter/main.js'],
  ['golden-axe', 'local/golden-axe', 'local/golden-axe/src/main.js'],
  ['myst', 'local/myst', 'local/myst/src/main.js'],
  ['monkey2', 'local/monkey2', 'local/monkey2/src/main.js']
]
const only = args
fs.mkdirSync(OUT, { recursive: true })
console.log('screenshots in ' + OUT)
let port = 8600
for (const [name, dir, entry] of games) {
  if (only.length && !only.includes(name)) continue
  port++
  const esb = spawn(path.join(ROOT, 'node_modules/.bin/esbuild'), [entry, '--bundle', '--outfile=' + dir + '/bundle.js', '--servedir=' + dir, '--serve=127.0.0.1:' + port], { cwd: ROOT, stdio: ['pipe', 'ignore', 'ignore'] })
  const cport = 9500 + Math.floor(Math.random() * 90)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-'))
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + cport, '--user-data-dir=' + profile, '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' })
  const errors = []
  try {
    // The game's server answering first (esbuild takes a moment to build)
    let up = false
    for (let i = 0; i < 100 && !up; i++) { try { up = (await fetch(`http://127.0.0.1:${port}/`)).ok } catch (e) { await sleep(100) } }
    if (!up) throw new Error('the game server did not answer')
    for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${cport}/json/version`); break } catch (e) { await sleep(100) } }
    const target = await (await fetch(`http://127.0.0.1:${cport}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve) => { ws.onopen = resolve })
    let n = 0
    const waiting = {}
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data)
      if (d.id && waiting[d.id]) { waiting[d.id](d.result); delete waiting[d.id] }
      if (d.method === 'Runtime.exceptionThrown') errors.push(String(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 300))
      if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('console: ' + JSON.stringify(d.params.args.map((a) => a.description || a.value)).slice(0, 300))
    }
    const send = (method, params = {}) => new Promise((resolve) => { n++; waiting[n] = resolve; ws.send(JSON.stringify({ id: n, method, params })) })
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/` })
    await sleep(2500)
    for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: 640, y: 400, button: 'left', clickCount: 1 })
    await sleep(800)
    for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: ' ', code: 'Space', windowsVirtualKeyCode: 32 })
    // A canvas drawing something: its largest canvas, sampled for colours three times over a few seconds (a game
    // may be between scenes, black, at any one moment); the best look counts
    let drawn = 'unknown'
    let best = -1
    for (let k = 0; k < 3; k++) {
      await sleep(1500)
      const look = await send('Runtime.evaluate', { returnByValue: true, expression: SAMPLE })
      const value = (look.result && look.result.value) || 'unknown'
      const colours = Number((value.match(/, (\d+) colours/) || [0, -1])[1])
      if (colours > best) {
        best = colours
        drawn = value
      }
    }
    if (best < 2) errors.push('not drawing: ' + drawn)
    else errors.drawn = drawn
    const png = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(png.data, 'base64'))
    ws.close()
  } catch (e) {
    errors.push('smoke: ' + e.message)
  } finally {
    chrome.kill()
    esb.kill()
  }
  console.log(name.padEnd(11), errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'ok: no page errors, canvas ' + errors.drawn)
}
