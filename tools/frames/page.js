// Put into the page before any of its own scripts by tools/frames/frames.mjs. It makes a game deterministic
// without changing the game: time (Date, performance.now), requestAnimationFrame, setTimeout and setInterval
// run on a virtual clock that only moves when the driver asks for the next frame, and Math.random is seeded.
// Loading (fetch and its bodies, images, audio decoding) still happens in real time, so before each frame the
// page waits until nothing is loading. Each frame it hashes the game's canvas and lists the sounds started and
// stopped, for comparing two runs frame by frame.
//
// The driver sets window.__framesOptions = { seed, step, canvas } first, then calls window.__frames.frame().
;(function () {
  var options = window.__framesOptions || {}
  var STEP = options.step || 1000 / 60
  // The virtual clock in milliseconds, and a fixed epoch for Date (2026-01-01)
  var now = 0
  var EPOCH = 1767225600000
  var realSetTimeout = window.setTimeout.bind(window)
  // A task as soon as possible, for checking again without the 4 ms or more a timer costs
  var soon = (function () {
    var channel = new window.MessageChannel()
    var queue = []
    channel.port1.onmessage = function () { queue.shift()() }
    return function (callback) { queue.push(callback); channel.port2.postMessage(0) }
  })()

  // ---- time ----
  var RealDate = window.Date
  function VirtualDate () {
    var args = Array.prototype.slice.call(arguments)
    if (!(this instanceof VirtualDate)) return new RealDate(EPOCH + Math.floor(now)).toString()
    return args.length ? new (Function.prototype.bind.apply(RealDate, [null].concat(args)))() : new RealDate(EPOCH + Math.floor(now))
  }
  VirtualDate.prototype = RealDate.prototype
  VirtualDate.now = function () { return EPOCH + Math.floor(now) }
  VirtualDate.parse = RealDate.parse
  VirtualDate.UTC = RealDate.UTC
  window.Date = VirtualDate
  var realNow = window.performance.now.bind(window.performance)
  window.performance.now = function () { return now }

  // ---- frames and timers ----
  var frames = []
  var frameId = 0
  window.requestAnimationFrame = function (callback) {
    frames.push([++frameId, callback])
    return frameId
  }
  window.cancelAnimationFrame = function (id) {
    frames = frames.filter(function (f) { return f[0] !== id })
  }
  var timers = []
  var timerId = 0
  window.setTimeout = function (callback, ms) {
    var args = Array.prototype.slice.call(arguments, 2)
    timers.push({ id: ++timerId, at: now + Math.max(0, Number(ms) || 0), callback: callback, args: args })
    return timerId
  }
  window.setInterval = function (callback, ms) {
    var args = Array.prototype.slice.call(arguments, 2)
    var every = Math.max(1, Number(ms) || 0)
    timers.push({ id: ++timerId, at: now + every, every: every, callback: callback, args: args })
    return timerId
  }
  window.clearTimeout = window.clearInterval = function (id) {
    timers = timers.filter(function (t) { return t.id !== id })
  }
  // Timers due by now, earliest first (ties in the order they were set)
  function runTimers () {
    for (;;) {
      var due = null
      for (var i = 0; i < timers.length; i++) if (timers[i].at <= now && (!due || timers[i].at < due.at)) due = timers[i]
      if (!due) return
      if (due.every) due.at += due.every
      else timers.splice(timers.indexOf(due), 1)
      if (typeof due.callback === 'function') due.callback.apply(window, due.args)
    }
  }

  // ---- random numbers: mulberry32 from the seed ----
  var seed = (options.seed === undefined ? 1 : options.seed) >>> 0
  Math.random = function () {
    seed = (seed + 0x6d2b79f5) >>> 0
    var t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // ---- loading, counted so a frame waits for it ----
  var pending = 0
  var labels = new Map()
  var labelId = 0
  function track (promise, label) {
    pending++
    var id = ++labelId
    labels.set(id, label || '?')
    var done = function () { pending--; labels.delete(id) }
    promise.then(done, done)
    return promise
  }
  var realFetch = window.fetch.bind(window)
  window.fetch = function (url) { return track(realFetch.apply(null, arguments), 'fetch ' + String((url && url.url) || url).slice(0, 80)) }
  ;['json', 'text', 'arrayBuffer', 'blob'].forEach(function (name) {
    var real = window.Response.prototype[name]
    window.Response.prototype[name] = function () { return track(real.apply(this, arguments), name + ' ' + String(this.url).slice(0, 80)) }
  })
  var images = new Set()
  var src = Object.getOwnPropertyDescriptor(window.HTMLImageElement.prototype, 'src')
  Object.defineProperty(window.HTMLImageElement.prototype, 'src', {
    configurable: true,
    enumerable: src.enumerable,
    get: function () { return src.get.call(this) },
    set: function (value) {
      var image = this
      images.add(image)
      var done = function () { images.delete(image) }
      image.addEventListener('load', done, { once: true })
      image.addEventListener('error', done, { once: true })
      src.set.call(this, value)
    }
  })
  if (window.createImageBitmap) {
    var realBitmap = window.createImageBitmap.bind(window)
    window.createImageBitmap = function () { return track(realBitmap.apply(null, arguments)) }
  }

  // ---- sounds: what starts and stops, frame by frame ----
  var sounds = []
  var bufferIds = new WeakMap()
  // A buffer's identity from its shape and some of its samples, the same from run to run
  function bufferId (buffer) {
    if (!buffer) return null
    if (bufferIds.has(buffer)) return bufferIds.get(buffer)
    var h = 2166136261 >>> 0
    var data = buffer.getChannelData(0)
    var stride = Math.max(1, Math.floor(data.length / 256))
    for (var i = 0; i < data.length; i += stride) h = Math.imul(h ^ Math.round(data[i] * 32767), 16777619) >>> 0
    var id = buffer.length + '/' + buffer.sampleRate + '/' + buffer.numberOfChannels + '/' + h.toString(16)
    bufferIds.set(buffer, id)
    return id
  }
  // Web Audio on the virtual clock: a context's currentTime counts virtual seconds from its creation, and a
  // buffer source does not really play (the page is muted anyway); it ends after its length at its rate, in
  // virtual time, with the same 'ended' event, so a game that waits for a sound to finish sees it finish at the
  // same frame every run
  if (window.AudioContext) {
    var born = new WeakMap()
    var RealContext = window.AudioContext
    // A fixed sample rate: decoded sounds are resampled to the context's rate, which otherwise follows the
    // machine's output device, so the same run would log different buffers on another day or machine
    var realSuspend = RealContext.prototype.suspend
    var VirtualContext = function (options) {
      var context = new RealContext(Object.assign({ sampleRate: (options && options.sampleRate) || 48000 }, options))
      // Nothing is really played, so the real context is suspended at once: a running one streams to the
      // machine's audio service (coreaudiod) all the time, silent or not. Decoding still works suspended.
      realSuspend.call(context)
      born.set(context, now)
      return context
    }
    VirtualContext.prototype = RealContext.prototype
    window.AudioContext = VirtualContext
    if (window.webkitAudioContext) window.webkitAudioContext = VirtualContext
    var Base = window.BaseAudioContext ? window.BaseAudioContext.prototype : RealContext.prototype
    Object.defineProperty(Base, 'currentTime', {
      configurable: true,
      get: function () { return born.has(this) ? (now - born.get(this)) / 1000 : 0 }
    })
    Object.defineProperty(RealContext.prototype, 'state', { configurable: true, get: function () { return 'running' } })
    RealContext.prototype.resume = function () { return Promise.resolve() }
    RealContext.prototype.suspend = function () { return Promise.resolve() }
    var realDecode = Base.decodeAudioData
    Base.decodeAudioData = function () {
      var result = realDecode.apply(this, arguments)
      return result && result.then ? track(result) : result
    }
    var Source = window.AudioBufferSourceNode.prototype
    var ends = new WeakMap()
    var finish = function (node, ms) {
      clearTimeout(ends.get(node))
      ends.set(node, setTimeout(function () {
        ends.delete(node)
        node.dispatchEvent(new window.Event('ended'))
      }, ms))
    }
    Source.start = function (when, offset, duration) {
      sounds.push(['start', bufferId(this.buffer), this.loop ? 1 : 0, Math.round(this.playbackRate.value * 1000) / 1000])
      var context = this.context
      var delay = Math.max(0, ((when || 0) - context.currentTime) * 1000)
      if (this.loop || !this.buffer) return
      var length = duration !== undefined ? duration : this.buffer.duration - (offset || 0)
      finish(this, delay + Math.max(0, length) * 1000 / (this.playbackRate.value || 1))
    }
    Source.stop = function (when) {
      sounds.push(['stop', bufferId(this.buffer)])
      var delay = Math.max(0, ((when || 0) - this.context.currentTime) * 1000)
      finish(this, delay)
    }
  }
  if (window.HTMLMediaElement) {
    var realPlay = window.HTMLMediaElement.prototype.play
    window.HTMLMediaElement.prototype.play = function () {
      sounds.push(['play', this.currentSrc || this.src])
      return realPlay.apply(this, arguments)
    }
  }

  // Wait (in real time) until nothing loads, and the work that loading set off has run. An image counts as
  // loading until its load or error event has run, not just until it is complete.
  function settle () {
    return new Promise(function (resolve, reject) {
      var quiet = 0
      var started = RealDate.now()
      var check = function () {
        var images0 = 0
        images0 = images.size
        quiet = pending === 0 && images0 === 0 ? quiet + 1 : 0
        if (!quiet) timing.waits++
        if (quiet >= 3) return resolve()
        // Give up only after a long wait (big games load for a while), and say so: the run is no longer exact
        // A load that never finishes fails the run instead of grinding on (the driver stops at this error)
        if (RealDate.now() - started > (options.settleTimeout || 60000)) {
          var labels0 = Array.from(labels.values()).slice(0, 5).join(', ')
          return reject(new Error('[frames] still loading after ' + (options.settleTimeout || 60000) + ' ms: ' + pending + ' requests (' + labels0 + '), ' + images0 + ' images'))
        }
        // Quiet: checked again on the next tasks, so a frame with nothing loading costs almost nothing. Loading:
        // checked every 10 ms rather than in a tight loop, so waiting costs no CPU
        if (quiet) soon(check)
        else realSetTimeout(check, 10)
      }
      check()
    })
  }

  // The game's canvas: the one given, or the largest on the page
  function canvas () {
    if (options.canvas) return document.querySelector(options.canvas)
    var best = null
    document.querySelectorAll('canvas').forEach(function (c) {
      if (!best || c.width * c.height > best.width * best.height) best = c
    })
    return best
  }
  function hash () {
    var c = canvas()
    if (!c || !c.width || !c.height) return 'none'
    var data = new Uint32Array(c.getContext('2d').getImageData(0, 0, c.width, c.height).data.buffer)
    var h = 2166136261 >>> 0
    for (var i = 0; i < data.length; i++) h = Math.imul(h ^ data[i], 16777619) >>> 0
    return c.width + 'x' + c.height + ':' + h.toString(16)
  }

  // Once the page starts to go (a reload, a new address) it makes no more frames; the driver waits for the next
  var leaving = false
  window.addEventListener('beforeunload', function () { leaving = true })
  window.addEventListener('pagehide', function () { leaving = true })

  var count = 0
  // Where a frame's time goes, in real milliseconds: waiting for loading, the game's own work, hashing
  var timing = { settle: 0, game: 0, hash: 0, waits: 0 }
  window.__frames = {
    timing: timing,
    // One frame: wait for loading, move the clock a step, run the timers and frame callbacks due, and report
    frame: function () {
      if (leaving) return Promise.resolve({ leaving: true })
      var t0 = realNow()
      return settle().then(function () {
        var t1 = realNow()
        timing.settle += t1 - t0
        now += STEP
        runTimers()
        var due = frames
        frames = []
        due.forEach(function (f) { f[1](now) })
        timing.game += realNow() - t1
        t0 = realNow()
        return settle()
      }).then(function () {
        timing.settle += realNow() - t0
        if (leaving) return { leaving: true }
        count++
        var t2 = realNow()
        var h = hash()
        timing.hash += realNow() - t2
        var out = { frame: count, hash: h, sounds: sounds }
        sounds = []
        return out
      })
    },
    // The canvas as a PNG data URL, for a look at a frame
    png: function () {
      var c = canvas()
      return c ? c.toDataURL('image/png') : null
    },
    // Where the canvas is on the page, for clicks in its own pixels
    rect: function () {
      var c = canvas()
      if (!c) return null
      var r = c.getBoundingClientRect()
      return { x: r.left, y: r.top, width: r.width, height: r.height, pixelWidth: c.width, pixelHeight: c.height }
    },
    settle: settle,
    // What is still loading, for finding a run that will not settle
    status: function () {
      var waiting = []
      images.forEach(function (image) { if (!image.complete) waiting.push(String(image.src).slice(0, 80)) })
      return { pending: pending, images: waiting, labels: Array.from(labels.values()) }
    }
  }
})()
