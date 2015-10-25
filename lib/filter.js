/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

/**
addslashes
capitalize
default
escape
first
last
raw
replace
safe
striptags
title
uniq
url_encode
url_decode
 */

//_______________________________________________________ TEMPLATE

function Filter(f) {
	this._queue = f ? f._queue.slice() : [];
};

Filter.prototype = {
	//_____________________________ APPLY filter ON something
	call: function(callee, input) {
		for (var i = 0, len = this._queue.length; i < len; ++i)
			input = this._queue[i].call(callee, input);
		return input;
	},
	//_____________________________ BASE Filter handler (every template handler is from one of those two types (done or catch))
	lower: function() {
		this._queue.push(function(input) {
			return input.toLowerCase();
		});
		return this;
	},
	upper: function() {
		this._queue.push(function(input) {
			return input.toUpperCase();
		});
		return this;
	},
	reverse: function() {
		this._queue.push(function(input) {
			return input.reverse();
		});
		return this;
	},
	join: function(sep) {
		this._queue.push(function(input) {
			return input.join(sep);
		});
		return this;
	},
	json: function(pretty) {
		this._queue.push(function(input) {
			return JSON.stringify.apply(JSON, pretty ? [input, null, ' '] : [input]);
		});
		return this;
	}
};


module.exports = Filter;
