// Dumps the original's files: what each holds, as the readers in formats/ see them.
//   node tools/dump.mjs rff <file.rff> [type]        the directory (of one type)
//   node tools/dump.mjs cat <file.rff> <NAME.TYP>    a file's bytes to stdout
import RFF from '../formats/rff.mjs'

const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'rff') {
  const rff = RFF.load(args[0])
  const types = {}
  for (const e of rff.entries) (types[e.type] = types[e.type] || []).push(e)
  console.log(args[0] + ': version ' + rff.version.toString(16) + ', ' + rff.entries.length + ' files')
  for (const [type, list] of Object.entries(types).sort()) {
    const bytes = list.reduce((s, e) => s + e.size, 0)
    const crypt = list.filter((e) => e.flags & 0x10).length
    console.log('  %s %d files, %d bytes, %d encrypted', type.padEnd(4), list.length, bytes, crypt)
    if (args[1] && args[1].toUpperCase() === type.toUpperCase()) for (const e of list) console.log('    %s %d bytes id %d flags %s', e.key.padEnd(13), e.size, e.id, e.flags.toString(16))
  }
} else if (cmd === 'cat') {
  process.stdout.write(RFF.load(args[0]).read(args[1]))
} else console.log('usage: dump.mjs rff|cat ...')
