var utils = require('../utils'),
	PureNode = require('../pure-node'),
	Container = require('../container'),
	Context = require('../context'),
	Template = require('../template'),
	View = require('../view');

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
	context: function(context, node, args) {
		var data = args[0],
			parent = args[1] || context,
			path = args[2];
		node.context = new Context(data, parent, path);
	},
	with: function(context, node, args) {
		var path = args[0],
			template = args[1],
			ctx = new Context(typeof path === 'string' ? context.get(path) : path, context, path);
		template.call(node, ctx, container);
	},
	//_______________________________________ TAGS
	tag: function(context, parent, args) {
		var name = args[0],
			template = args[1],
			node = context.env.data.factory.createElement(name);
		template.call(node, context);
		parent.appendChild(node);
	},
	text: function(context, parent, args) {
		var value = args[0],
			node;
		if (value.__interpolable__) {
			node = context.env.data.factory.createTextNode(value.output(context));
			node.binds = node.binds || [];
			value.subscribeTo(context, function(type, path, newValue) {
				node.nodeValue = newValue;
			}, node.binds);
		} else
			node = context.env.data.factory.createTextNode(value);
		parent.appendChild(node);
	},
	br: function(context, parent) {
		parent.appendChild(context.env.data.factory.createElement('br'));
	},
	// __________________________ ATTRIBUTES
	attr: function(context, node, args) {
		var name = args[0],
			value = args[1],
			val = args[1];
		if (value.__interpolable__) {
			val = value.output(context);
			var attributeUpdate = function(type, path, newValue) {
				node.setAttribute(name, newValue);
			};
			node.binds = node.binds || [];
			value.subscribeTo(context, attributeUpdate, node.binds);
		}
		node.setAttribute(name, val);
	},
	disabled: function(context, node, args) {
		var xpr = args[0];
		var disable = function(type, path, newValue) {
			if (newValue)
				node.setAttribute('disabled');
			else
				node.removeAttribute('disabled');
		};
		if (xpr.__interpolable__) {
			node.binds = node.binds || [];
			xpr.subscribeTo(context, disable, node.binds);
			disable('set', null, xpr.output(context));
		} else
			disable('set', null, (value !== undefined) ? value : true);
	},
	val: function(context, node, args) {
		var varPath = args[0],
			value = args[1];
		if (value.__interpolable__) {
			if (!context.env.data.isServer)
				(node.addEventListener || node.on).call(node, 'input', function(event) {
					context.set(varPath, event.target.value);
				});
			node.binds = node.binds || [];
			value.subscribeTo(context, function(type, path, newValue) {
				node.setAttribute('value', newValue);
			}, node.binds);
			node.setAttribute('value', value.output(context));
		} else
			node.setAttribute('value', value);
	},
	setClass: function(context, node, args) {
		var name = args[0],
			flag = args[1],
			classValue = name,
			flagValue = flag;
		var flagUpdate = function(type, path, newValue) {
			flagValue = newValue;
			if (newValue)
				utils.setClass(node, classValue);
			else
				utils.removeClass(node, classValue);
		};

		if (name.__interpolable__) {
			var nameUpdate = function(type, path, newValue) {
				if (flagValue) {
					utils.removeClass(node, classValue);
					utils.setClass(node, newValue);
				}
				classValue = newValue;
			};
			node.binds = node.binds || [];
			name.subscribeTo(context, nameUpdate, node.binds);
			classValue = name.output(context);
		}
		if (flag.__interpolable__) {
			node.binds = node.binds || [];
			flag.subscribeTo(context, flagUpdate, node.binds);
			flagUpdate('set', null, flag.output(context));
		} else
			flagUpdate('set', null, flag);
	},
	css: function(context, node, args) {
		var prop = args[0],
			value = args[1],
			val = value;
		if (value.__interpolable__) {
			val = value.output(context);
			node.binds = node.binds || [];
			value.subscribeTo(context, function(type, path, newValue) {
				node.style[prop] = newValue;
			}, node.binds);
		}
		if (!node.style)
			node.style = {};
		node.style[prop] = val;
	},
	visible: function(context, node, args) {
		var flag = args[0],
			val = flag,
			initial = (node.style ? node.style.display : '') || '';
		if (!node.style)
			node.style = {};
		if (flag.__interpolable__) {
			val = flag.output(context);
			node.binds = node.binds || [];
			flag.subscribeTo(context, function(type, path, newValue) {
				if (node.__yContainer__)
					newValue ? node.show() : node.hide();
				else
					node.style.display = newValue ? initial : 'none';
			}, node.binds);
		}
		if (node.__yContainer__)
			val ? node.show() : node.hide();
		else
			node.style.display = val ? initial : 'none';
	},
	//______________________________________________ EVENTS
	on: function(context, node, args) {
		var name = args[0],
			handler = args[1];
		(node.on || node.addEventListener).call(node, name, function(evt) {
			handler.call(context, evt);
		});
	},
	off: function(context, node, args) {
		var name = args[0],
			handler = args[1];
		(node.off || node.removeEventListener).call(node, name, handler);
	},
	//______________________________________________ CLIENT/SERVER
	client: function(context, node, args) {
		if (context.env.data.isServer)
			return;
		args[0].call(node, context);
	},
	server: function(context, node, args) {
		if (!context.env.data.isServer)
			return;
		args[0].call(node, context);
	},
	//_________________________________ conditional rendering
	if: function(context, node, args) {
		var condition = args[0],
			successTempl = args[1],
			failTempl = args[2],
			fakeNode = utils.hide(context.env.data.factory.createElement('div')),
			successContainer,
			failContainer,
			current,
			ok;
		node.binds = node.binds || [];
		var exec = function(type, path, ok) {
			var nextSibling = null; // for browser compliance we need to force null  https://bugzilla.mozilla.org/show_bug.cgi?id=119489
			if (current) {
				nextSibling = utils.findNextSibling(current);
				if (current.unmount)
					current.unmount();
				else
					node.removeChild(current);
			}
			if (ok) {
				current = successContainer;
				if (!current) {
					current = successContainer = successTempl.toContainer(node.context || context);
					node.binds.push(current.destroyer());
				}
			} else if (failTempl) {
				current = failContainer;
				if (!current) {
					current = failContainer = failTempl.toContainer(node.context || context);
					node.binds.push(current.destroyer());
				};
			} else
				current = fakeNode;

			if (!current.__yContainer__)
				node.insertBefore(current, nextSibling);
			else if (nextSibling)
				current.mountBefore(nextSibling);
			else
				current.appendTo(node);
		};
		if (condition && condition.__interpolable__) {
			ok = condition.output(context);
			node.binds = node.binds || [];
			condition.subscribeTo(context, exec, node.binds);
		} else if (typeof condition === 'function')
			ok = condition.call(node, context);
		exec('set', null, ok);
	},
	//______________________________________________ EACH
	each: function(context, node, args) {
		var path = args[0],
			template = args[1],
			emptyTempl = args[2],
			container = new PureNode(),
			emptyContainer,
			current,
			fakeNode = context.env.data.factory.createElement('div'),
			isPureNode = node.__yPureNode__ && !node.__yVirtual;
		container.childNodes = [];
		utils.hide(fakeNode);
		node.appendChild(fakeNode);
		current = fakeNode;
		node.binds = node.binds || []; //.push(container.destroyer());

		var setEmpty = function(nextSibling) {
			if (current === container)
				node.removeChild(container);
			if (emptyTempl) {
				if (current === emptyContainer)
					return;
				current = emptyContainer;
				if (!current) {
					current = emptyContainer = emptyTempl.toContainer(node.context ||  context);
					node.binds.push(current.destroyer());
				}
				if (nextSibling)
					emptyContainer.mountBefore(nextSibling);
				else
					emptyContainer.appendTo(node);
			} else if (current !== fakeNode)
				current = node.insertBefore(fakeNode, nextSibling);
		};

		var setFilled = function(nextSibling) {
			if (current !== container) {
				if (current === emptyContainer)
					emptyContainer.unmount();
				else if (current === fakeNode)
					node.removeChild(fakeNode);
				current = container;
				node.insertBefore(container, nextSibling);
			}
		};

		var update = function(type, path, value, index) {
			switch (type) {

				case 'reset':
				case 'set':
					if (!node.__yPureNode__ || node.mountPoint)
						utils.hide(node.mountPoint || node);

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
							var child = eachPush(value[j], node.context || context, container, template);
							if (!isPureNode || node.mountPoint)
								utils.mountChildren(child, node.mountPoint || node, nextSibling);
						}
						// delete additional nodes that is not used any more
					if (j < container.childNodes.length) {
						var lenJ = container.childNodes.length;
						while (container.childNodes[j])
							utils.destroyElement(container.childNodes[j], true);
					}
					if (!node.__yPureNode__ || node.mountPoint)
						utils.show(node.mountPoint || node);
					break;

				case 'removeAt':
					var nextSibling = utils.findNextSibling(current);
					utils.destroyElement(container.childNodes[index], true);
					if (!container.childNodes.length)
						setEmpty(nextSibling);
					break;

				case 'push':
					var nextSibling = utils.findNextSibling(current),
						child = eachPush(value, node.context || context, container, template);
					setFilled(nextSibling);
					if (!isPureNode || node.mountPoint)
						utils.mountChildren(child, node.mountPoint || node, nextSibling);
					break;
			}
		};
		var data = path;
		if (typeof path === 'string') {
			context.subscribe(path, update, false, node.binds);
			context.subscribe(path + '.*', function(type, path, value, key) {
				var node = container.childNodes[key];
				if (node)
					return node.context.reset(value);
			}, false, node.binds);
			data = context.get(path);
		}
		if (data)
			update('set', path, data);
	},
	//________________________________________________ MISC
	switch: function(context, node, args) {
		var current,
			xpr = args[0],
			dico = utils.shallowCopy(args[1]);
		if (!dico['default'])
			dico['default'] = utils.hide(context.env.data.factory.createElement('div'));
		node.binds = node.binds || [];
		var valueUpdate = function(type, path, value) {
			var templ = dico[String(value)],
				nextSibling = utils.findNextSibling(current);
			if (!templ) {
				templ = dico['default'];
				value = 'default';
			}
			if (current) {
				if (current.unmount)
					current.unmount();
				else
					node.removeChild(current);
			}
			current = templ;
			if (current.__yTemplate__) {
				current = dico[value] = templ.toContainer(context).mountBefore(nextSibling);
				node.binds.push(current.destroyer());
			}
			if (!current.__yContainer__)
				node.insertBefore(current, nextSibling);
			else if (nextSibling)
				current.mountBefore(nextSibling);
			else
				current.appendTo(node);
		};
		xpr.subscribeTo(context, valueUpdate, node.binds);
		valueUpdate('set', null, xpr.output(context));
	},
	mountHere: function(context, node, args) {
		(node.binds = node.binds || []).push(args[0].toContainer(context).mount(node).destroyer());
	},
	suspendUntil: function(context, node, args) {
		var xpr = args[0],
			index = args[1],
			templ = args[2],
			val = xpr.__interpolable__ ? xpr.output(context) : xpr,
			rest = new Template(templ._queue.slice(index)),
			instance;
		var exec = function(type, path, value) {
			if (value) {
				if (instance)
					instance.destroy();
				rest.call(node, context);
			}
		};
		if (val)
			exec('set', null, val);
		else if (xpr.__interpolable__)
			instance = xpr.subscribeTo(context, exec);
	}
};

function _execQueue(node, queue, context) {
	var handler = queue[0],
		nextIndex = 0,
		f;
	while (handler) {
		if (handler.engineBlock)
			f = handler.engineBlock.dom;
		else
			f = handler.func || engine[handler.name];
		f(node.context || context, node, handler.args);
		if (handler.suspendAfter)
			break;
		handler = queue[++nextIndex];
	}
}

Template.prototype.call = function(node, context) {
	context = context || new Context();
	_execQueue(node, this._queue, context);
};

Template.prototype.toContainer = View.prototype.toContainer = function(context) {
	var container = new Container();
	_execQueue(container, this._queue, context);
	return container;
};

View.prototype.call = function(node, context) {
	this.toContainer(context).mount(node);
};

module.exports = engine;
