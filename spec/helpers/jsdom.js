global.document = {
	createElement: ()=>{ return {
		onload: ()=>{},
		oncanplaythrough: ()=>{},
		appendChild: ()=>{},
		classList: {
			add: ()=>{}
		}
	}},
	getElementById: ()=>{ return {
		ownerDocument: {
			parentWindow: global.window
		},
		getAttribute: ()=>{},
		parentNode: {
			replaceChild: ()=>{},
		}
	}},
}
global.window = {
	addEventListener: ()=>{},
	requestAnimationFrame: ()=>{}
}
global.XMLHttpRequest = {}