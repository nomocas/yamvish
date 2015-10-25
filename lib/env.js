var env = function() {
	return Promise.context || env.global;
};

env.global = {
	isServer: (typeof window === 'undefined') && (typeof document === 'undefined'),
	debug: false,
	templates: {},
	views: {},
	rootContext: null
};

module.exports = env;
