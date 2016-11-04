// simple global object where store apis

var Template = require('./template'),
	API = module.exports = {
		classes: {
			yamvish: Template
		},
		initializers: {
			yamvish: {}
		},
		extendClass: function(baseClassName) {
			var BaseClass = this.classes[baseClassName];
			if (!BaseClass)
				throw new Error('Yamvish API fail to extends : nothing found with : ' + baseClassName);
			var Cl = function() {
				BaseClass.call(this);
			}
			Cl.prototype = new BaseClass();
			return Cl;
		},
		/**
		 * parse api method reference as "apiname:mywidget"
		 * @param  {[type]} env  [description]
		 * @param  {[type]} path [description]
		 * @return {[type]}      [description]
		 */
		getAPIMethod: function(path) {
			if (!path.forEach)
				path = path.split(':');
			if (path.length !== 2)
				throw new Error('yamvish method call badly formatted : ' + path.join(':'));
			var Cl = this.classes[path[0]];
			if (!Cl)
				throw new Error('no api found with "' + path.join(':') + '"');
			var method = Cl.prototype[path[1]];
			if (!method)
				throw new Error('no API method found with "' + path.join(':') + '"');
			return method;
		},
		toAPI: function(apiName, methods, func) {
			if (!this.classes[apiName])
				return this.extendAPI('yamvish', apiName, methods);
			var Cl = this.classes[apiName],
				proto = Cl.prototype,
				initializer = this.initializers[apiName] = this.initializers[apiName] || {};

			if (!func)
				Object.keys(methods)
				.forEach(function(key) {
					if (key === '__yTemplate__' || key === '_queue')
						return;
					proto[key] = methods[key];
					initializer[key] = getInitMethod(key, Cl);
				});
			else {
				proto[methods] = func;
				initializer[methods] = getInitMethod(methods, Cl);
			}
			return this;
		},
		extendAPI: function(baseName, newName, methods) {
			var Cl = this.classes[newName] = this.extendClass(baseName),
				proto = Cl.prototype,
				initializer = this.initializers[newName] = {};
			for (var key in proto) {
				if (key === '__yTemplate__' || key === '_queue')
					continue;
				initializer[key] = getInitMethod(key, Cl);
			}
			if (methods)
				this.toAPI(newName, methods);
			return this;
		},
		initializer: function(apiName) {
			return this.initializers[apiName || 'yamvish'];
		}
	};

Template.getAPIMethod = function(path) {
	return API.getAPIMethod(path);
};

Template.prototype.api = function(name) {
	var Cl = API.classes[name];
	if (!Cl)
		throw new Error('no api found with : ' + name);
	var inst = new Cl();
	inst._queue = this._queue;
	return inst;
};

function getInitMethod(key, Cl) {
	return function() {
		var inst = new Cl();
		return inst[key].apply(inst, arguments);
	};
}

// construct main initializer
var init = API.initializers.yamvish;
for (var key in Template.prototype) {
	if (key === '__yTemplate__' || key === '_queue')
		continue;
	init[key] = getInitMethod(key, Template);
}