/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
(function() {
	'use strict';
	var aright = require('aright'),
		Context = require('../lib/context'),
		View = require('../lib/view'),
		Template = require('../lib/template');

	Template.prototype.validate = function(path, rule) {
		return this.exec(function(context) {
			context.validate(path, rule);
		}, true);
	};
	View.prototype.validate = Context.prototype.validate = function(path, schema) {
		// subscribe on path then use validator to produce errors (if any) and place it in context.data.$error 

		return this;
	};

	module.exports = aright;
})();
