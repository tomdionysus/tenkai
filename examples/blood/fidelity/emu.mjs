// The original Blood, run headless in DOSBox (js-dos's emulators, its Node backend), for checking the remake
// against it: keys in, screenshots out.
//   const emu = await Emu.start({ args: '-map e1m1' }); await emu.wait(10); await emu.shot('a.png'); await emu.exit()
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { png } from '../tools/png.mjs'

const require = createRequire(import.meta.url)
const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const ORIGINAL = path.join(ROOT, 'original')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
// The emulator's screenshot makes an ImageData, which Node has not got
if (typeof globalThis.ImageData === 'undefined') globalThis.ImageData = class ImageData { constructor (data, width, height) { this.data = data; this.width = width; this.height = height } }

/**
 * BLOOD.CFG as SETUP writes it (Apogee's script format; the keys and sections read from BLOOD.EXE's strings): 320 by
 * 200, no sound unless asked, the keys as BLOOD.EXE's defaults (without [KeyDefinitions] no game key is bound;
 * these are its table of defaults, with Jump on A, Crouch on Z and the letters the manual gives).
 */
export function config (o = {}) {
  return `[Screen Setup]
ScreenMode = ${o.screenMode === undefined ? 2 : o.screenMode}
ScreenWidth = ${o.width || 320}
ScreenHeight = ${o.height || 200}
Size = ${o.size === undefined ? 1 : o.size}
Gamma = 0
[Sound Setup]
FXDevice = ${o.sound ? 0 : 13}
MusicDevice = 13
FXVolume = 220
MusicVolume = 200
CDVolume = 0
NumVoices = 16
NumChannels = 2
NumBits = 16
MixRate = 22050
MidiPort = 0x330
BlasterAddress = 0x220
BlasterType = 6
BlasterInterrupt = 7
BlasterDma8 = 1
BlasterDma16 = 5
BlasterEmu = 0x620
ReverseStereo = 0
[KeyDefinitions]
Move_Forward = "Up" "Kpad8"
Move_Backward = "Down" "Kpad2"
Turn_Left = "Left" "Kpad4"
Turn_Right = "Right" "KPad6"
Turn_Around = "BakSpc" ""
Strafe = "LAlt" "RAlt"
Strafe_Left = "," ""
Strafe_Right = "." ""
Jump = "A" "/"
Crouch = "Z" ""
Run = "LShift" "RShift"
AutoRun = "CapLck" ""
Open = "Space" ""
Weapon_Fire = "LCtrl" "RCtrl"
Weapon_Special_Fire = "X" ""
Aim_Up = "Home" "KPad7"
Aim_Down = "End" "Kpad1"
Aim_Center = "KPad5" ""
Look_Up = "PgUp" "Kpad9"
Look_Down = "PgDn" "Kpad3"
Tilt_Left = "Insert" "Kpad0"
Tilt_Right = "Delete" "Kpad."
Weapon_1 = "1" ""
Weapon_2 = "2" ""
Weapon_3 = "3" ""
Weapon_4 = "4" ""
Weapon_5 = "5" ""
Weapon_6 = "6" ""
Weapon_7 = "7" ""
Weapon_8 = "8" ""
Weapon_9 = "9" ""
Weapon_10 = "0" ""
Inventory_Use = "Enter" "KpdEnt"
Inventory_Left = "[" ""
Inventory_Right = "]" ""
Map_Toggle = "Tab" ""
Map_Follow_Mode = "F" ""
Shrink_Screen = "-" "Kpad-"
Enlarge_Screen = "=" "Kpad+"
Send_Message = "T" ""
See_Coop_View = "K" ""
See_Chase_View = "F7" ""
Mouse_Aiming = "U" ""
Toggle_Crosshair = "I" ""
Next_Weapon = "'" ""
Previous_Weapon = ";" ""
Holster_Weapon = "ScrLck" ""
Show_Opponents_Weapon = "Y" ""
BeastVision = "B" ""
CrystalBall = "C" ""
JumpBoots = "J" ""
MedKit = "M" ""
ProximityBombs = "P" ""
RemoteBombs = "R" ""
[Controls]
ControllerType = 0
MouseSensitivity = 32768
MouseAiming = 0
[Comm Setup]
PlayerName = "Caleb"
[Options]
Detail = 4
MouseAim = 0
AutoRun = 0
Interpolation = 1
ViewHBobbing = 1
ViewVBobbing = 1
FollowMap = 1
OverlayMap = 0
`
}

