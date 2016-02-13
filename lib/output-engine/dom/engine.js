/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 */
var utils = require('../../utils'),
	Container = require('./container'),
	Context = require('../../context'),
	Template = require('../../template'),
	View = require('../../view');

var engine = {
	//___________________________________ Structure Flow
	each: require('./each').each,
	if: require('./if'),
	switch: require('./switch'),
	//_________________________________ local context management
	newContext: function(context, node, args) {
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
			value.subscribeTo(context, function(value, type, path) {
				node.nodeValue = value;
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
		if (value && value.__interpolable__) {
			val = value.output(context);
			var attributeUpdate = function(value, type, path) {
				node.setAttribute(name, value);
			};
			node.binds = node.binds || [];
			value.subscribeTo(context, attributeUpdate, node.binds);
		}
		node.setAttribute(name, val);
	},
	disabled: function(context, node, args) {
		var xpr = args[0];
		var disable = function(value, type, path) {
			if (value)
				node.setAttribute('disabled');
			else
				node.removeAttribute('disabled');
		};
		if (xpr.__interpolable__) {
			node.binds = node.binds || [];
			xpr.subscribeTo(context, disable, node.binds);
			disable(xpr.output(context), 'set');
		} else
			disable((value !== undefined) ? value : true, 'set');
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
			value.subscribeTo(context, function(value, type, path) {
				node.setAttribute('value', value);
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
		var flagUpdate = function(value, type, path) {
			flagValue = value;
			if (value)
				node.classList.add(classValue);
			else
				node.classList.remove(classValue);
		};

		if (name.__interpolable__) {
			var nameUpdate = function(value, type, path) {
				if (flagValue) {
					utils.removeClass(node, classValue);
					utils.setClass(node, value);
				}
				classValue = value;
			};
			node.binds = node.binds || [];
			name.subscribeTo(context, nameUpdate, node.binds);
			classValue = name.output(context);
		}
		if (flag.__interpolable__) {
			node.binds = node.binds || [];
			flag.subscribeTo(context, flagUpdate, node.binds);
			flagUpdate(flag.output(context), 'set');
		} else
			flagUpdate(flag, 'set');
	},
	css: function(context, node, args) {
		var prop = args[0],
			value = args[1],
			val = value;
		if (value.__interpolable__) {
			val = value.output(context);
			node.binds = node.binds || [];
			value.subscribeTo(context, function(value, type, path) {
				node.style[prop] = value;
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
			flag.subscribeTo(context, function(value, type, path) {
				if (node.__yContainer__)
					value ? node.show() : node.hide();
				else
					node.style.display = value ? initial : 'none';
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
	//_____________________________________ MISC
	mountHere: function(context, node, args) {
		(node.binds = node.binds || []).push(args[0].toContainer(context).appendTo(node).destroyer());
	},
	suspendUntil: function(context, node, args) {
		var xpr = args[0],
			index = args[1],
			templ = args[2],
			val = xpr.__interpolable__ ? xpr.output(context) : xpr,
			rest = new Template(templ._queue.slice(index)),
			instance;
		if (val)
			rest.call(node, context);
		else if (xpr.__interpolable__)
			instance = xpr.subscribeTo(context, function(value, type, path) {
				if (value)
					rest.call(node, context);
			});
	}
};

function _execQueue(node, queue, context) {
	var handler = queue[0],
		index = 0,
		f;
	while (handler) {
		f = null;
		switch (handler.type) {
			case '*':
				f = engine[handler.handler];
				break;
			case 'dom':
			case 'context':
				f = handler.handler;
				break;
			case 'custom':
				f = handler.handler.dom;
				break;
		}
		if (!f) {
			handler = queue[++index];
			continue;
		}
		f(node.context || context, node, handler.args);
		if (handler.suspendAfter)
			break;
		handler = queue[++index];
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
	this.toContainer(context).appendTo(node);
};

module.exports = engine;
