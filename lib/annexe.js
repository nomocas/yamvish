/**
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * possible additional template api. not used for the moment.
 */
var y = require('../index');

y.Template.prototype.find = function(selector, template) {
	return this.exec(function(context, node) {
		if (!this.querySelectorAll)
			throw new Error('yamvish : you try to Template.find on node that doesn\'t have querySelectorAll');
		var selected = this.querySelectorAll(selector);
		for (var i = 0, len = selected.length; i < len; ++i)
			template.call(selected[i], context);
	});
};

y.Template.prototype.html = function(fragment, condition, success) {
	condition = (typeof condition === 'undefined') ? true : condition;
	condition = (typeof condition === 'string') ? interpolable(condition) : condition;
	fragment = (typeof fragment === 'string') ? interpolable(fragment) : fragment;
	return this.exec(function(context, container) {
		var cond = condition,
			content = fragment,
			self = this;
		if (fragment.__interpolable__) {
			content = fragment.output(context);
			var fragmentUpdate = function(value, type, path, index) {
				content = value;
				if (cond) {
					self.innerHTML = content;
					success.call(self, context, container);
				}
			};
			this.binds = this.binds || [];
			fragment.subscribeTo(context, fragmentUpdate, this.binds);
		}
		if (condition && condition.__interpolable__) {
			cond = condition.output(context);
			var conditionUpdate = function(value, type, path, index) {
				cond = value;
				if (value) {
					self.innerHTML = content;
					success.call(self, context, container);
				} else
					self.innerHTML = '';
			};
			this.binds = this.binds || [];
			condition.subscribeTo(context, conditionUpdate, this.binds);
		}
		if (cond) {
			self.innerHTML = content;
			success.call(self, context, container);
		}
	});
};

y.Template.prototype.cssSwitch = function(cssVar, xpr, map) {
	xpr = interpolable(xpr);
	return this.exec(function(context, container) {
		var dico = utils.shallowCopy(map),
			self = this;
		var valueUpdate = function(value, type, path) {
			var entry = dico[value];
			if (typeof entry === 'undefined')
				throw new Error('yamvish cssSwitch : unrecognised value : ' + value);
			if (typeof entry === 'function')
				entry = entry.call(self, context, container);
			if (typeof entry === 'undefined')
				delete self.style[cssVar];
			else
				self.style[cssVar] = entry;
		};
		this.binds = this.binds || [];
		xpr.subscribeTo(context, valueUpdate, this.binds);
		valueUpdate(xpr.output(context), 'set');
	});
};
