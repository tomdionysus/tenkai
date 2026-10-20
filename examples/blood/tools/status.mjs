// Writes status/status.json for status.html (the "as it is" page the user watches): the plan, the record's last
// lines, the recent commits, and the newest pictures given (copied into status/).
//   node tools/status.mjs "what is happening now" [image.png caption] ...
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const OUT = path.join(ROOT, 'status')
const [now = '', ...pairs] = process.argv.slice(2)
const old = fs.existsSync(path.join(OUT, 'status.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'status.json'))) : { images: [] }
const images = []
for (let i = 0; i + 1 < pairs.length; i += 2) {
  const name = Date.now() + '-' + path.basename(pairs[i])
  fs.copyFileSync(pairs[i], path.join(OUT, name))
  images.push({ file: name, caption: pairs[i + 1] })
}
const all = images.length ? images.concat(old.images).slice(0, 12) : old.images
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png') && !all.some((x) => x.file === f)) fs.unlinkSync(path.join(OUT, f))
const status = {
  updated: new Date().toISOString(),
  now: now || old.now,
  active: fs.readFileSync(path.join(ROOT, 'TODO/ACTIVE.md'), 'utf8'),
  commits: execSync('git log --oneline -12 -- .', { cwd: ROOT }).toString().trim().split('\n'),
  images: all
}
fs.writeFileSync(path.join(OUT, 'status.json'), JSON.stringify(status, null, 1))
console.log('status written:', status.now)
