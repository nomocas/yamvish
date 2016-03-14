var isServer = (typeof window === 'undefined') && (typeof document === 'undefined'),
	Emitter = require('nomocas-utils/lib/emitter');
var env = {
	isServer: isServer,
	debug: true,
	expressionsGlobal: isServer ? global : window,
	factory: isServer ? null : document,
	agora: new Emitter(),
	/**
	 * shallow clone env object
	 * @param  {[type]} keepAgora [description]
	 * @return {[type]}           [description]
	 */
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
