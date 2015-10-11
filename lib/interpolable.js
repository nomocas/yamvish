/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var _all = /true|false|null|\$\.(?:[a-zA-Z]\w*(?:\.\w*)*)|\$this(?:\.\w*)*|\$parent(?:\.\w*)+|\$(?:[a-zA-Z]\w*(?:\.\w*)*)|"[^"]*"|'[^']*'|[a-zA-Z_]\w*(?:\.\w*)*/g,
	_startThis = /^\$this/,
	_startParent = /^\$parent/,
	_arrayAccess = /\.(\d+)/g;

function toFunc(expr) {
	// console.log('xpr : ', expr);
	return new Function("__context", "__global", "return " + expr + ";");
}

function tryExpr(func, context) {
	try {
		return func.call(context.data, context, (typeof window !== 'undefined') ? window : global);
	} catch (e) {
		console.error(e, env.debug ? e.stack : '');
		return '';
	}
}

function xpr(string, dependencies) {
	// console.log('xpr parse : ', string);
	return toFunc(string.replace(_all, function(whole) {

		switch (whole[0]) {
			case '$':
				if (whole[1] === '.')
					return '__global' + whole.substring(1);
				else {
					dependencies.push(whole);
					return '__context.get("' + whole + '")';
				}
			case '"':
			case "'":
				return whole;
			default:
				dependencies.push(whole);
				return '__context.get("' + whole + '")';
		}
	}));
}

function handler(instance, context, func, index, callback) {
	return function(type, path, newValue) {
		// console.log('interpolable handler : ', type, path, newValue);
		if (instance.dependenciesCount === 1) {
			instance.results[index] = tryExpr(func, context);
			callback(type, path, instance.output(context));
		} else if (!instance.willFire)
			instance.willFire = setTimeout(function() {
				if (instance.willFire) {
					instance.results[index] = tryExpr(func, context);
					instance.willFire = null;
					callback(type, path, instance.output(context));
				}
			}, 0);
	};
}

//_______________________________________________________ INTERPOLABLE

function directOutput(context) {
	var o = tryExpr(this.parts[1].func, context);
	return (typeof o === 'undefined' && !this._strict) ? '' : o;
}

var Interpolable = function(splitted, strict) {
	this.__interpolable__ = true;
	this._strict = strict || false;
	var dp;
	if (splitted.length === 3 && splitted[0] === "" && splitted[2] === "")
		this.directOutput = directOutput;

	// interpolable string
	this.parts = splitted;
	this.dependenciesCount = 0;
	for (var i = 1, len = splitted.length; i < len; i = i + 2) {
		var dp = [];
		splitted[i] = {
			func: xpr(splitted[i], dp),
			dep: dp
		};
		this.dependenciesCount += dp.length;
	}
};
Interpolable.prototype = {

	subscribeTo: function(context, callback) {
		var self = this;
		var instance = {
			outputed: false,
			binds: [],
			results: [],
			willFire: null,
			dependenciesCount: this.dependenciesCount,
			output: function() {
				var out = '',
					odd = true,
					count = 0;
				for (var i = 0, len = self.parts.length; i < len; i++) {
					if (odd)
						out += self.parts[i];
					else {
						out += this.outputed ? this.results[count] : (this.results[count] = tryExpr(self.parts[i].func, context));
						count++;
					}
					odd = !odd;
				}
				if (!this.outputed)
					this.outputed = true;
				return out;
			}
		};

		var count = 0;
		for (var i = 1, len = this.parts.length; i < len; i = i + 2) {
			var h = handler(instance, context, this.parts[i].func, count, callback),
				dep = this.parts[i].dep;
			count++;
			for (var j = 0, lenJ = dep.length; j < lenJ; j++)
				instance.binds.push(context.subscribe(dep[j], h));
		}
		return function() { // unbind all
			instance.willFire = null;
			for (var i = 0; i < instance.binds.length; i++)
				instance.binds[i]();
		};
	},
	output: function(context) {
		if (this.directOutput)
			return this.directOutput(context);
		var out = "",
			odd = true,
			parts = this.parts;
		for (var j = 0, len = parts.length; j < len; ++j) {
			if (odd)
				out += parts[j];
			else {
				var r = tryExpr(parts[j].func, context);
				if (typeof r === 'undefined') {
					if (this._strict)
						return;
					out += '';
				}
				out += r;
			}
			odd = !odd;
		}
		return out;
	}
};

var splitRegEx = /\{\{(.+?)\}\}/;

function interpolable(string, strict) {
	var splitted = string.split(splitRegEx);
	// console.log('interpolable check : ', splitted);
	if (splitted.length == 1)
		return string; // string is not interpolable
	return new Interpolable(splitted, strict);
};

module.exports = {
	interpolable: interpolable,
	Interpolable: Interpolable
};
