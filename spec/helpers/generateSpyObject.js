global.generateSpyObject = function(props) {
	var x = {}

	for(var p in props) {
		x[props[p]] = ()=>{}
		spyOn(x, props[p])
	}

	return x
}

global.addSpies = function(obj, props) {
	for(var p in props) {
		spyOn(obj, props[p])
	}

	return obj
}