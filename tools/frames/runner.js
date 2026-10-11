// Runs a frames script inside the page: keys and clicks as page events, goals checked every frame. The same
// runner serves both ways of running a script:
//   - headless (tools/frames/frames.mjs): put into the page after page.js, it runs the whole script in one call
//     on the virtual clock, hashing every frame, comparing with a baseline as it goes;
//   - live (a tab someone is watching, tools/frames/serve.mjs): it runs on the game's own frames in real time,
//     with no hashing, so the run can be watched.
//
// A script is a list of steps, done in order (paths and the address are the driver's business):
//   { "frames": 120 }                              let 120 frames pass
//   { "key": "Digit1" }                            press and release a key (KeyboardEvent.code)
//   { "down": "KeyX" }, { "up": "KeyX" }           press, release
//   { "click": [480, 300] }                        click at the canvas's own pixels
//   { "press": ["ArrowLeft"], "until": "game.body.y <= 787", "max": 120 }
//                                                  hold keys until the expression holds (checked after each
//                                                  frame), then release them; fails after max frames
//   { "press": ["ArrowUp"], "frames": 60 }         hold keys for 60 frames
//   { "wait": "game.outside.active", "max": 600 }  let frames pass until the expression holds
//   { "do": "place(797, 782, 896)" }               run code, quietly
//   { "eval": "game.zone" }                        run code and print its value
//   { "check": "game.zone === 25" }                fail unless the expression holds
// "prelude" (code) runs on every page load before the steps, for helpers. Expressions see the page's globals.
//
// The older form, "events" at absolute frames with "frames" in all, is turned into steps (a key's numeric
// "hold" becomes a down and an up hold frames later).
;(function () {
  var NAMED = {
    Space: [' ', 32],
    Enter: ['Enter', 13],
    Escape: ['Escape', 27],
    Tab: ['Tab', 9],
    Backspace: ['Backspace', 8],
    ArrowUp: ['ArrowUp', 38],
    ArrowDown: ['ArrowDown', 40],
    ArrowLeft: ['ArrowLeft', 37],
    ArrowRight: ['ArrowRight', 39],
    ControlLeft: ['Control', 17],
    ControlRight: ['Control', 17],
    ShiftLeft: ['Shift', 16],
    ShiftRight: ['Shift', 16],
    AltLeft: ['Alt', 18],
    AltRight: ['Alt', 18]
  }
  function keyFor (code) {
    if (NAMED[code]) return { key: NAMED[code][0], keyCode: NAMED[code][1] }
    var m = /^Key([A-Z])$/.exec(code)
    if (m) return { key: m[1].toLowerCase(), keyCode: m[1].charCodeAt(0), text: true }
    m = /^Digit([0-9])$/.exec(code)
    if (m) return { key: m[1], keyCode: m[1].charCodeAt(0), text: true }
    m = /^F([0-9]+)$/.exec(code)
    if (m) return { key: code, keyCode: 111 + Number(m[1]) }
    return { key: code, keyCode: 0 }
  }
  // As the browser sends them: to the focused element, bubbling to the window; a key with text also sends
  // keypress
  function key (type, code) {
    var k = keyFor(code)
    var target = document.activeElement || document.body
    var init = { code: code, key: k.key, keyCode: k.keyCode, which: k.keyCode, bubbles: true, cancelable: true }
    target.dispatchEvent(new window.KeyboardEvent(type, init))
    if (type === 'keydown' && k.text) target.dispatchEvent(new window.KeyboardEvent('keypress', Object.assign({}, init, { charCode: k.key.charCodeAt(0) })))
  }
  function canvas (selector) {
    if (selector) return document.querySelector(selector)
    var best = null
    document.querySelectorAll('canvas').forEach(function (c) { if (!best || c.width * c.height > best.width * best.height) best = c })
    return best
  }
  // A click as the browser sends one: a move, a press and a release, each aimed at whatever is at that point when
  // it happens (a start screen gone on the press leaves the release to the game under it), its mouse event going
  // where its pointer event went; then a click to the nearest element both the press and the release were in
  function click (selector, at, button) {
    var c = canvas(selector)
    var r = c.getBoundingClientRect()
    var x = r.left + (at[0] + 0.5) * r.width / c.width
    var y = r.top + (at[1] + 0.5) * r.height / c.height
    var b = button === 'right' ? 2 : button === 'middle' ? 1 : 0
    var down = 1 << (b === 2 ? 1 : b === 1 ? 2 : 0)
    var base = { clientX: x, clientY: y, screenX: x, screenY: y, bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 0 }
    var pointer = { pointerId: 1, pointerType: 'mouse', isPrimary: true }
    var send = function (target, Kind, type, extra) { target.dispatchEvent(new Kind(type, Object.assign({}, base, Kind === window.PointerEvent ? pointer : {}, extra || {}))) }
    // Outside the window nothing is hit: the events go to the document, not to the game
    var hit = function () { return document.elementFromPoint(x, y) || document.documentElement }
    var t = hit()
    send(t, window.PointerEvent, 'pointermove')
    send(t, window.MouseEvent, 'mousemove')
    var pressed = hit()
    send(pressed, window.PointerEvent, 'pointerdown', { button: b, buttons: down })
    send(pressed, window.MouseEvent, 'mousedown', { button: b, buttons: down, detail: 1 })
    var released = hit()
    send(released, window.PointerEvent, 'pointerup', { button: b })
    send(released, window.MouseEvent, 'mouseup', { button: b, detail: 1 })
    var both = pressed
    while (both && !both.contains(released)) both = both.parentNode
    if (!both || !both.isConnected || both.nodeType !== 1) return
    if (b === 0) send(both, window.MouseEvent, 'click', { detail: 1 })
    if (b === 2) send(released, window.MouseEvent, 'contextmenu', { button: 2, detail: 1 })
  }
  function value (code) { return (0, eval)('(' + code + ')') } // eslint-disable-line no-eval
  function run (code) { return (0, eval)(code) } // eslint-disable-line no-eval

  // The older form as steps: at each frame, the releases due, then its events, then the frames up to the next
  function stepsOf (script) {
    if (script.steps) return script.steps
    var byFrame = {}
    var add = function (f, e) { (byFrame[f] = byFrame[f] || []).push(e) }
    var ups = {}
    ;(script.events || []).forEach(function (e) {
      if (e.key && e.hold) {
        add(e.frame, { down: e.key })
        ;(ups[e.frame + e.hold] = ups[e.frame + e.hold] || []).push({ up: e.key })
      } else add(e.frame, e)
    })
    var steps = []
    var last = 0
    var frames = Object.keys(byFrame).concat(Object.keys(ups)).map(Number)
    frames = frames.filter(function (f, i) { return frames.indexOf(f) === i }).sort(function (a, b) { return a - b })
    frames.forEach(function (f) {
      if (f >= script.frames) return
      if (f > last) steps.push({ frames: f - last })
      last = f
      ;(ups[f] || []).forEach(function (e) { steps.push(e) })
      ;(byFrame[f] || []).forEach(function (e) { var s = Object.assign({}, e); delete s.frame; steps.push(s) })
    })
    if (script.frames > last) steps.push({ frames: script.frames - last })
    return steps
  }

  var status = { running: false, frame: 0, step: 0, steps: 0, log: [], error: null }

  /**
   * Run a script from a position ({ i, n, frame }: the step, frames done in it, frames in all).
   * o.next() takes a frame and resolves to its entry, or to { leaving: true } when the page is going;
   * o.emit(entry, position) is called after each frame; o.log(text) for printed values.
   * Resolves to { done } or { leaving, position }; rejects on a failed step.
   */
  function runScript (script, o) {
    var steps = stepsOf(script)
    var pos = Object.assign({ i: 0, n: 0, frame: 0 }, o.from || {})
    var log = function (text) { status.log.push(text); if (o.log) o.log(text) }
    status = { running: true, frame: pos.frame, step: pos.i, steps: steps.length, log: [], error: null }
    if (script.prelude) run(script.prelude)
    var held = {}
    // A step with keys held, resumed on a new page: the keys go down again
    if (pos.n > 0 && steps[pos.i] && steps[pos.i].press) [].concat(steps[pos.i].press).forEach(function (code) { key('keydown', code) })
    var fail = function (text) {
      var e = new Error('step ' + (pos.i + 1) + ' (' + JSON.stringify(steps[pos.i]) + ') at frame ' + pos.frame + ': ' + text)
      status.error = e.message
      status.running = false
      throw e
    }
    var frame = function () {
      return Promise.resolve(o.next()).then(function (entry) {
        if (entry && entry.leaving) return false
        pos.frame++
        pos.n++
        status.frame = pos.frame
        if (o.emit) o.emit(entry, { i: pos.i, n: pos.n, frame: pos.frame })
        return true
      })
    }
    var loop = function () {
      if (o.stopped && o.stopped()) { status.running = false; return Promise.resolve({ stopped: true, position: pos }) }
      if (pos.i >= steps.length) { status.running = false; return Promise.resolve({ done: true, position: pos }) }
      status.step = pos.i
      var s = steps[pos.i]
      var next = function () { pos.i++; pos.n = 0; return loop() }
      if (s.frames !== undefined && s.press === undefined) {
        if (pos.n >= s.frames) return next()
        return frame().then(function (ok) { return ok ? loop() : { leaving: true, position: pos } })
      }
      if (s.wait !== undefined || s.press !== undefined) {
        if (s.press && pos.n === 0 && !held[pos.i]) {
          held[pos.i] = true
          ;[].concat(s.press).forEach(function (code) { key('keydown', code) })
        }
        var until = s.press ? s.until : s.wait
        if (pos.n > 0 && (until === undefined ? pos.n >= s.frames : value(until))) {
          if (s.press) [].concat(s.press).forEach(function (code) { key('keyup', code) })
          return next()
        }
        if (until !== undefined && pos.n >= (s.max || 600)) fail('not true after ' + pos.n + ' frames: ' + until)
        return frame().then(function (ok) { return ok ? loop() : { leaving: true, position: pos } })
      }
      if (s.key) { key('keydown', s.key); key('keyup', s.key) }
      if (s.down) key('keydown', s.down)
      if (s.up) key('keyup', s.up)
      if (s.click) click(script.canvas, s.click, s.button)
      if (s.do) run(s.do)
      if (s.eval) log('frame ' + pos.frame + ': ' + s.eval + ' = ' + JSON.stringify(value(s.eval)))
      if (s.check && !value(s.check)) fail('check failed: ' + s.check)
      return next()
    }
    return loop()
  }

  window.__framesRunner = {
    stepsOf: stepsOf,
    run: runScript,
    get status () { return status },
    // Live: run on the page's own frames in real time. Watch it with __framesRunner.status; stop() ends it
    live: function (script) {
      var stop = false
      this.stop = function () { stop = true }
      var p = runScript(script, {
        next: function () { return new Promise(function (resolve) { window.requestAnimationFrame(function () { resolve({}) }) }) },
        stopped: function () { return stop }
      })
      p.catch(function () {})
      return 'running ' + stepsOf(script).length + ' steps'
    }
  }
})()
