/* global window, document, console, XMLHttpRequest */

// Browser is a shim for browser global scope objects. This exists to allow testing.
module.exports = {
	document: document,
	window: window,
	console: console,
	XMLHttpRequest: XMLHttpRequest,
}