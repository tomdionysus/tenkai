const vsprintf = require('sprintf-js').vsprintf

var _defaultLogger

class Logger {
	constructor(options = {}) {
		if(typeof(options.logLevel) == 'string') options.logLevel = Logger.stringToLogLevel(options.logLevel)
		this.logLevel = options.logLevel || 2
	}
	
	debug() {
		if(this.logLevel>0) return
		this.log('DEBUG', Array.from(arguments))
	}

	info() {
		if(this.logLevel>1) return
		this.log('INFO', Array.from(arguments))
	}

	warn() {
		if(this.logLevel>2) return
		this.log('WARN', Array.from(arguments))
	}

	error() {
		this.log('ERROR', Array.from(arguments))
	}

	log(type,args) {
		var d = new Date().toISOString()
		var fmt = args.shift()
		var s = vsprintf(fmt,args)
		if(type=='ERROR') return console.error(d+' [ERROR] '+s)
		console.log(d+' ['+type+'] '+s)
	}

	static stringToLogLevel(str) {
		return {
			'debug': Logger.Debug,
			'info': Logger.Info,
			'warn': Logger.Warn,
			'error': Logger.Error
		}[str.toLowerCase()] || -1
	}

	static logLevelToString(logLevel) {
		return {
			0: 'debug',
			1: 'info',
			2: 'warn',
			3: 'error',
		}[logLevel] || 'unknown'
	} 
	
	static getDefaultLogger() {
		return _defaultLogger = _defaultLogger || new Logger()
	}
}

Logger.Debug = 0
Logger.Info  = 1
Logger.Warn  = 2
Logger.Error = 3

module.exports = Logger


