var _defaultLogger

/**
 Logger provides a console based logging system.
 */
class Logger {
  constructor (options = {}) {
    if (typeof (options.logLevel) === 'string') options.logLevel = Logger.stringToLogLevel(options.logLevel)
    this.logLevel = options.logLevel == null ? Logger.Warn : options.logLevel
  }

  /**
	 * Log a Debug message. printf style parameters are supported.
	 * @param {...*} args The log message and params
	 */
  debug () {
    if (this.logLevel > 0) return
    this.log('DEBUG', Array.from(arguments))
  }

  /**
	 * Log an Info message. printf style parameters are supported.
	 * @param {...*} args The log message and params
	 */
  info () {
    if (this.logLevel > 1) return
    this.log('INFO', Array.from(arguments))
  }

  /**
	 * Log a Warning message. printf style parameters are supported.
	 * @param {...*} args The log message and params
	 */
  warn () {
    if (this.logLevel > 2) return
    this.log('WARN', Array.from(arguments))
  }

  /**
	 * Log an Error message. printf style parameters are supported.
	 * @param {...*} args The log message and params
	 */
  error () {
    this.log('ERROR', Array.from(arguments))
  }

  /**
	 * Log a message with the given type and arguments. printf style parameters are supported.
	 * @param {String} type The log type (DEBUG, INFO, WARN, ERROR)
	 * @param {Mixed[]} args The printf args
	 */
  log (type, args) {
    var d = new Date().toISOString()
    var fmt = args.shift()
    var s = Logger.format(fmt, args)
    if (type == 'ERROR') return console.error(d + ' [ERROR] ' + s)
    console.log(d + ' [' + type + '] ' + s)
  }

  /**
   * A printf-style message: `%s` a string, `%d` and `%i` an integer, `%f` a number (`%.2f` to two places), `%x` hex,
   * `%j`, `%o` and `%O` JSON, `%%` a percent sign; a width pads it (`%5d`, `%-8s` on the right, `%05d` with
   * zeros). Arguments left over are added after a space each.
   * @param {String} fmt
   * @param {Array} args
   * @returns {String}
   */
  static format (fmt, args = []) {
    var rest = args.slice()
    var text = String(fmt === undefined ? '' : fmt).replace(/%([-0]?)(\d*)(?:\.(\d+))?([sdifxjoO%])/g, (m, flag, width, precision, code) => {
      if (code === '%') return '%'
      if (!rest.length) return m
      var v = rest.shift()
      var out
      if (code === 's') out = String(v)
      else if (code === 'd' || code === 'i') out = String(Math.trunc(Number(v)))
      else if (code === 'f') out = precision === undefined ? String(Number(v)) : Number(v).toFixed(Number(precision))
      else if (code === 'x') out = Math.trunc(Number(v)).toString(16)
      else {
        try { out = JSON.stringify(v) } catch (e) { out = String(v) }
      }
      var w = Number(width || 0)
      if (out.length < w) out = flag === '-' ? out.padEnd(w) : out.padStart(w, flag === '0' ? '0' : ' ')
      return out
    })
    return rest.length ? text + ' ' + rest.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(' ') : text
  }

  /**
	 * Parse a string and return a Log Level value
	 * @param {String} str The log level string - debug, info, warn, or error
	 * @returns {Integer} The log level value 0-3, or -1 if not found
	 */
  static stringToLogLevel (str) {
    const x = {
      debug: Logger.Debug,
      info: Logger.Info,
      warn: Logger.Warn,
      error: Logger.Error
    }
    str = str.toLowerCase()
    return (typeof (x[str]) === 'undefined') ? -1 : x[str]
  }

  /**
	 * Return a log level string from the given value
	 * @param {Integer} str log level value 0-3
	 * @returns {String} The log level string - debug, info, warn, error or unknown if not found
	 */
  static logLevelToString (logLevel) {
    return {
      0: 'debug',
      1: 'info',
      2: 'warn',
      3: 'error'
    }[logLevel] || 'unknown'
  }

  /**
	 * Return the default logger
	 * @returns {Logger} The default Logger instance
	 */
  static getDefaultLogger () {
    return _defaultLogger = _defaultLogger || new Logger()
  }
}

/**
 * The Debug Log Level
 */
Logger.Debug = 0
/**
 * The Info Log Level
 */
Logger.Info = 1
/**
 * The Warn Log Level
 */
Logger.Warn = 2
/**
 * The Error Log Level
 */
Logger.Error = 3

export default Logger
