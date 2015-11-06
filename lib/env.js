var env = function() {
	return Promise.context || env.global;
};

var isServer = (typeof window === 'undefined') && (typeof document === 'undefined');

env.global = {
	isServer: isServer,
	debug: false,
	templates: {},
	views: {},
	api: {},
	expressionsGlobal: isServer ? global : window,
	factory: isServer ? null : document
};

module.exports = env;
