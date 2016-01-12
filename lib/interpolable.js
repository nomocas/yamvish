/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var Filter = require('./filter'),
	replacementRegExp = /true|false|null|\$\.(?:[a-zA-Z]\w*(?:\.\w*)*)|\$(?:[a-zA-Z]\w*(?:\.\w*)*)\(?|"[^"]*"|'[^']*'|[a-zA-Z_]\w*(?:\.\w*)*\(?/g,
	splitRegEx = /\{\{\s*(.+?)((?:(?:\s\|\s)(.+?))?)\s*\}\}/,
	cacheFull = {},
	cacheXpr = {};

function tryExpr(func, context) {
	try {
		return func.call(context.data, context, context.env.data.expressionsGlobal);
	} catch (e) {
		console.error(e);
		return '';
	}
}

// analyse and produce xpr func
function compileExpression(expr, filter, dependencies) {
	// console.log('xpr parse : ', expr);
	var total = expr + filter;
	if (cacheXpr[total]) {
		dependencies.push.apply(dependencies, cacheXpr[total].dependencies);
		return cacheXpr[total].func;
	}
	var dep = [];
	expr = expr.replace(replacementRegExp, function(whole) {
		if (whole == 'true' || whole == 'false' ||  whole == 'null')
			return whole;
		switch (whole[0]) {
			case '"':
			case "'":
				return whole;
			case '$':
				if (whole[1] === '.')
					return '__global' + whole.substring(1);
				// else do default case
			default:
				if (whole[whole.length - 1] === '(') {
					var wholePath = whole.substring(0, whole.length - 1);
					dep.push(wholePath);
					var splitted = wholePath.split('.'),
						last;
					if (splitted.length > 1)
						last = splitted.pop();
					return '__context.get(["' + splitted.join('","') + '"])' + (last ? ('.' + last) : '') + '(';
				} else {
					dep.push(whole);
					return '__context.get(["' + whole.split('.').join('","') + '"])';
				}
		}
	});
	// console.log('xpr parsing res : ', expr);
	dependencies.push.apply(dependencies, dep);

	var func = new Function("__context", "__global", "return " + expr + ";");
	if (!filter) {
		cacheXpr[total] = {
			func: func,
			dependencies: dep
		};
		return func;
	}
	// produce filter 
	var fltr = new Function('Filter', 'return new Filter().' + filter)(Filter);
	// wrap expr func with filter
	var f = cacheXpr[total] = function(context, global) {
		return fltr.call(this, func.call(this, context, global));
	};
	cacheXpr[total] = {
		func: f,
		dependencies: dep
	};
	return f;
}

// produce context's subscibtion event handler
function handler(instance, context, func, index, callback) {
	return function(type, path, newValue) {
		var old = instance.results[index];
		instance.results[index] = tryExpr(func, context);
		if (old === instance.results[index])
			return;
		if (instance.dependenciesCount === 1)
			callback(type, path, instance.output(context));
		else if (!instance.willFire)
			instance.willFire = context.delay(function() { // allow small time to manage other dependencies update without multiple rerender
				if (instance.willFire) {
					instance.willFire = null;
					callback(type, path, instance.output(context));
				}
			}, 0);
	};
}

// special case when interpolable is composed of only one expression with no text decoration
// return expr result directly
function directOutput(context) {
	var o = tryExpr(this.parts[1].func, context);
	return (typeof o === 'undefined' && !this._strict) ? '' : o;
}

//___________________________________ INSTANCE of interpolable (linked to specific context)
/*
We need instances of "interpolables" when we bind interpolable object on a specific context. 
We hold original interpolable parts array reference in instance and use it to produce output with local values from binded context.
 */
var Instance = function(interpolable) {
	this.outputed = false;
	this.results = [];
	this.willFire = null;
	this.parts = interpolable.parts;
	this.dependenciesCount = interpolable.dependenciesCount;
	this.directOutput = interpolable.directOutput;
	this._strict = interpolable._strict;
	this.binds = [];
};

// produce interpolable output
Instance.prototype = {
	output: function(context) {
		if (this.directOutput) {
			if (this.outputed)
				return this.results[0];
			this.outputed = true;
			return this.results[0] = this.directOutput(context);
		}
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
		this.outputed = true;
		return out;
	},
	destroy: function() {
		for (var i = 0, len = this.binds.length; i < len; ++i)
			this.binds[i]();
	}
};

//_______________________________________________________ INTERPOLABLE

// Constructor
var Interpolable = function(splitted, strict) {
	// console.log('Interpolabe : splitted : ', splitted);
	this.__interpolable__ = true;
	this._strict = strict || false;
	var dp;
	if (splitted.length === 5 && splitted[0] === "" && splitted[4] === "")
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
			func: compileExpression(splitted[i], splitted[i + 2], dp),
			dep: dp
		});
		i += 2;
		this.dependenciesCount += dp.length;
	}
};

function unsub(context, instance) {
	return function() {
		if (!context.destroyed)
			instance.destroy();
	};
}

Interpolable.prototype = {
	// produce instance and bind to context
	subscribeTo: function(context, callback, binds) {
		var instance = new Instance(this);
		var count = 0;
		for (var i = 1, len = this.parts.length; i < len; i = i + 2) {
			var h = handler(instance, context, this.parts[i].func, count, callback),
				dep = this.parts[i].dep;
			count++;
			for (var j = 0, lenJ = dep.length; j < lenJ; j++)
				context.subscribe(dep[j], h, false, instance.binds)
		}
		if (binds)
			binds.push(unsub(instance));
		return instance;
	},
	// output interpolable with given context
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

module.exports = {
	// check if a string is interpolable. if so : return new Interpolable. else return original string.
	interpolable: function(string, strict) {
		if (typeof string !== 'string')
			return string;
		if (cacheFull[string])
			return cacheFull[string];
		var splitted = string.split(splitRegEx);
		if (splitted.length == 1)
			return string; // string is not interpolable
		return cacheFull[string] = new Interpolable(splitted, strict);
	},
	Interpolable: Interpolable
};
