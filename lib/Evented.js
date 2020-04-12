/**
 * Evented provides DOM-like asynchronous event processing for classes.
 * @abstract
 */
class Evented {
	/**
	 * Initialise the events subsystem.
	 */
	constructor(options = {}) {
		this._events = options.events || {}
	}

	/**
	 * Add the given event.
	 * @param {String[]} The event name to add
	 */
	defineEvent(event) {
		this._events[event] = []
	}

	/**
	 * Remove the given event.
	 * @param {String[]} The event name to remove
	 */
	undefineEvent(event) {
		delete this._events[event]
	}

	/**
	 * Add the given events.
	 * @param {String[]} The event names to add
	 */
	defineEvents(events) {
		for(var i in events) this.defineEvent(events[i])
	}

	/**
	 * Remove the given events.
	 * @param {String[]} The event names to remove
	 */
	undefineEvents(events) {
		for(var i in events) this.undefineEvent(events[i])
	}

	/**
	 * Add the given handler to the event.
	 * @param {String} event The name of the event
	 * @param {Function} fn The event handler
	 * @throws {Exception} 'unon: no such event <eventname>' if event not defined
	 * @alias Evented#addEventListener
	 */
	on(event, fn) {
		if(!this._events[event]) throw 'on: no such event '+event
		if(this._events[event].indexOf(fn)==-1) this._events[event].push(fn)
		return this
	}

	/**
	 * Remove the given handler from the event.
	 * @param {String} event The name of the event
	 * @param {Function} fn The event handler
	 * @throws {Exception} 'unon: no such event <eventname>' if event not defined
	 * @alias Evented#removeEventListener
	 */
	unon(event, fn) {
		if(!this._events[event]) throw 'unon: no such event '+event
		var x = this._events[event]
		var i = x.indexOf(fn)
		if (i > -1) { x.splice(i, 1) }
		this._events[event] = x
		return this
	}

	/**
	 * 
	 */
	addEventListener(event, fn) { return this.on(event, fn) }
	/**
	 * 
	 */
	removeEventListener(event, fn) { return this.unon(event, fn) }

	/**
	 * Trigger the given event with the specified arguments.
	 * @param {String} event The name of the event
	 * @param {array} args The event arguments
	 * @throws {Exception} 'trigger: no such event <eventname>' if event not defined
	 */
	trigger(event, ...args) {
		if(!this._events[event]) throw 'trigger: no such event '+event
		for(var i in this._events[event]) { 
			var f = ()=>{this._events[event][i].apply(null, args)}
			setImmediate(f)
		}
	}

	/**
	 * Return an array of the handlers for the given event.
	 * @returns {Function[]} The handler Functions for the event
	 * @throws {Exception} 'getEventListeners: no such event <eventname>' if event not defined
	 */
	getEventListeners(event) {
		if(!this._events[event]) throw 'getEventListeners: no such event '+event
		return this._events[event]
	}
}

module.exports = Evented

