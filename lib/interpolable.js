/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

// var expression = require('./parsers/expression');

//_______________________________________________________ INTERPOLABLE

var Interpolable = function(splitted, strict) {
	this.__interpolable__ = true;
	this._strict = strict;
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
			self = this,
			willFire,
			len = this.dependencies.length;
		for (var i = 0; i < len; ++i)
			binds.push(context.subscribe(this.dependencies[i], function(type, path, newValue) {
				if (self.directOutput)
					callback(type, path, newValue);
				else if (len === 1)
					callback(type, path, self.output(context));
				else if (!willFire)
					willFire = setTimeout(function() {
						if (willFire) {
							willFire = null;
							callback(type, path, self.output(context));
						}
					}, 1);
			}));
		return function() { // unbind all
			willFire = null;
			for (var i = 0; i < binds.length; i++)
				binds[i]();
		};
	},
	output: function(context) {
		if (this.directOutput) {
			var o = context.get(this.directOutput);
			return (typeof o === 'undefined' && !this._strict) ? '' : o;
		}
		var out = "",
			odd = true;
		for (var j = 0, len = this.splitted.length; j < len; ++j) {
			if (odd)
				out += this.splitted[j];
			else {
				var r = context.get(this.splitted[j]);
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

var splitRegEx = /\{\{\s*([^\}\s]+)\s*\}\}/;

function interpolable(string, strict) {
	var splitted = string.split(splitRegEx);
	if (splitted.length == 1)
		return string; // string is not interpolable
	return new Interpolable(splitted, strict);
};

module.exports = {
	interpolable: interpolable,
	Interpolable: Interpolable
};



// "$.Math $.fofo".replace(/(\$)\./g, '_global.')

// "$parent.flo.bar $parent.fofo".replace(/\$parent(\.[a-zA-Z]\w*)*/g, function(path){
//   return '__context.get('+path+')';
// });

// "$this * $this".replace(/\$this/g, '__context.data');




/*
To introduce full expression with global management (e.g. Math.random)

we need to scan expression to find variables path

	case : 
		$parent

			should be replaced by __context.get(path)

		$this
			should be replace with __context.data

		$.xxx
			/(\$)\.(?:[a-zA-Z](?:\w|\.))+/
			
		path
			don't change

		'string' (start not alpha)
		"string"

		true
		false

		number (not alpha)

		how to distinguish global vs context path ?

			start global with $
			{{ ($.Math.random() * (index || $parent.index) ? 'hello' : 'bloupi') | truncate(2).date('yy-mm-dd')  }}
		

		replace : 


		and avoid js keywords
 */
