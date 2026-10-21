// Renders Blood's music (SOUNDS.RFF *.MID, General MIDI) to MP3 for the client: FluidSynth (compiled to WebAssembly,
// js-synthesizer) through a General MIDI soundfont, encoded by lamejs. Blood played these on a GM device (or OPL FM
// with GMTIMBRE.TMB); a GM soundfont is the nearest standard.
//   node tools/music.cjs [soundfont.sf2]
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const SF2 = process.argv[2] || '/usr/share/sounds/sf2/TimGM6mb.sf2'
const RATE = 32000

async function main () {
  const { default: RFF } = await import('../formats/rff.mjs')
  const lib = require(path.join(ROOT, 'node_modules/js-synthesizer/externals/libfluidsynth-2.4.6.js'))
  globalThis.Module = lib
  const JSSynth = require(path.join(ROOT, 'node_modules/js-synthesizer/dist/js-synthesizer.js'))
  await JSSynth.waitForReady()
  const lamejs = await import('@breezystack/lamejs')
  const sounds = RFF.load(path.join(ROOT, 'original/SOUNDS.RFF'))
  fs.mkdirSync(path.join(ROOT, 'data/music'), { recursive: true })
  const sf = fs.readFileSync(SF2)
  const index = {}
  for (const e of sounds.ofType('MID')) {
    const synth = new JSSynth.Synthesizer()
    synth.init(RATE)
    await synth.loadSFont(sf.buffer.slice(sf.byteOffset, sf.byteOffset + sf.length))
    const mid = sounds.read(e)
    await synth.addSMFDataToPlayer(mid.buffer.slice(mid.byteOffset, mid.byteOffset + mid.length))
    await synth.playPlayer()
    const enc = new lamejs.Mp3Encoder(2, RATE, 96)
    const parts = []
    const block = 4096
    const L = new Float32Array(block), R = new Float32Array(block)
    const toPCM = (f) => { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) o[i] = Math.max(-32768, Math.min(32767, Math.round(f[i] * 32767))); return o }
    let seconds = 0, quiet = 0
    while (synth.isPlayerPlaying() && seconds < 600) {
      synth.render([L, R])
      parts.push(Buffer.from(enc.encodeBuffer(toPCM(L), toPCM(R))))
      seconds += block / RATE
    }
    // The tail as the notes die away
    for (let k = 0; k < RATE * 2 / block; k++) { synth.render([L, R]); parts.push(Buffer.from(enc.encodeBuffer(toPCM(L), toPCM(R)))) }
    parts.push(Buffer.from(enc.flush()))
    const file = 'music/' + e.name.toLowerCase() + '.mp3'
    fs.writeFileSync(path.join(ROOT, 'data', file), Buffer.concat(parts))
    index[e.name.toLowerCase()] = { file, seconds: Math.round(seconds) }
    console.log(e.name, Math.round(seconds) + 's', Buffer.concat(parts).length, 'bytes')
    synth.close()
  }
  fs.writeFileSync(path.join(ROOT, 'data/music.json'), JSON.stringify(index))
}
main().catch((e) => { console.error(e); process.exit(1) })
