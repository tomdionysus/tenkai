// Steps the original one frame at a time: ProcessFrame in the emulator's memory is patched where a frame begins (its
// inputs taken, before anything moves: the `mov eax, [gSyncRate]` that starts the network checksum's test, at
// 0x119d3) to jump to a stub that raises a flag and waits for it to be lowered. Whoever reads the original's memory
// then sees every frame's state, once, between the frame before and this one.
//   const step = Lockstep.install(mem, spritesBase); ... if (step.waiting()) { read...; step.release() }
const HOOK_LIN = 0x119d3 // where the frame's game begins, in the exe's linear addresses (code object at 0x10000)
const HOOK_BYTES = [0xa1] // mov eax, [imm32]
const RAND_LIN = 0xa4d3e
const RAND_BYTES = [0x52, 0xe8, 0xf4, 0xff, 0xff, 0xff, 0x85, 0xc0, 0x74, 0x18, 0x69, 0x10]
const CODE_LIN = 0x10000, CODE_VSIZE = 0xe4ca0

export default class Lockstep {
  /** Finds where the loader put the code (by rand()'s bytes) and patches the frame's start */
  static install (mem, seedHeap, offset = 0x200, known = null) {
    const heap = mem.heap
    let base, delta
    if (known) ({ base, delta } = known) // (given by fidelity/randlog.mjs, which has patched rand() already)
    else {
      let H = -1
      for (let i = 0; i < heap.length - 16; i++) if (heap[i] === 0x52 && RAND_BYTES.every((b, k) => heap[i + k] === b)) { H = i; break }
      if (H < 0) throw new Error('rand() not found in memory')
      base = seedHeap - mem.u32(H - 5) // the emulated memory's start in the heap (from the seed's place)
      delta = H - base - RAND_LIN // how far the loader moved the code
    }
    const hook = HOOK_LIN + delta
    if (!HOOK_BYTES.every((b, k) => heap[base + hook + k] === b)) throw new Error('the frame start is not where expected')
    const original = Array.from(heap.slice(base + hook, base + hook + 5))
    // The stub in the code object's last page after its end, past fidelity/randlog.mjs's (which uses its start)
    const cave = ((CODE_LIN + delta + CODE_VSIZE + 0x10) & ~0xf) + offset
    const flag = cave + 64
    const u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]
    const code = []
    code.push(0xc7, 0x05, ...u32(flag), 1, 0, 0, 0) // mov dword [flag], 1
    const spin = cave + code.length
    code.push(0x83, 0x3d, ...u32(flag), 0) // cmp dword [flag], 0
    code.push(0x75, (spin - (cave + code.length + 2)) & 255) // jne spin
    code.push(...original) // the instruction the hook replaced
    code.push(0xe9, ...u32((hook + 5 - (cave + code.length + 5)) >>> 0)) // back to the frame
    heap.set(code, base + cave)
    mem.view.setUint32(base + flag, 0, true)
    heap.set([0xe9, ...u32((cave - (hook + 5)) >>> 0)], base + hook)
    return new Lockstep(mem, base + flag)
  }

  constructor (mem, flagHeap) { this.mem = mem; this.flag = flagHeap; this.frames = 0 }
  /** Whether the original waits at a frame's start */
  waiting () { return this.mem.u32(this.flag) === 1 }
  /** Lets it run to the next frame's start */
  release () { this.mem.view.setUint32(this.flag, 0, true); this.frames++ }
}
