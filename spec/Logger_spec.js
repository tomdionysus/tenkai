const Logger = require('../lib/Logger')

describe('Logger', () => {
  var x1

  beforeEach(() => {
    x1 = new Logger()
  })

  it('should allow New', () => {
    var x2 = new Logger()

    expect(x1).not.toBe(x2)
  })

  it('should default to warn log level', () => {
    expect(x1.logLevel).toEqual(Logger.Warn)
  })

  it('should parse log level error', () => {
    var x1 = new Logger({ logLevel: 'error' })

    expect(x1.logLevel).toEqual(Logger.Error)
  })

  describe('debug', () => {
    it('should call log with correct params', () => {
      x1.logLevel = Logger.Debug
      spyOn(x1, 'log')
      x1.debug('ONE', 'TWO', 'THREE')
      expect(x1.log).toHaveBeenCalledWith('DEBUG', ['ONE', 'TWO', 'THREE'])
    })

    it('should not call log when log level is Info', () => {
      x1.logLevel = Logger.Info
      spyOn(x1, 'log')
      x1.debug('ONE', 'TWO', 'THREE')
      expect(x1.log).not.toHaveBeenCalled()
    })
  })

  describe('info', () => {
    it('should call log with correct params', () => {
      x1.logLevel = Logger.Info
      spyOn(x1, 'log')
      x1.info('ONE', 'TWO', 'THREE')
      expect(x1.log).toHaveBeenCalledWith('INFO', ['ONE', 'TWO', 'THREE'])
    })

    it('should not call log when log level is Warn', () => {
      x1.logLevel = Logger.Warn
      spyOn(x1, 'log')
      x1.info('ONE', 'TWO', 'THREE')
      expect(x1.log).not.toHaveBeenCalled()
    })
  })

  describe('warn', () => {
    it('should call log with correct params', () => {
      x1.logLevel = Logger.Warn
      spyOn(x1, 'log')
      x1.warn('ONE', 'TWO', 'THREE')
      expect(x1.log).toHaveBeenCalledWith('WARN', ['ONE', 'TWO', 'THREE'])
    })

    it('should not call log when log level is Error', () => {
      x1.logLevel = Logger.Error
      spyOn(x1, 'log')
      x1.warn('ONE', 'TWO', 'THREE')
      expect(x1.log).not.toHaveBeenCalled()
    })
  })

  describe('error', () => {
    it('should call log with correct params', () => {
      x1.logLevel = Logger.Error
      spyOn(x1, 'log')
      x1.error('ONE', 'TWO', 'THREE')
      expect(x1.log).toHaveBeenCalledWith('ERROR', ['ONE', 'TWO', 'THREE'])
    })
  })

  describe('log', () => {
    it('should console.log output', () => {
      spyOn(console, 'log')
      x1.log('TEST', ['ONE %s %s', 'TWO', 'THREE'])
      expect(console.log).toHaveBeenCalledWith(jasmine.any(String))
    })

    it('should console.error output if error', () => {
      spyOn(console, 'log')
      spyOn(console, 'error')
      x1.log('ERROR', ['ONE %s %s', 'TWO', 'THREE'])
      expect(console.log).not.toHaveBeenCalled()
      expect(console.error).toHaveBeenCalledWith(jasmine.any(String))
    })
  })

  describe('stringToLogLevel', () => {
    it('should return correct strings', () => {
      expect(Logger.stringToLogLevel('debug')).toEqual(Logger.Debug)
      expect(Logger.stringToLogLevel('info')).toEqual(Logger.Info)
      expect(Logger.stringToLogLevel('warn')).toEqual(Logger.Warn)
      expect(Logger.stringToLogLevel('error')).toEqual(Logger.Error)
      expect(Logger.stringToLogLevel('unknown')).toEqual(-1)
    })
  })

  describe('logLevelToString', () => {
    it('should return correct strings', () => {
      expect(Logger.logLevelToString(Logger.Debug)).toEqual('debug')
      expect(Logger.logLevelToString(Logger.Info)).toEqual('info')
      expect(Logger.logLevelToString(Logger.Warn)).toEqual('warn')
      expect(Logger.logLevelToString(Logger.Error)).toEqual('error')
      expect(Logger.logLevelToString(-1)).toEqual('unknown')
    })
  })

  describe('getDefaultLogger', () => {
    it('should create a logger and return it', () => {
      var x = Logger.getDefaultLogger()
      expect(x).toEqual(jasmine.any(Logger))
    })

    it('should return the same logger', () => {
      var x = Logger.getDefaultLogger()
      expect(x).toEqual(jasmine.any(Logger))
      expect(Logger.getDefaultLogger()).toBe(x)
    })
  })
})
