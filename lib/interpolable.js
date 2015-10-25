/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var env = require('./env'),
	Filter = require('./filter'),
	replacementRegExp = /true|false|null|\$\.(?:[a-zA-Z]\w*(?:\.\w*)*)|\$this(?:\.\w*)*|\$parent(?:\.\w*)+|\$(?:[a-zA-Z]\w*(?:\.\w*)*)|"[^"]*"|'[^']*'|[a-zA-Z_]\w*(?:\.\w*)*/g;

function toFunc(expr) {
	// console.log('xpr : ', expr);
	return new Function("__context", "__global", "return " + expr + ";");
}

function tryExpr(func, context) {
	if (!context)
		throw new Error('context is undefined')
	try {
		return func.call(context.data, context, (typeof window !== 'undefined') ? window : global);
	} catch (e) {
		console.error(e, env().debug ? e.stack : '');
		return '';
	}
}

function xpr(expr, filter, dependencies) {
	// console.log('xpr parse : ', expr);
	expr = expr.replace(replacementRegExp, function(whole) {
		if (whole == 'true' || whole == 'false' ||  whole == 'null')
			return whole;
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
	});

	var func = toFunc(expr);
	if (!filter)
		return func;
	var fltr = new Function('Filter', 'return new Filter().' + filter)(Filter);

	return function(__context, __global) {
		return fltr.call(this, func.call(this, __context, __global));
	};
}

function handler(instance, context, func, index, callback) {
	return function(type, path, newValue) {
		if (instance.dependenciesCount === 1) {
			instance.results[index] = tryExpr(func, context);
			callback(type, path, instance.output(context));
		} else if (!instance.willFire)
			instance.willFire = context.delay(function() { // allow small time to manage other dependencies update without multiple rerender
				if (instance.willFire) {
					instance.willFire = null;
					instance.results[index] = tryExpr(func, context);
					callback(type, path, instance.output(context));
				}
			}, 0);
	};
}

//___________________________________ INSTANCE

var Instance = function(interpolable) {
	this.outputed = false;
	this.binds = [];
	this.results = [];
	this.willFire = null;
	this.parts = interpolable.parts;
	this.dependenciesCount = interpolable.dependenciesCount;
};

Instance.prototype.output = function(context) {
	var out = '',
		odd = true,
		count = 0;
	for (var i = 0, len = this.parts.length; i < len; i++) {
		if (odd)
			out += this.parts[i];
		else {
			out += this.outputed ? this.results[count] : (this.results[count] = tryExpr(this.parts[i].func, context));
			count++;
		}
		odd = !odd;
	}
	if (!this.outputed)
		this.outputed = true;
	return out;
};

//_______________________________________________________ INTERPOLABLE

function directOutput(context) {
	var o = tryExpr(this.parts[1].func, context);
	return (typeof o === 'undefined' && !this._strict) ? '' : o;
}

var Interpolable = function(splitted, strict) {
	this.__interpolable__ = true;
	this._strict = strict || false;
	var dp;
	if (splitted.length === 5 && splitted[0] === "" && splitted[2] === "")
		this.directOutput = directOutput;
	// interpolable string
	this.parts = [];
	this.dependenciesCount = 0;
	var odd = false;
	for (var i = 0, len = splitted.length; i < len; i++) {
		odd = !odd;
		if (odd) {
			this.parts.push(splitted[i]);
			continue;
		}
		var dp = [];
		this.parts.push({
			func: xpr(splitted[i], splitted[i + 2], dp),
			dep: dp
		});
		i += 2;
		this.dependenciesCount += dp.length;
	}
};

Interpolable.prototype = {
	subscribeTo: function(context, callback) {
		var instance = new Instance(this);
		var count = 0;
		for (var i = 1, len = this.parts.length; i < len; i = i + 2) {
			var h = handler(instance, context, this.parts[i].func, count, callback),
				dep = this.parts[i].dep;
			count++;
			for (var j = 0, lenJ = dep.length; j < lenJ; j++)
				instance.binds.push(context.subscribe(dep[j], h));
		}
		return function() {
			// unbind all
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

// var splitRegEx2 = /\{\{(.+?)\}\}/;

var splitRegEx = /\{\{\s*(.+?)((?:(?:\s\|\s)(.+?))?)\s*\}\}/;


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
