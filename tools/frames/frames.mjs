// Frame baselines: run a game in headless Chrome on a virtual clock (tools/frames/page.js), play a script of keys,
// clicks and goals (tools/frames/runner.js, in the page), and keep a hash of every frame and the sounds each frame
// started, so a refactor can be shown to change nothing the player sees or hears.
//
//   node tools/frames/frames.mjs save <script.json>... [--shots <dir> [--every N]]
//   node tools/frames/frames.mjs check <script.json>... [--shots <dir> [--every N]]
//
// `save` writes the baseline next to the script (<name>.baseline.json, or the script's `baseline`); `check`
// runs again and reports the first frame whose picture or sounds differ, with a PNG of that frame. --shots
// saves every Nth frame as a PNG (and the differing one) for a look. While a script runs, a line every few
// seconds says how far it has got.
//
// A script (paths relative to it): "url" (the page; its server must be running), "seed" (Math.random's,
// default 1), "canvas" (a selector for the canvas to hash; default the largest), and its steps (runner.js
// lists them). The same script can be run live in a tab someone watches (tools/frames/serve.mjs).
/* global WebSocket */
import { spawn, execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PAGE = fs.readFileSync(new URL('./page.js', import.meta.url), 'utf8')
const RUNNER = fs.readFileSync(new URL('./runner.js', import.meta.url), 'utf8')

const args = process.argv.slice(2)
const mode = args.shift()
const option = (name) => {
  const i = args.indexOf(name)
  if (i < 0) return null
  const v = args[i + 1]
  args.splice(i, 2)
  return v
}
const shots = option('--shots')
const every = Number(option('--every') || 0)
if (!['save', 'check'].includes(mode) || !args.length) {
  console.log('usage: node tools/frames/frames.mjs save|check <script.json>... [--shots <dir> [--every N]]')
  process.exit(2)
}

// ---- Chrome ----
// A driver killed outright (kill -9, a crash) cannot stop its Chrome, which then runs on with nobody attached.
// So each Chrome's profile is named with its driver's process id, and every run first stops any Chrome whose
// driver is gone.
function clearOrphans () {
  let list = ''
  try {
    list = execFileSync('ps', ['-Ao', 'pid=,command='], { encoding: 'utf8' })
  } catch (e) {
    return
  }
  for (const line of list.split('\n')) {
    const m = /^\s*(\d+)\s.*--headless.*--user-data-dir=\S*frames-(\d+)-/.exec(line)
    if (!m) continue
    let alive = true
    try {
      process.kill(Number(m[2]), 0)
    } catch (e) {
      alive = false
    }
    if (!alive) {
      try {
        process.kill(Number(m[1]), 'SIGKILL')
      } catch (e) {}
    }
  }
}

async function openChrome () {
  const port = 9400 + Math.floor(Math.random() * 400)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'frames-' + process.pid + '-'))
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + profile,
    '--autoplay-policy=no-user-gesture-required', '--window-size=1600,1000', '--hide-scrollbars', '--mute-audio',
    'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`)
      break
    } catch (e) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  return { chrome, port, profile }
}

async function connect (port) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve) => { ws.onopen = resolve })
  let id = 0
  const waiting = {}
  const errors = []
  let onEmit = null
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && waiting[d.id]) {
      waiting[d.id](d.error ? { error: d.error } : d.result)
      delete waiting[d.id]
    }
    if (d.method === 'Runtime.bindingCalled' && d.params.name === '__framesEmit' && onEmit) onEmit(JSON.parse(d.params.payload))
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text)
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'warning' && /\[frames\]/.test(d.params.args[0]?.value)) errors.push(d.params.args[0].value)
  }
  const send = (method, params = {}) => new Promise((resolve) => {
    const n = ++id
    waiting[n] = resolve
    ws.send(JSON.stringify({ id: n, method, params }))
  })
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
    return r.result?.value
  }
  return { ws, send, evaluate, errors, listen: (f) => { onEmit = f } }
}

