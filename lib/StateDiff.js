/**
 * Differences between two plain states (what `JSON.stringify` can write: objects, arrays, strings, numbers,
 * booleans and null), so a server can send each client only what changed since the last state it sent.
 *
 * A patch holds, for each key that changed, the new value, or a nested patch where both sides are objects or
 * both arrays; a removed key is marked `{ __removed: 1 }`, and a patch of an array carries its new length.
 * `apply` never changes the state it is given.
 *
 * @example
const patch = StateDiff.diff({ x: 1, y: [1, 2] }, { x: 2, y: [1, 2, 3] })
StateDiff.apply({ x: 1, y: [1, 2] }, patch)   // { x: 2, y: [1, 2, 3] }
 */
class StateDiff {
  /**
   * The patch that turns `a` into `b`, or undefined when they are equal.
   * @param {*} a
   * @param {*} b
   */
  static diff (a, b) {
    if (StateDiff.same(a, b)) return undefined
    const aArray = Array.isArray(a)
    if (!StateDiff.isObject(a) || !StateDiff.isObject(b) || aArray !== Array.isArray(b)) return { __value: b }
    const patch = {}
    let any = false
    if (aArray) {
      if (a.length !== b.length) {
        patch.__length = b.length
        any = true
      }
      for (let i = 0; i < b.length; i++) {
        const p = i < a.length ? StateDiff.diff(a[i], b[i]) : { __value: b[i] }
        if (p !== undefined) {
          patch[i] = p
          any = true
        }
      }
    } else {
      for (const k of Object.keys(b)) {
        const p = k in a ? StateDiff.diff(a[k], b[k]) : { __value: b[k] }
        if (p !== undefined) {
          patch[k] = p
          any = true
        }
      }
      for (const k of Object.keys(a)) {
        if (!(k in b)) {
          patch[k] = { __removed: 1 }
          any = true
        }
      }
    }
    return any ? { __patch: patch } : undefined
  }

  /**
   * `state` with `patch` applied, as a new value.
   * @param {*} state
   * @param {object} patch From `diff`, or undefined for no change
   */
  static apply (state, patch) {
    if (patch === undefined) return state
    if ('__value' in patch) return StateDiff.copy(patch.__value)
    const p = patch.__patch
    if (Array.isArray(state)) {
      const out = state.slice(0, '__length' in p ? p.__length : state.length)
      for (const k of Object.keys(p)) {
        if (k === '__length') continue
        out[Number(k)] = StateDiff.apply(state[Number(k)], p[k])
      }
      return out
    }
    const out = Object.assign({}, state)
    for (const k of Object.keys(p)) {
      if (p[k] && p[k].__removed) delete out[k]
      else out[k] = StateDiff.apply(state[k], p[k])
    }
    return out
  }

  static isObject (v) {
    return v !== null && typeof v === 'object'
  }

  static same (a, b) {
    if (a === b) return true
    if (!StateDiff.isObject(a) || !StateDiff.isObject(b)) return false
    if (Array.isArray(a) !== Array.isArray(b)) return false
    const ka = Object.keys(a)
    if (ka.length !== Object.keys(b).length) return false
    return ka.every((k) => k in b && StateDiff.same(a[k], b[k]))
  }

  static copy (v) {
    return StateDiff.isObject(v) ? JSON.parse(JSON.stringify(v)) : v
  }
}

export default StateDiff
