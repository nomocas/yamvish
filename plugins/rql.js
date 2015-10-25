/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var rql = require('orql'),
	Context = require('../lib/context'),
	Filter = require('../lib/filter'),
	View = require('../lib/view'),
	Template = require('../lib/template'),
	interpolable = require('../lib/interpolable');

Template.prototype.rql = function(path, expr, name) {
	return this.exec(function(context) {
		context.rql(path, expr, name);
	}, true);
};

View.prototype.rql = Context.prototype.rqlView = function(path, name, expr) {
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

Filter.prototype.rql = function(query) {
	return this.done(function(input) {
		return rql(input, query);
	});
};

module.exports = rql;