// ---- one script ----
// Runs the script in the page; with a baseline, the page compares as it goes and stops at the first frame that
// differs, with a PNG of it
async function run (file, port, base) {
  const script = JSON.parse(fs.readFileSync(file, 'utf8'))
  const { ws, send, evaluate, errors, listen } = await connect(port)
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Runtime.addBinding', { name: '__framesEmit' })
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
  const opts = { seed: script.seed === undefined ? 1 : script.seed, canvas: script.canvas || null }
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__framesOptions = ' + JSON.stringify(opts) + ';\n' + PAGE + '\n' + RUNNER })
  // The page may navigate (a game that reloads itself for a new game): the run goes on once it has loaded again
  let loading = true
  let loads = 0
  let onLoad = []
  const loaded = () => loading ? new Promise((resolve) => onLoad.push(resolve)) : Promise.resolve()
  // Until a page loaded after the one counted as `after` has finished
  const loadAfter = (after) => new Promise((resolve) => {
    const wait = () => loads > after ? resolve() : onLoad.push(wait)
    wait()
  })
  {
    const prior = ws.onmessage
    ws.onmessage = (m) => {
      prior(m)
      const method = JSON.parse(m.data).method
      if (method === 'Page.frameStartedLoading') loading = true
      if (method === 'Page.loadEventFired') {
        loading = false
        loads++
        const waiting = onLoad
        onLoad = []
        waiting.forEach((resolve) => resolve())
      }
    }
  }
  // Each script starts with nothing kept from another (localStorage, sessionStorage, caches)
  await send('Storage.clearDataForOrigin', { origin: new URL(script.url).origin, storageTypes: 'all' })
  await send('Page.navigate', { url: script.url })
  await loaded()

  const name = path.basename(file, '.json')
  const total = script.steps ? null : script.frames
  const out = []
  let first = -1
  let position = null
  const started = Date.now()
  let told = started
  process.stderr.write(`  ${name}: running ${total ? total + ' frames' : script.steps.length + ' steps'}\n`)
  listen((m) => {
    if (m.log) return console.log('  ' + m.log)
    out[m.pos.frame - 1] = m.entry
    position = m.pos
    if (m.png) {
      const differs = base && JSON.stringify(base[m.pos.frame - 1]) !== JSON.stringify(m.entry)
      if (differs) first = m.pos.frame - 1
      const file = path.join(shots || os.tmpdir(), `${name}-${differs ? 'differs-' : ''}${String(m.pos.frame).padStart(5, '0')}.png`)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, Buffer.from(m.png.split(',')[1], 'base64'))
    }
    if (Date.now() - told >= 5000) {
      told = Date.now()
      const rate = m.pos.frame / ((told - started) / 1000)
      const left = total ? `, about ${Math.round((total - m.pos.frame) / rate)} s left` : ''
      process.stderr.write(`  ${name}: frame ${m.pos.frame}${total ? ' of ' + total : ''} (${rate.toFixed(0)} a second${left})\n`)
    }
  })
  const call = (from) => `(function () {
    var base = ${JSON.stringify(base)}
    var every = ${shots && every ? every : 0}
    var differs = false
    return window.__frames.settle().then(function () {
      return window.__framesRunner.run(${JSON.stringify(script)}, {
        from: ${JSON.stringify(from)},
        next: function () { return window.__frames.frame() },
        emit: function (e, pos) {
          var entry = e.sounds.length ? [e.hash, e.sounds] : [e.hash]
          var m = { entry: entry, pos: pos }
          if (base && JSON.stringify(base[pos.frame - 1]) !== JSON.stringify(entry)) { differs = true; m.png = window.__frames.png() }
          else if (every && pos.frame % every === 0) m.png = window.__frames.png()
          window.__framesEmit(JSON.stringify(m))
        },
        log: function (text) { window.__framesEmit(JSON.stringify({ log: text })) },
        stopped: function () { return differs || (base && pos0() >= base.length) }
      })
    })
    function pos0 () { return window.__framesRunner.status.frame }
  })()`
  // A page that goes mid-run: the run starts again on the new one from where it was
  for (let from = null; ;) {
    let r
    const page = loads
    try {
      r = await evaluate(call(from))
      // A call cut short by the page going can come back empty rather than failing: the run is not over
      if (!r) r = { leaving: true, position }
    } catch (e) {
      if (!/context|destroyed|navigat|__frames/i.test(e.message)) throw e
      r = { leaving: true, position }
    }
    if (!r.leaving) break
    await loadAfter(page)
    from = r.position || position
  }
  ws.close()
  return { script, out, errors, first }
}

function baselineOf (file) {
  const script = JSON.parse(fs.readFileSync(file, 'utf8'))
  return script.baseline ? path.resolve(path.dirname(file), script.baseline) : file.replace(/\.json$/, '.baseline.json')
}

clearOrphans()
const { chrome, port, profile } = await openChrome()
const stopChrome = () => {
  try {
    chrome.kill('SIGKILL')
  } catch (e) {}
}
process.on('exit', stopChrome)
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    stopChrome()
    process.exit(130)
  })
}
process.on('uncaughtException', (e) => {
  console.error(e.message)
  stopChrome()
  process.exit(1)
})
let failed = 0
try {
  for (const file of args) {
    const started = Date.now()
    const target = baselineOf(file)
    let base = null
    if (mode === 'check') {
      if (!fs.existsSync(target)) {
        console.log(`${file}: no baseline at ${target}`)
        failed++
        continue
      }
      base = JSON.parse(fs.readFileSync(target, 'utf8')).frames
    }
    const { script, out, errors, first } = await run(file, port, base)
    const seconds = ((Date.now() - started) / 1000).toFixed(1)
    for (const e of errors) console.log(`  page error: ${e}`)
    if (mode === 'save') {
      fs.writeFileSync(target, JSON.stringify({ url: script.url, seed: script.seed, frames: out }) + '\n')
      console.log(`${file}: ${out.length} frames saved to ${target} (${seconds} s)`)
      continue
    }
    if (first < 0 && out.length === base.length) {
      console.log(`${file}: ${out.length} frames identical (${seconds} s)`)
      continue
    }
    failed++
    if (first < 0) {
      console.log(`${file}: ${out.length} frames run, the baseline has ${base.length}`)
      continue
    }
    const a = base[first] || []
    const b = out[first] || []
    const what = []
    if (a[0] !== b[0]) what.push(`picture ${a[0]} -> ${b[0]}`)
    if (JSON.stringify(a[1] || []) !== JSON.stringify(b[1] || [])) what.push(`sounds ${JSON.stringify(a[1] || [])} -> ${JSON.stringify(b[1] || [])}`)
    console.log(`${file}: frame ${first + 1} differs: ${what.join(', ')} (PNG in ${shots || os.tmpdir()})`)
  }
} finally {
  const exited = new Promise((resolve) => chrome.once('exit', resolve))
  chrome.kill()
  await exited
  try {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  } catch (e) {}
}
process.exit(failed ? 1 : 0)
