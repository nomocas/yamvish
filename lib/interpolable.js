/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var env = require('./env'),
	Filter = require('./filter'),
	replacementRegExp = /true|false|null|\$\.(?:[a-zA-Z]\w*(?:\.\w*)*)|\$this(?:\.\$?\w*)*|\$parent(?:\.\$?\w*)+|\$(?:[a-zA-Z]\w*(?:\.\w*)*)|"[^"]*"|'[^']*'|[a-zA-Z_]\w*(?:\.\w*)*/g;

function tryExpr(func, context) {
	if (!context)
		throw new Error('context is undefined')
	try {
		return func.call(context.data, context, env().expressionsGlobal);
	} catch (e) {
		console.error(e, env().debug ? e.stack : '');
		return '';
	}
}

// analyse and produce xpr func
function compileExpression(expr, filter, dependencies) {
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
	// console.log('xpr parsing res : ', expr);

	var func = new Function("__context", "__global", "return " + expr + ";");
	if (!filter)
		return func;
	// produce filter 
	var fltr = new Function('Filter', 'return new Filter().' + filter)(Filter);
	// wrap expr func with filter
	return function(__context, __global) {
		return fltr.call(this, func.call(this, __context, __global));
	};
}

// produce context's subscibtion event handler
function handler(instance, context, func, index, callback) {
	return function(type, path, newValue) {
		// console.log('interpolable handler : ', type, path, newValue);
		instance.results[index] = tryExpr(func, context);
		if (instance.dependenciesCount === 1) {
			callback(type, path, instance.output(context));
		} else if (!instance.willFire)
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
We need an instance of interpolable object when we want to bind interpolable object with a specific context. 
We hold original interpolable parts array reference in instance and use it to produce output with local values from binded context.
 */
var Instance = function(interpolable) {
	this.outputed = false;
	this.binds = [];
	this.results = [];
	this.willFire = null;
	this.parts = interpolable.parts;
	this.dependenciesCount = interpolable.dependenciesCount;
	this.directOutput = interpolable.directOutput;
	this._strict = interpolable._strict;
};

// produce interpolable output
Instance.prototype.output = function(context) {
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
	if (!this.outputed)
		this.outputed = true;
	return out;
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

Interpolable.prototype = {
	// produce instance and bind to context
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

var splitRegEx = /\{\{\s*(.+?)((?:(?:\s\|\s)(.+?))?)\s*\}\}/;
// check if a string is interpolable. if so : return new Interpolable. else return original string.
function interpolable(string, strict) {
	if (typeof string !== 'string')
		return string;
	var splitted = string.split(splitRegEx);
	if (splitted.length == 1)
		return string; // string is not interpolable
	return new Interpolable(splitted, strict);
};

module.exports = {
	interpolable: interpolable,
	Interpolable: Interpolable
};
