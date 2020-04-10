var _uxNames = {}

class Util {
	static getAutoName(typeName) {
		if(!_uxNames[typeName]) _uxNames[typeName] = 0
		return typeName+(_uxNames[typeName]++)
	}

	static propDefault(options,name,value) {
		if(typeof(options[name])=='undefined') options[name] = value
		return value
	}
}

module.exports = Util