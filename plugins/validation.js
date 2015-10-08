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
	View.prototype.validate = Context.prototype.validate = function(path, rule) {
		// subscribe on path then use validator to produce errors (if any) and place it in context.data.$error 
		var self = this;

		var applyValidation = function(type, path, value, key) {
			var report;
			if (type === 'push') // validate whole array ?
				report = rule.validate(self.get(path));
			else if (type !== 'removeAt')
				report = rule.validate(value);
			if (report !== true)
				self.set('$error.' + path, report);
			else
				self.del('$error.' + path);
		};

		this.subscribe(path, applyValidation);
		var val = this.get(path);
		if (typeof val !== 'undefined')
			applyValidation('set', path, val);
		return this;
	};

	module.exports = aright;
})();
