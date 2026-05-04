export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "chrono/_app",
	assets: new Set(["favicon.png"]),
	mimeTypes: {".png":"image/png"},
	_: {
		client: {start:"_app/immutable/entry/start.B1VLm8EU.js",app:"_app/immutable/entry/app.Ct80jZcR.js",imports:["_app/immutable/entry/start.B1VLm8EU.js","_app/immutable/chunks/8s1HsI8B.js","_app/immutable/chunks/CJqeGh0u.js","_app/immutable/chunks/puCCJj8O.js","_app/immutable/entry/app.Ct80jZcR.js","_app/immutable/chunks/B5aKb2HV.js","_app/immutable/chunks/CJqeGh0u.js","_app/immutable/chunks/Ou6zobTZ.js","_app/immutable/chunks/BI8Cu2cz.js","_app/immutable/chunks/DgNOrIrA.js","_app/immutable/chunks/puCCJj8O.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js'))
		],
		remotes: {
			
		},
		routes: [
			
		],
		prerendered_routes: new Set(["/chrono/"]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
