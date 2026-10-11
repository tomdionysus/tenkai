// Watch the specs run in a browser tab: serves spec/browser/index.html on 127.0.0.1 and, for each visit, runs
// Jasmine (in Node, as `npm test` does: the specs mock the DOM) and streams every result to the page.
//   node spec/browser/server.js [port]      then open http://127.0.0.1:8060/
import http from 'http'
import fs from 'fs'
import { spawn } from 'child_process'

const root = new URL('../../', import.meta.url).pathname
const port = Number(process.argv[2] || 8060)

http.createServer((req, res) => {
  if (req.url === '/run') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
    const run = spawn(process.execPath, ['node_modules/jasmine/bin/jasmine.js', '--reporter=spec/browser/reporter.js'], { cwd: root })
    let rest = ''
    run.stdout.on('data', (chunk) => {
      const lines = (rest + chunk).split('\n')
      rest = lines.pop()
      for (const line of lines) if (line.startsWith('{')) res.write('data: ' + line + '\n\n')
    })
    run.stderr.on('data', (chunk) => res.write('data: ' + JSON.stringify({ event: 'stderr', text: String(chunk) }) + '\n\n'))
    run.on('close', (code) => { res.write('data: ' + JSON.stringify({ event: 'exit', code }) + '\n\n'); res.end() })
    req.on('close', () => run.kill())
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(fs.readFileSync(new URL('index.html', import.meta.url)))
}).listen(port, '127.0.0.1', () => console.log('specs at http://127.0.0.1:' + port + '/'))