// The game's files (what the installer puts in C:\BLOOD), not the installer itself
const GAME = ['BLOOD.EXE', 'BLOOD.INI', 'BLOOD.RFF', 'GUI.RFF', 'SOUNDS.RFF', 'SURFACE.DAT', 'TABLES.DAT', 'VOXEL.DAT', 'SHARE000.ART',
  'DOS4GW.EXE', 'BLOOD000.DEM', 'BLOOD001.DEM', 'BLOOD002.DEM', 'SETUP.EXE', 'SETMAIN.EXE', 'COMMIT.EXE', 'COMMIT.DAT', 'TENGAME.INI', 'MODEM.PCK']

export default class Emu {
  /**
   * @param {object} o { args: blood.exe's command line, cycles: DOSBox cycles (default 'max'), files: extra
   *   { path, contents } (a BLOOD.CFG), conf: extra dosbox.conf lines, log: print the emulator's output }
   */
  static async start (o = {}) {
    require('emulators')
    const emulators = globalThis.emulators
    emulators.pathPrefix = path.join(path.dirname(require.resolve('emulators')), '/')
    const replaced = new Set((o.files || []).map((f) => f.path.toUpperCase()))
    const files = GAME.filter((f) => !replaced.has(f)).map((f) => ({ path: 'BLOOD/' + f, contents: new Uint8Array(fs.readFileSync(path.join(ORIGINAL, f))) }))
    files.push({ path: 'BLOOD/BLOOD.CFG', contents: new TextEncoder().encode(config(o.config).replace(/\n/g, '\r\n')) })
    for (const f of o.files || []) files.push({ path: 'BLOOD/' + f.path, contents: f.contents })
    const conf = `[sdl]
autolock=false
[dosbox]
machine=svga_s3
memsize=32
[cpu]
core=auto
cputype=pentium
cycles=${o.cycles || 'max'}
[mixer]
nosound=${o.sound ? 'false' : 'true'}
[sblaster]
sbtype=${o.sound ? 'sb16' : 'none'}
[speaker]
pcspeaker=false
${o.conf || ''}
[autoexec]
echo off
mount c .
c:
cd BLOOD
${o.command || 'BLOOD.EXE ' + (o.args || '')}
`
    const emu = new Emu()
    emu.ci = await emulators.dosboxNode([{ dosboxConf: conf, jsdosConf: { version: '8' } }, ...files])
    emu.out = []
    emu.ci.events().onStdout((m) => { emu.out.push(m); if (o.log) process.stdout.write('[dos] ' + m) })
    emu.ci.events().onMessage && emu.ci.events().onMessage((type, ...args) => { if (o.log) console.log('[emu]', type, ...args) })
    return emu
  }

  wait (seconds) { return sleep(seconds * 1000) }

  /** The screen now, as RGBA { width, height, data } */
  async screen () {
    const img = await this.ci.screenshot()
    return { width: img.width, height: img.height, data: img.data }
  }

  async shot (file) {
    const s = await this.screen()
    fs.writeFileSync(file, png({ width: s.width, height: s.height, pixels: new Uint8Array(s.data.buffer, s.data.byteOffset, s.data.length), type: 'rgba' }))
    return s
  }

  /** Press and release a key (js-dos key codes: GLFW's, as KBD below) */
  async press (code, ms = 100) {
    this.ci.sendKeyEvent(code, true)
    await sleep(ms)
    this.ci.sendKeyEvent(code, false)
    await sleep(50)
  }

  down (code) { this.ci.sendKeyEvent(code, true) }
  up (code) { this.ci.sendKeyEvent(code, false) }

  async exit () { try { await this.ci.exit() } catch (e) {} }
}

// js-dos key codes (GLFW's)
export const KBD = {
  space: 32, enter: 257, esc: 256, tab: 258, backspace: 259, right: 262, left: 263, down: 264, up: 265, pageup: 266, pagedown: 267,
  lshift: 340, lctrl: 341, lalt: 342, rshift: 344, rctrl: 345, ralt: 346, f1: 290, f2: 291, f3: 292, f10: 299, f12: 301,
  ...Object.fromEntries([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c) => [c.toLowerCase(), c.charCodeAt(0)])),
  ...Object.fromEntries([...'0123456789'].map((c) => ['d' + c, c.charCodeAt(0)]))
}

if (process.argv[1] && process.argv[1].endsWith('emu.mjs')) {
  const [out = 'emu', seconds = '20', ...rest] = process.argv.slice(2)
  const emu = await Emu.start({ args: rest.join(' '), log: !!process.env.LOG })
  const t0 = Date.now()
  for (let k = 0; k * 5 < Number(seconds); k++) {
    await emu.wait(5)
    const s = await emu.shot(out + '-' + k + '.png')
    console.log('shot', k, s.width + 'x' + s.height, ((Date.now() - t0) / 1000).toFixed(1) + 's')
  }
  await emu.exit()
  process.exit(0)
}
