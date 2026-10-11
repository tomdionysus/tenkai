// Serves the repository on 127.0.0.1 (read only, any origin may read it), so a frames script can be run live in a
// tab someone is watching: the game's page loads tools/frames/runner.js and the script from here.
//
//   node tools/frames/serve.mjs [port]          (default 8070)
//
// Then, in the game's tab (its own console, or a tool driving it):
//   await new Promise((resolve) => document.head.appendChild(Object.assign(document.createElement('script'),
//     { src: 'http://127.0.0.1:8070/tools/frames/runner.js', onload: resolve })))
//   __framesRunner.live(await (await fetch('http://127.0.0.1:8070/local/wreckers/frames/lifts.json')).json())
//   __framesRunner.status                       how far it has got, what it printed, why it failed
//   __framesRunner.stop()
// A live run takes the game's frames in real time, as it happens to draw them, so goals ("press" ... "until",
// "wait") matter more than frame counts there.
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const PORT = Number(process.argv[2] || 8070)
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' }

http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Access-Control-Allow-Origin': '*' })
    return res.end()
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' })
  fs.createReadStream(file).pipe(res)
}).listen(PORT, '127.0.0.1', () => console.log(`frames: serving ${ROOT} on http://127.0.0.1:${PORT}`))
