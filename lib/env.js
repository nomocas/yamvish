var isServer = (typeof window === 'undefined') && (typeof document === 'undefined'),
	Emitter = require('./emitter');
var env = {
	isServer: isServer,
	debug: true,
	api: {},
	expressionsGlobal: isServer ? global : window,
	factory: isServer ? null : document,
	agora: new Emitter(),
	clone: function(newAgora) {
		var cloned = {};
		for (var i in this) {
			if (i === agora && newAgora) {
				cloned.agora = new Emitter();
				continue;
			}
			cloned[i] = this[i];
		}
	}
};

module.exports = env;
