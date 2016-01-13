var isServer = (typeof window === 'undefined') && (typeof document === 'undefined'),
	Emitter = require('./emitter');
var env = {
	isServer: isServer,
	debug: true,
	expressionsGlobal: isServer ? global : window,
	factory: isServer ? null : document,
	agora: new Emitter(),
	clone: function(keepAgora) {
		var cloned = {};
		for (var i in this) {
			if (i === 'agora' && !keepAgora) {
				cloned.agora = new Emitter();
				continue;
			}
			cloned[i] = this[i];
		}
		return cloned;
	}
};

module.exports = env;
