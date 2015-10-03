/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

/**
 * addslashes
capitalize
date
default
escape
first
groupBy
join
json
last
lower
raw
replace
reverse
safe
sort
striptags
title
uniq
upper
url_encode
url_decode

Incode Filter Usage
y.filter('my value').lower().date('yy/mm/dd');
 */

var utils = require('./utils');

//_______________________________________________________ TEMPLATE

function Filter(f) {
	this._queue = f ? f._queue.slice() : [];
};

Filter.prototype = {
	//_____________________________ APPLY filter ON something
	call: function(callee, context) {
		return utils.execQueue(callee, this._queue, context);
	},
	//_____________________________ BASE Filter handler (every template handler is from one of those two types (done or catch))
	done: function(callback) {
		this._queue.push({
			type: 'done',
			fn: callback
		});
		return this;
	},
	lower: function() {
		return this.done(function(input) {
			return input.toLowerCase();
		});
	},
	date: function(format) {
		// use dateFormat from http://blog.stevenlevithan.com/archives/date-time-format
		// ensure it is loaded before use
		return this.done(function(input) {
			return new Date(input).format(format);
		});
	}
};


module.exports = Filter;
