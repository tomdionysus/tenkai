// The original from the menu into E1M1 (New Game, the first episode, the default skill), shots as it starts.
//   node fidelity/newgame.mjs <outprefix> [seconds after starting]
import Emu, { KBD } from './emu.mjs'
const [out, after = '6'] = process.argv.slice(2)
const emu = await Emu.start({ log: !!process.env.LOG })
await emu.wait(22)
await emu.shot(out + '-menu.png')
for (const k of ['enter', 'enter', 'enter']) { await emu.press(KBD[k]); await emu.wait(2) }
await emu.shot(out + '-skill.png')
await emu.press(KBD.enter); await emu.wait(2)
await emu.shot(out + '-0.png')
for (let i = 1; i <= Number(after); i++) { await emu.wait(1); if (i % 2 === 0) await emu.shot(out + '-' + i + '.png') }
await emu.exit()
process.exit(0)
