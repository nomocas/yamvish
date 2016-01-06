var utils = require('../utils'),
	env = require('../env'),
	PureNode = require('../pure-node'),
	Container = require('../container'),
	Context = require('../context'),
	Template = require('../template');

function eachPush(value, context, container, template) {
	var ctx = new Context(value, context),
		child = new PureNode();
	child.context = ctx;
	container.appendChild(child);
	template.call(child, ctx, container);
	return child;
}

var engine = {
	//_________________________________ local context management
	context: function(context, args) {
		var value = args[0],
			parentPath = args[1];
		this.context = new Context(parentPath ? null : value, context, parentPath ? parentPath : null)
	},
	with: function(context, args) {
		var path = args[0],
			template = args[1],
			ctx = new Context(typeof path === 'string' ? context.get(path) : path, context, path);
		template.call(this, ctx, container);
	},
	//_______________________________________ TAGS
	tag: function(context, originalArgs) {
		var name = originalArgs[0],
			template = originalArgs[1],
			node = env.factory.createElement(name);
		template.call(node, context);
		this.appendChild(node);
	},
	text: function(context, args) {
		var value = args[0],
			node;
		if (value.__interpolable__) {
			node = env.factory.createTextNode(value.output(context));
			value.subscribeTo(context, function(type, path, newValue) {
				node.nodeValue = newValue;
			});
		} else
			node = env.factory.createTextNode(value);
		this.appendChild(node);
	},
	br: function(context) {
		this.appendChild(env.factory.createElement('br'));
	},
	// __________________________ ATTRIBUTES
	attr: function(context, args) {
		var self = this,
			name = args[0],
			value = args[1],
			val = args[1];
		if (value.__interpolable__) {
			val = value.output(context);
			var attributeUpdate = function(type, path, newValue) {
				self.setAttribute(name, newValue);
			};
			value.subscribeTo(context, attributeUpdate);
		}
		this.setAttribute(name, val);
	},
	disabled: function(context, args) {
		var self = this,
			value = args[0];
		var disable = function(type, path, newValue) {
			if (invert)
				newValue = !newValue;
			if (newValue)
				self.setAttribute('disabled');
			else
				self.removeAttribute('disabled');
		};
		if (typeof value === 'string') {
			context.subscribe(value, disable);
			disable('set', null, context.get(value));
		} else
			disable('set', null, (value !== undefined) ? value : true);
	},
	val: function(context, args) {
		var self = this,
			varPath = args[0],
			value = args[1];
		if (value.__interpolable__) {
			if (!env.isServer)
				this.addEventListener('input', function(event) {
					context.set(varPath, event.target.value);
				});
			value.subscribeTo(context, function(type, path, newValue) {
				self.setAttribute('value', newValue);
			});
			this.setAttribute('value', value.output(context));
		} else
			this.setAttribute('value', value);
	},
	setClass: function(context, args) {
		var self = this,
			name = args[0],
			flag = args[1],
			classValue = name,
			flagValue = flag;
		var flagUpdate = function(type, path, newValue) {
			flagValue = newValue;
			if (newValue)
				utils.setClass(self, classValue);
			else
				utils.removeClass(self, classValue);
		};

		if (name.__interpolable__) {
			var nameUpdate = function(type, path, newValue) {
				if (flagValue) {
					utils.removeClass(self, classValue);
					utils.setClass(self, newValue);
				}
				classValue = newValue;
			};
			name.subscribeTo(context, nameUpdate);
			classValue = name.output(context);
		}
		if (flag.__interpolable__) {
			flag.subscribeTo(context, flagUpdate);
			flagUpdate('set', null, flag.output(context));
		} else
			flagUpdate('set', null, flag);
	},
	css: function(context, args) {
		var prop = args[0],
			value = args[1],
			val = value,
			self = this;
		if (value.__interpolable__) {
			val = value.output(context);
			value.subscribeTo(context, function(type, path, newValue) {
				self.style[prop] = newValue;
			});
		}
		if (!this.style)
			this.style = {};
		this.style[prop] = val;
	},
	visible: function(context, args) {
		var flag = args[0],
			val = flag,
			self = this,
			initial = (this.style ? this.style.display : '') || '';
		if (!this.style)
			this.style = {};
		if (flag.__interpolable__) {
			val = flag.output(context);
			flag.subscribeTo(context, function(type, path, newValue) {
				if (self.__yContainer__)
					newValue ? self.show() : self.hide();
				else
					self.style.display = newValue ? initial : 'none';
			});
		}
		if (this.__yContainer__)
			val ? this.show() : this.hide();
		else
			this.style.display = val ? initial : 'none';
	},
	//______________________________________________ EVENTS
	on: function(context, args) {
		var name = args[0],
			handler = args[1];
		this.addEventListener(name, function(evt) {
			return handler.call(context, evt);
		});
	},
	off: function(context, args) {
		var name = args[0],
			handler = args[1];
		this.removeEventListener(name, handler);
	},
	//______________________________________________ CLIENT/SERVER
	client: function(context, args) {
		if (env.isServer)
			return;
		args[0].call(this, context);
	},
	server: function(context, args) {
		if (!env.isServer)
			return;
		args[0].call(this, context);
	},
	//_________________________________ conditional rendering
	if: function(context, args) {
		var condition = args[0],
			successTempl = args[1],
			failTempl = args[2],
			self = this,
			fakeNode = env.factory.createElement('div'),
			successContainer,
			failContainer,
			current,
			ok;

		utils.hide(fakeNode);

		var exec = function(type, path, ok) {
			var nextSibling = null; // for browser compliance we need to force null  https://bugzilla.mozilla.org/show_bug.cgi?id=119489
			if (current) {
				nextSibling = utils.findNextSibling(current);
				if (current.unmount)
					current.unmount();
				else
					self.removeChild(current);
			}
			if (ok) {
				current = successContainer = successContainer || successTempl.toContainer(self.context || context);
				if (nextSibling)
					successContainer.mountBefore(nextSibling);
				else
					successContainer.appendTo(self);
			} else if (failTempl) {
				current = failContainer = failContainer || failTempl.toContainer(self.context || context);
				if (nextSibling)
					failContainer.mountBefore(nextSibling);
				else
					failContainer.appendTo(self);
			} else {
				current = fakeNode;
				self.insertBefore(fakeNode, nextSibling);
			}
		};
		if (condition && condition.__interpolable__) {
			ok = condition.output(context);
			condition.subscribeTo(context, exec);
		} else if (typeof condition === 'function')
			ok = condition.call(this, context);
		exec('set', null, ok);
	},
	//______________________________________________ EACH
	each: function(context, args) {
		var path = args[0],
			template = args[1],
			emptyTempl = args[2],
			self = this,
			container = new PureNode(),
			emptyContainer,
			current,
			fakeNode = env.factory.createElement('div'),
			isPureNode = this.__yPureNode__ && !this.__yVirtual;
		container.childNodes = [];
		utils.hide(fakeNode);
		this.appendChild(fakeNode);
		current = fakeNode;

		var setEmpty = function(nextSibling) {
			if (current === container)
				self.removeChild(container);
			if (emptyTempl) {
				if (current === emptyContainer)
					return;
				current = emptyContainer = emptyContainer || emptyTempl.toContainer(self.context ||  context);
				if (nextSibling)
					emptyContainer.mountBefore(nextSibling);
				else
					emptyContainer.appendTo(self);
			} else if (current !== fakeNode)
				current = self.insertBefore(fakeNode, nextSibling);
		};

		var setFilled = function(nextSibling) {
			if (current !== container) {
				if (current === emptyContainer)
					emptyContainer.unmount();
				else if (current === fakeNode)
					self.removeChild(fakeNode);
				current = container;
				self.insertBefore(container, nextSibling);
			}
		};

		var update = function(type, path, value, index) {

			switch (type) {
				case 'reset':
				case 'set':

					if (!self.__yPureNode__ || self.mountPoint)
						utils.hide(self.mountPoint || self);

					var nextSibling = utils.findNextSibling(current);
					if (!value.length)
						setEmpty(nextSibling);
					else
						setFilled(nextSibling);

					var j = 0;
					for (var len = value.length; j < len; ++j) // reset existing or create new node 
						if (container.childNodes[j]) // reset existing
							container.childNodes[j].context.reset(value[j]);
						else { // create new node
							var child = eachPush(value[j], self.context || context, container, template);
							if (!isPureNode || self.mountPoint)
								utils.mountChildren(child, self.mountPoint || self, nextSibling);
						}
						// delete additional nodes that is not used any more
					if (j < container.childNodes.length) {
						var end = j,
							lenJ = container.childNodes.length;
						while (container.childNodes[j])
							utils.destroyElement(container.childNodes[j], true);
						// container.childNodes.splice(end);
					}
					if (!self.__yPureNode__ || self.mountPoint)
						utils.show(self.mountPoint || self);
					break;
				case 'removeAt':
					var nextSibling = utils.findNextSibling(current);
					utils.destroyElement(container.childNodes[index], true);
					if (!container.childNodes.length)
						setEmpty(nextSibling);
					break;
				case 'push':
					var nextSibling = utils.findNextSibling(current),
						child = eachPush(value, self.context || context, container, template);
					setFilled(nextSibling);
					if (!isPureNode || self.mountPoint)
						utils.mountChildren(child, self.mountPoint || self, nextSibling);
					break;
			}
		};
		var data = path;
		if (typeof path === 'string') {
			context.subscribe(path, update);
			context.subscribe(path + '.*', function(type, path, value, key) {
				var node = container.childNodes[key];
				if (node)
					return node.context.reset(value);
			});
			data = context.get(path);
		}
		if (data)
			update('set', path, data);
	},
	//________________________________________________ MISC
	contentSwitch: function(context, args) {
		var current,
			xpr = args[0],
			map = args[1],
			dico = utils.shallowCopy(map),
			self = this;
		var valueUpdate = function(type, path, value) {
			if (!value) {
				if (current)
					current.unmount();
				current = null;
				return;
			}
			var templ = dico[value];
			if (!templ)
				throw new Error('yamvish contentSwitch : unrecognised value : ' + value);
			if (current)
				current.unmount();
			current = null;
			if (templ.__yContainer__)
				current = templ.mount(self);
			else if (typeof templ === 'string')
				self.innerHTML = templ;
			else
				return (current = dico[value] = templ.toContainer(context).mount(self));
		};
		xpr.subscribeTo(context, valueUpdate);
		valueUpdate('set', null, xpr.output(context));
	}
};

function execQueue(callee, queue, context) {
	var handler = queue[0],
		nextIndex = 0,
		f;
	while (handler) {
		if (handler.engineBlock)
			f = handler.engineBlock.dom;
		else
			f = handler.func || engine[handler.name];
		// if (!f)
		// throw new Error('dom output : no template output method found with ' + JSON.stringify(handler));
		f.call(callee, callee.context || context, handler.args);
		handler = queue[++nextIndex];
	}
}

Template.prototype.call = function(caller, context) {
	context = context || new Context();
	execQueue(caller, this._queue, context);
};

Template.prototype.toContainer = function(context) {
	var container = new Container();
	context = context || new Context();
	execQueue(container, this._queue, context);
	return container;
};

module.exports = engine;
