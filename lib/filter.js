/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

function Filter(f) {
	this._queue = f ? f._queue.slice() : [];
};

var truncateRegExp = /^(?:[\w'"\(\),]+\s*){0,10}/;

Filter.prototype = {
	//_____________________________ APPLY filter on input
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
	json: function(pretty) {
		this._queue.push(function(input) {
			return JSON.stringify.apply(JSON, pretty ? [input, null, ' '] : [input]);
		});
		return this;
	},
	truncate: function() {
		this._queue.push(function(input) {
			var match = truncateRegExp.exec(input);
			return match ? (match[0] + '...') : input;
		});
		return this;
	},
	randomizeArray: function() {
		this._queue.push(function(input) {
			if (!input)
				return null;
			if (!input.forEach)
				return input;
			return input.sort(function() {
				return 0.5 - Math.random();
			});
		});
		return this;
	},
	urlencode: function() {
		this._queue.push(function(input) {
			return encodeURI(input);
		});
		return this;
	}
};

module.exports = Filter;

/**
 * could be added :  (list from swigjs)
 
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
