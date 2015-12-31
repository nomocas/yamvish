var isServer = (typeof window === 'undefined') && (typeof document === 'undefined');

var env = {
	isServer: isServer,
	debug: false,
	api: {},
	expressionsGlobal: isServer ? global : window,
	factory: isServer ? null : document
};

module.exports = env;
