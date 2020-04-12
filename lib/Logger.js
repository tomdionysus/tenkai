const vsprintf = require('sprintf-js').vsprintf

var _defaultLogger

/**
 Logger provides a console based logging system.
 */
class Logger {
	constructor(options = {}) {
		if(typeof(options.logLevel) == 'string') options.logLevel = Logger.stringToLogLevel(options.logLevel)
		this.logLevel = options.logLevel || 2
	}
	
	/**
	 * Log a Debug message. printf style parameters are supported.
	 * @param {...*} args The log message and params
	 */
	debug() {
		if(this.logLevel>0) return
		this.log('DEBUG', Array.from(arguments))
	}

	/**
	 * Log an Info message. printf style parameters are supported.
	 * @param {...*} args The log message and params
	 */
	info() {
		if(this.logLevel>1) return
		this.log('INFO', Array.from(arguments))
	}

	/**
	 * Log a Warning message. printf style parameters are supported.
	 * @param {...*} args The log message and params
	 */
	warn() {
		if(this.logLevel>2) return
		this.log('WARN', Array.from(arguments))
	}

	/**
	 * Log an Error message. printf style parameters are supported.
	 * @param {...*} args The log message and params
	 */
	error() {
		this.log('ERROR', Array.from(arguments))
	}

	/**
	 * Log a message with the given type and arguments. printf style parameters are supported.
	 * @param {String} type The log type (DEBUG, INFO, WARN, ERROR)
	 * @param {Mixed[]} args The printf args
	 */
	log(type, args) {
		var d = new Date().toISOString()
		var fmt = args.shift()
		var s = vsprintf(fmt,args)
		if(type=='ERROR') return console.error(d+' [ERROR] '+s)
		console.log(d+' ['+type+'] '+s)
	}

	/**
	 * Parse a string and return a Log Level value
	 * @param {String} str The log level string - debug, info, warn, or error
	 * @returns {Integer} The log level value 0-3, or -1 if not found
	 */
	static stringToLogLevel(str) {
		const x = {
			'debug': Logger.Debug,
			'info': Logger.Info,
			'warn': Logger.Warn,
			'error': Logger.Error
		}
		str = str.toLowerCase()
		return (typeof(x[str])=='undefined') ? -1 : x[str]
	}

	/**
	 * Return a log level string from the given value
	 * @param {Integer} str log level value 0-3
	 * @returns {String} The log level string - debug, info, warn, error or unknown if not found 
	 */
	static logLevelToString(logLevel) {
		return {
			0: 'debug',
			1: 'info',
			2: 'warn',
			3: 'error',
		}[logLevel] || 'unknown'
	} 
	
	/**
	 * Return the default logger
	 * @returns {Logger} The default Logger instance
	 */
	static getDefaultLogger() {
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
Logger.Info  = 1
/**
 * The Warn Log Level
 */
Logger.Warn  = 2
/**
 * The Error Log Level
 */
Logger.Error = 3

module.exports = Logger


