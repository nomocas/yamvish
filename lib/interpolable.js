/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

// var expression = require('./parsers/expression');

//_______________________________________________________ INTERPOLABLE

var Interpolable = function(splitted) {
	this.__interpolable__ = true;
	if (splitted.length === 3 && splitted[0] === "" && splitted[2] === "") {
		// single expression with nothing around
		this.directOutput = splitted[1];
		this.dependencies = [splitted[1]];
	} else {
		// interpolable string
		this.splitted = splitted;
		this.dependencies = []; // catch expression dependencies
		for (var i = 1, len = splitted.length; i < len; i = i + 2)
			this.dependencies.push(splitted[i]);
	}
};
Interpolable.prototype = {
	subscribeTo: function(context, callback) {
		var binds = [],
			self = this;
		for (var i = 0, len = this.dependencies.length; i < len; ++i)
			binds.push(context.subscribe(this.dependencies[i], function(type, path, newValue) {
				callback(type, path, self.directOutput ? newValue : self.output(context));
			}));
		if (binds.length == 1)
			return binds[0];
		return function() { // unbind all
			for (var i = 0; i < binds.length; i++)
				binds[i]();
		};
	},
	output: function(context) {
		if (this.directOutput)
			return context.get(this.directOutput);
		var out = "",
			odd = true;
		for (var j = 0, len = this.splitted.length; j < len; ++j) {
			if (odd)
				out += this.splitted[j];
			else
				out += context.get(this.splitted[j]);
			odd = !odd;
		}
		return out;
	}
};

var splitRegEx = /\{\{\s*([^\}\s]+)\s*\}\}/;

function interpolable(string) {
	var splitted = string.split(splitRegEx);
	if (splitted.length == 1)
		return string; // string is not interpolable
	return new Interpolable(splitted);
};

module.exports = {
	interpolable: interpolable,
	Interpolable: Interpolable
};
