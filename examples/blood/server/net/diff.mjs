// Differences between two plain states, in the patch format the client's Tenkai StateDiff applies ({ __value },
// { __patch } with __length for arrays, { __removed: 1 }). Written here because the server uses no Tenkai.
export function same (a, b) {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  for (const k of ka) if (!(k in b) || !same(a[k], b[k])) return false
  return true
}

export function diff (a, b) {
  if (same(a, b)) return undefined
  const isObj = (v) => v !== null && typeof v === 'object'
  if (!isObj(a) || !isObj(b) || Array.isArray(a) !== Array.isArray(b)) return { __value: b }
  const patch = {}
  let any = false
  if (Array.isArray(a)) {
    if (a.length !== b.length) { patch.__length = b.length; any = true }
    for (let i = 0; i < b.length; i++) {
      const p = i < a.length ? diff(a[i], b[i]) : { __value: b[i] }
      if (p !== undefined) { patch[i] = p; any = true }
    }
  } else {
    for (const k of Object.keys(b)) {
      const p = k in a ? diff(a[k], b[k]) : { __value: b[k] }
      if (p !== undefined) { patch[k] = p; any = true }
    }
    for (const k of Object.keys(a)) if (!(k in b)) { patch[k] = { __removed: 1 }; any = true }
  }
  return any ? { __patch: patch } : undefined
}
