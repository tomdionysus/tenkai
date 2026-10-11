// Plays a frames script live, in real time, in headless Chrome (no virtual clock: for a game whose parts keep their
// own time, such as a server in a Worker), printing what the script prints and the page's errors, and keeping a
// screenshot every few seconds. Nothing is compared.
//
//   node tools/frames/live.mjs <script.json> [--shots <dir> [--every <seconds>]] [--url <url>]
//
// --url replaces the script's page (the same script with ?server=worker, say). The game's server must be running.
/* global WebSocket */
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const RUNNER = fs.readFileSync(new URL('./runner.js', import.meta.url), 'utf8')

const args = process.argv.slice(2)
const option = (name) => {
  const i = args.indexOf(name)
  if (i < 0) return null
  const v = args[i + 1]
  args.splice(i, 2)
  return v
}
const shots = option('--shots')
const every = Number(option('--every') || 5)
const url = option('--url')
const file = args[0]
if (!file) {
  console.log('usage: node tools/frames/live.mjs <script.json> [--shots <dir> [--every <seconds>]] [--url <url>]')
  process.exit(2)
}
const script = JSON.parse(fs.readFileSync(file, 'utf8'))
if (url) script.url = url
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const port = 9800 + Math.floor(Math.random() * 150)
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'frames-' + process.pid + '-'))
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + profile,
  '--autoplay-policy=no-user-gesture-required', '--window-size=1600,1000', '--hide-scrollbars', '--mute-audio',
  'about:blank'], { stdio: 'ignore' })
const stop = (code) => {
  chrome.kill('SIGKILL')
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch (e) {}
  process.exit(code)
}
process.on('SIGINT', () => stop(130))
for (let i = 0; i < 100; i++) {
  try {
    await fetch(`http://127.0.0.1:${port}/json/version`)
    break
  } catch (e) {
    await sleep(100)
  }
}
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) => { ws.onopen = resolve })
let id = 0
const waiting = {}
let loaded = null
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  if (d.id && waiting[d.id]) {
    waiting[d.id](d.result || { error: d.error })
    delete waiting[d.id]
  }
  if (d.method === 'Page.loadEventFired' && loaded) loaded()
  if (d.method === 'Runtime.exceptionThrown') console.log('page error: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text))
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') console.log('page console.error: ' + d.params.args.map((a) => a.value || a.description).join(' ').slice(0, 800))
}
const send = (method, params = {}) => new Promise((resolve) => {
  const n = ++id
  waiting[n] = resolve
  ws.send(JSON.stringify({ id: n, method, params }))
})
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value
await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
await send('Storage.clearDataForOrigin', { origin: new URL(script.url).origin, storageTypes: 'all' })
await new Promise((resolve) => {
  loaded = resolve
  send('Page.navigate', { url: script.url })
})
await evaluate(RUNNER)
await evaluate('__framesRunner.live(' + JSON.stringify(script) + ')')
if (shots) fs.mkdirSync(shots, { recursive: true })
const started = Date.now()
let printed = 0
let nextShot = every
for (;;) {
  await sleep(250)
  const status = await evaluate('__framesRunner.status')
  for (; printed < status.log.length; printed++) console.log('  ' + status.log[printed])
  const seconds = (Date.now() - started) / 1000
  if (shots && seconds >= nextShot) {
    const png = await send('Page.captureScreenshot', { format: 'png' })
    const name = path.join(shots, path.basename(file, '.json') + '-' + String(Math.round(seconds)).padStart(3, '0') + 's.png')
    fs.writeFileSync(name, Buffer.from(png.data, 'base64'))
    nextShot += every
  }
  if (status.error) {
    console.log(file + ': failed after ' + seconds.toFixed(1) + ' s: ' + status.error)
    stop(1)
  }
  if (!status.running) {
    console.log(file + ': played to the end in ' + seconds.toFixed(1) + ' s (' + status.frame + ' frames)')
    stop(0)
  }
}
