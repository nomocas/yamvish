y.Template.prototype.find = function(selector, handler) {
	return this.exec(function(context, container) {
		if (!this.querySelectorAll)
			throw new Error('yamvish : you try to Template.find on node that doesn\'t have querySelectorAll');
		var selected = this.querySelectorAll(selector),
			promises = [];
		for (var i = 0, len = selected.length; i < len; ++i) {
			var p = handler.call(selected[i], context, container);
			if (p && p.then)
				promises.push(p);
		}
		if (promises.length)
			return Promise.all(promises);
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
				var fragmentUpdate = function(type, path, value, index) {
					content = value;
					if (cond) {
						self.innerHTML = content;
						success.call(self, context, container);
					}
				};
				(this._binds = this._binds || []).push(fragment.subscribeTo(context, fragmentUpdate));
			}
			if (condition && condition.__interpolable__) {
				cond = condition.output(context);
				var conditionUpdate = function(type, path, value, index) {
					cond = value;
					if (value) {
						self.innerHTML = content;
						success.call(self, context, container);
					} else
						self.innerHTML = '';
				};
				(this._binds = this._binds || []).push(condition.subscribeTo(context, conditionUpdate));
			}
			if (cond) {
				self.innerHTML = content;
				success.call(self, context, container);
			}
		},
		function(context, descriptor, container) {

		});
};

y.Template.prototype.cssSwitch = function(cssVar, xpr, map) {
	xpr = interpolable(xpr);
	return this.exec(function(context, container) {
		var dico = utils.shallowCopy(map),
			self = this;
		var valueUpdate = function(type, path, value) {
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
		(this._binds = this._binds || []).push(xpr.subscribeTo(context, valueUpdate));
		return valueUpdate('set', null, xpr.output(context));
	}, function(context, descriptor, container) {

	});
};
