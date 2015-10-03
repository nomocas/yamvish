(function() {
	'use strict';
	var rql = require('./rql-array'),
		Context = require('../lib/context'),
		View = require('../lib/view'),
		Template = require('../lib/template'),
		interpolable = require('../lib/interpolable');

	Template.prototype.rqlView = function(path, expr, name) {
		return this.done(function(context) {
			context.rqlView(path, expr, name);
		}, true);
	};
	View.prototype.rqlView = Context.prototype.rqlView = function(path, name, expr) {
		expr = interpolable.interpolable(expr);
		this.data[name] = [];
		var self = this;
		this.subscribe(path, function(type, p, value, key) {
			value = (type === 'push' || type === 'removeAt') ? self.get(path) : value;
			var r = rql(value, expr.__interpolable__ ? expr.output(self) : expr);
			self.set(name, r);
		});
		this.set(name, rql(this.get(path), expr.__interpolable__ ? expr.output(self) : expr));
		if (expr.__interpolable__)
			expr.subscribeTo(this, function(type, p, xpr) {
				self.set(name, rql(self.get(path), xpr));
			});
		return this;
	};
})();
