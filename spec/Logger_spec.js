const Logger = require('../lib/Logger')

describe('Logger', () => {
	it('should allow New', () => {
		var x1 = new Logger()
		var x2 = new Logger()

		expect(x1).not.toBe(x2)
	})

	it('should default to warn log level', () => {
		var x1 = new Logger()

		expect(x1.logLevel).toEqual(Logger.Warn)
	})

	it('should parse log level error', () => {
		var x1 = new Logger({ logLevel:'error' })

		expect(x1.logLevel).toEqual(Logger.Error)
	})

	// describe('debug', () => {
	// 	it('should log debug when logLevel is equal', () => {
	// 		var x2 = { log: () => {} }
	// 		spyOn(x2,'log') 
	// 		var x1 = new Logger({logLevel: 'debug', logTo: x2})
	// 		x1.debug('TEST','ONE')
	// 		expect(x2.log).toHaveBeenCalled()
	// 	})
	// 	it('should not log debug when logLevel greater', () => {
	// 		var x2 = { log: () => {} }
	// 		spyOn(x2,'log') 
	// 		var x1 = new Logger({logLevel: 'info', logTo: x2})
	// 		x1.debug('TEST','ONE')
	// 		expect(x2.log).not.toHaveBeenCalled()
	// 	})
	// })
})
