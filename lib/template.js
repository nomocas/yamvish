var utils = require('./utils'),
	interpolable = require('./interpolable').interpolable,
	expression = require('./parsers/expression'),
	dom = require('./parsers/dom-to-template'),
	Context = require('./context'),
	Virtual = require('./virtual');

//_______________________________________________________ TEMPLATE

function Template(t) {
	this._queue = t ? t._queue.slice() : [];
};

dom.Template = Template;
expression.Template = Template;
var y = function() {
	return new Template()
};

Template.prototype = {
	//_____________________________ APPLY Template ON NODE
	call: function(caller, context) {
		return utils.execQueue(caller, this._queue, context ||  caller.context);
	},
	//_____________________________ BASE Template handler (every template handler is from one of those two types (done or catch))
	done: function(callback) {
		this._queue.push({
			type: 'done',
			fn: callback
		});
		return this;
	},
	'catch': function(callback) {
		this._queue.push({
			type: 'catch',
			fn: callback
		});
		return this;
	},
	//_____________________________ Conditional branching
	'if': function(condition, trueCallback, falseCallback) {
		var type = typeof condition;
		if (type === 'string')
			condition = interpolable(condition);
		return this.done(function(context) {
			var ok = condition,
				self = this;
			var exec = function(type, path, ok) {
				if (ok)
					return trueCallback.call(self, context);
				else if (falseCallback)
					return falseCallback.call(self, context);
			};
			if (condition && condition.__interpolable__) {
				ok = condition.output(context);
				(this.binds = this.binds || []).push(condition.subscribeTo(context, exec));
			} else if (type === 'function')
				ok = condition.call(this, context);
			return exec('set', ok);
		});
		return this;
	},
	//_____________________________ Wait for multi branches ends.
	all: function() {
		var args = arguments;
		return this.done(function() {
			var promises = [];
			for (var i = 0, len = args.length; i < len; ++i)
				promises.push(args[i].call(this));
			return Promise.all(promises);
		});
	},
	//________________________________ CONTEXT and Assignation
	set: function(path, value) {
		return this.done(function(context) {
			context = context || this.context || y.mainContext;
			if (!context)
				throw utils.produceError('no context avaiable to set variable in it. aborting.', this);
			context.set(path, value);
		});
	},
	push: function(path, value) {
		return this.done(function(context) {
			context.push(path, value);
		});
	},
	del: function(path) {
		return this.done(function(context) {
			context.del(path);
		});
	},
	handlers: function(name, handler) {
		return this.done(function(context) {
			(context.handlers = context.handlers || {})[name] = handler;
		});
	},
	context: function(value) {
		var parentPath;
		if (typeof value === 'string')
			parentPath = value;
		return this.done(function(context) {
			this.context = new Context({
				data: parentPath ? null : value,
				parent: context,
				path: parentPath ? parentPath : null
			});
		});
	},
	with: function(path) {
		return this.done(function(context) {
			/*data, handlers, parent, path*/
			this.childrenContext = new Context({
				parent: context,
				path: path
			});
		});
	},
	//__________________________________  REMOVE/DESTROY NODE
	destroy: function() {
		return this.done(function(context) {
			utils.destroy(this);
		});
	},
	remove: function() {
		return this.done(function() {
			utils.remove(this);
		});
	},
	//__________________________________ Attributes
	attr: function(name, value) {
		if (typeof value === 'string')
			value = interpolable(value);
		return this.done(function(context) {
			var self = this;
			if (value.__interpolable__) {
				(this.binds = this.binds || []).push(value.subscribeTo(context, function(type, path, newValue) {
					self.setAttribute(name, newValue);
				}));
				this.setAttribute(name, value.output(context));
			} else
				this.setAttribute(name, value);
		});
	},
	removeAttr: function(name) {
		return this.done(function(context) {
			this.removeAttribute(name);
		});
	},
	disabled: function(value) {
		return this.done(function(context) {
			var self = this;
			var disable = function(type, path, newValue) {
				if (newValue)
					self.setAttribute('disabled');
				else
					self.removeAttribute('disabled');
			};
			if (typeof value === 'string') {
				(this.binds = this.binds || []).push(context.subscribe(value, disable));
				disable('set', null, context.get(value));
			} else
				disable('set', null, value);
		});
	},
	id: function(id) {
		return this.done(function() {
			this.id = id;
		});
	},
	val: function(value) {
		if (typeof value === 'string')
			value = interpolable(value);
		return this.done(function(context) {
			var self = this;
			if (value.__interpolable__) {
				if (!utils.isServer)
					this.addEventListener('input', function(event) {
						context.set(value.directOutput, event.target.value);
					});
				(this.binds = this.binds || []).push(value.subscribeTo(context, function(type, path, newValue) {
					self.setAttribute('value', newValue);
				}));
				this.setAttribute('value', context.get(value.directOutput));
			} else
				this.setAttribute('value', value);
		});
	},
	contentEditable: function(value) {
		if (typeof value === 'string')
			value = interpolable(value);
		return this.done(function(context) {
			var self = this,
				node,
				val;
			this.setAttribute('contenteditable', true);
			if (value.__interpolable__) {
				val = context.get(value.directOutput);
				if (!utils.isServer)
					this.addEventListener('input', function(event) {
						self.freeze = true;
						context.set(value.directOutput, event.target.textContent);
					});
				(this.binds = this.binds || []).push(value.subscribeTo(context, function(type, path, newValue) {
					if (!self.freeze) {
						self.textContent = newValue;
						if (self.el)
							self.el.nodeValue = newValue;
					}
					self.freeze = false;
				}));
			} else
				val = value;

			if (this.__yVirtual__) {
				node = new Virtual({
					tagName: 'textnode'
				});
				node.textContent = val;
			} else
				node = document.createTextNode(val);
			this.appendChild(node);
		});
	},
	setClass: function(name, flag) {
		return this.done(function(context) {
			var self = this;
			var applyClass = function(type, path, newValue) {
				if (newValue)
					self.classList.add(name);
				else
					self.classList.remove(name);
			};
			if (flag !== undefined) {
				if (typeof flag === 'string') {
					(this.binds = this.binds || []).push(context.subscribe(flag, applyClass));
					applyClass('set', null, context.get(flag));
				} else
					applyClass('set', null, flag);
			} else
				applyClass('set', null, true);
		});
	},
	//___________________________________ EVENTS LISTENER
	on: function(name, handler) {
		return this.done(function(context) {
			if (utils.isServer)
				return;
			var h;
			if (typeof handler === 'string') {
				if (!context.handlers || !context.handlers[handler])
					throw utils.produceError('on(' + name + ') : no "' + handler + '" handlers define in current context', this);
				h = context.handlers[handler];
			} else
				h = handler;
			this.addEventListener(name, function(evt) {
				return h.call(context, evt);
			});
		});
	},
	off: function(name, handler) {
		return this.done(function() {
			this.removeEventListener(name, handler);
		});
	},
	//_______________________________________ HTML TAGS
	text: function(value) {
		if (typeof value === 'string')
			value = interpolable(value);
		return this.done(function(context) {
			var node, val;
			if (value.__interpolable__) {
				val = value.output(context);
				(this.binds = this.binds || []).push(value.subscribeTo(context, function(type, path, newValue) {
					node.textContent = newValue;
					if (node.el)
						node.el.nodeValue = newValue;
				}));
			} else
				val = value;
			if (this.__yVirtual__) {
				node = new Virtual({
					tagName: 'textnode'
				});
				node.textContent = val;
			} else
				node = document.createTextNode(val);
			this.appendChild(node);
		});
	},
	tag: function(name) { // arguments : name, q1, q2, ...
		var args = arguments;
		return this.done(function(context) {
			var node;
			if (this.__yVirtual__)
				node = new Virtual({
					tagName: name
				});
			else
				node = document.createElement(name);
			var temp;
			for (var i = 1, len = args.length; i < len; ++i)
				if (typeof args[i] === 'string')
					temp = y().text(args[i]).call(node, this.childrenContext || context);
				else
					temp = args[i].call(node, this.childrenContext || context);
			this.appendChild(node);
		});
	},
	a: function(href) {
		var args = Array.prototype.slice.call(arguments, 1);
		args.unshift('a', y().attr('href', href));
		return this.tag.apply(this, args);
	},
	input: function(type, value) {
		var args = Array.prototype.slice.call(arguments, 2);
		var template = y().attr('type', type);
		if (value)
			template.val(value);
		args.unshift('input', template);
		return this.tag.apply(this, args);
	},
	h: function(level) {
		var args = Array.prototype.slice.call(arguments, 1);
		args.unshift('h' + level);
		return this.tag.apply(this, args);
	},
	empty: function() {
		return this.done(function(context) {
			utils.emptyNode(this);
		});
	},
	//___________________________________________ ARRAY
	each: function(path, templ) {
		this._hasEach = true;
		return this.done(function(context) {
			var template = templ || this._eachTemplate,
				self = this;

			if (!template)
				if (!y.isServer && !this.__yVirtual__)
					template = this._eachTemplate = dom.elementChildrenToTemplate(this, null);
				else
					throw utils.produceError('no template for .each template handler', this);

			var render = function(type, path, value, index) {
				if (path.forEach)
					path = path.join('.');
				switch (type) {
					case 'reset':
					case 'set':
						var j = 0;
						for (var len = value.length; j < len; ++j) {
							if (self.childNodes && self.childNodes[j])
								self.childNodes[j].context.reset(value[j]);
							else {
								var child = new Virtual({
									pure: true,
									context: new Context({
										data: value[j],
										parent: context,
										path: path + '.' + j
									})
								});
								template.call(child);
								self.appendChild(child);
							}
						}
						if (j < self.childNodes.length) {
							var end = j;
							for (; j < self.childNodes.length; ++j)
								utils.destroy(self.childNodes[j]);
							self.childNodes.splice(end);
						}
						break;
					case 'removeAt':
						utils.destroy(self.childNodes[index]);
						self.childNodes.splice(index, 1);
						break;
					case 'push':
						template.call(self, new Context({
							data: value,
							parent: context,
							path: path + '.' + index
						}));
						break;
				}
			};

			(this.binds = this.binds || []).push(context.subscribe(path, render));
			var data = context.get(path);
			if (data)
				return render('set', path, data);
		});
	},
	//__________ STILL TO DO
	from: function(name) {
		return this.done(function() {

		});
	},
	css: function(prop, value) {
		return this.done(function() {

		});
	},
	visible: function(flag) {
		return this.done(function() {

		});
	}
};

// Complete tag list
['div', 'span', 'ul', 'li', 'button', 'p'].forEach(function(tag) {
	Template.prototype[tag] = function() {
		var args = Array.prototype.slice.call(arguments);
		args.unshift(tag);
		return this.tag.apply(this, args);
	};
});
// Complete events list
['click', 'blur', 'focus'].forEach(function(eventName) {
	Template.prototype[eventName] = function(handler) {
		return this.on(eventName, handler);
	}
});


module.exports = Template;
