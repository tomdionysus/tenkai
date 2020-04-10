/**
 * APIClient is a generic client for JSON APIs
 */

 var _apiClient

class APIClient {
	constructor(options) {
		options = options || {}
		this.baseUrl = options.baseUrl
		
	}

	apiCall(verb, path, data, callback) {
		var xhr = new XMLHttpRequest()
		xhr.onreadystatechange = function () {
			if (this.readyState == 4) {
				var resData = null
				if (xhr.responseText && xhr.responseText.length > 0) resData = JSON.parse(xhr.responseText)
				callback(null, resData, xhr)
			}
		}
		xhr.open(verb, this.baseUrl + path, true)

		if (!data) return xhr.send()

		xhr.setRequestHeader('Content-type', 'application/json')
		var strData = JSON.stringify(data)
		xhr.send(strData)
	}

	post(path, data, callback) { this.apiCall('POST', path, data, callback) }
	get(path, callback) { this.apiCall('GET', path, null, callback) }
	patch(path, data, callback) { this.apiCall('PATCH', path, data, callback) }
	put(path, data, callback) { this.apiCall('PUT', path, data, callback) }
	delete(path, callback) { this.apiCall('DELETE', path, null, callback) }
	
	static getDefaultClient() {
		return _apiClient = _apiClient || new APIClient({ baseUrl: '/api' })
	}
}

module.exports = APIClient