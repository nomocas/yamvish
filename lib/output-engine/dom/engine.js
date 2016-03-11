/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 */
var utils = require('../../utils'),
	Container = require('./container'),
	Context = require('../../context'),
	Template = require('../../template'),
	Switcher = require('./switcher');

var onOffErrorMessage = 'template .on/off/once(...) shoud only be used on containers or context or other object that implement on/off/once interface.';

var engine = {
	//___________________________________ Structure Flow
	each: require('./each').each,
	eachTemplates: function(context, node, args, container) {
		var templates = args[0],
			handler = args[1];
		templates.forEach(function(templ) {
			(handler ? handler(templ) : templ).call(node, context, container);
		});
	},
	if: function(context, node, args, container) {
		var condition = args[0],
			ok = condition,
			successTempl = args[1],
			failTempl = args[2];
		if (condition && condition.__interpolable__)
			ok = condition.output(context);
		else if (typeof condition === 'function')
			ok = condition.call(this, context);
		if (ok)
			successTempl.call(node, context, container);
		else if (failTempl)
			failTempl.call(node, context, container);
	},
	container: function(context, node, args, parentContainer) {
		var opt = args[0],
			template = args[1];
		var container = template.toContainer(context, parentContainer).appendTo(node);
		if (opt.lateMount)
			container.addWitness(opt.lateMount, node);
		else
			container.appendTo(node);
	},

	lateMount: function(context, node, args, container) {
		var handler = args[0],
			template = args[1],
			witness = document.createComment('late mount');
		node.appendChild(witness);
		handler(context, template, witness, container);
	},

	agoraView: function(context, node, args, container) {
		var channel = args[0],
			template = args[1];
		engine.lateMount(context, node, [function(context, template, witness, parentContainer) {
			var container;
			context.onAgora(channel + ':show', function(context, message) {
				if (!container) {
					container = template.toContainer(context, parentContainer);
					container.setWitness(witness);
				}
				container.context.set(message);
				if (!container.mounted)
					container.remount();
			});
			context.onAgora(channel + ':hide', function(context, message) {
				if (!container)
					return;
				container.context.set(message);
				if (container.mounted)
					container.unmount(true);
			});
		}, template, container]);
	},

	mountIf: function(context, node, args, container) {
		var condition = args[0];
		var templates = [{
			value: true,
			template: args[1]
		}];
		if (args[2])
			templates.push({
				value: false,
				template: args[2]
			});
		var sw = new Switcher(context, node, container, templates);
		sw.expression(condition);
	},
	switch: function(context, node, args, container) {
		var expression = args[0],
			map = args[1],
			templates = [];

		for (var i in map)
			if (i !== 'default')
				templates.push({
					value: i,
					template: map[i]
				});
		var sw = new Switcher(context, node, container, templates, map['default']);
		sw.expression(expression);
	},
	//_________________________________ local context management
	newContext: function(context, node, args) {
		var data = args[0],
			parent = args[1] || context,
			path = args[2];
		node.context = new Context(data, parent, path);
	},
	with: function(context, node, args, container) {
		var path = args[0],
			splitted = path.split('.'),
			template = args[1],
			ctx = new Context(typeof path === 'string' ? context.get(path) : path, context);
		ctx.binds = ctx.binds || [];
		// reverse bind : tell to parent when local changes
		ctx.subscribe('*', function(value, type, p, key) {
			if (this.freezed)
				return;
			var fullPath = path + (p === '$this' ? '' : ('.' + p));
			this.freezed = true;
			context.notify(type, fullPath, value, key);
			this.freezed = false;
		});
		/*
			

		 */
		// parent to local bind
		context.subscribe(path, function(value, type, p, key) {
			if (this.freezed)
				return
			var localPath = p.slice(splitted.length).join('.');
			switch (type) {
				case 'reset':
					ctx.reset(value);
					break;
				case 'set':
					//_________________ WARNING NOT FINISHED
					ctx.set(localPath, value);
					break;
				case 'push':
					ctx.push(localPath, value);
					break;
				case 'removeAt':
				case 'delete':
					ctx.del(localPath);
					break;
			}
		}, true, ctx.binds);
		template.call(node, ctx, container);
	},
	//_______________________________________ TAGS
	tag: function(context, parent, args, container) {
		var name = args[0],
			template = args[1],
			node = document.createElement(name);
		template.call(node, context, container);
		parent.appendChild(node);
	},
	text: function(context, parent, args) {
		var value = args[0],
			val,
			node;
		if (value.__interpolable__) {
			val = value.output(context);
			node = document.createTextNode(val);
			node.binds = node.binds || [];
			value.subscribeTo(context, function(value, type, path) {
				if (val !== value) {
					node.nodeValue = value;
					val = value;
				}
			}, node.binds);
		} else
			node = document.createTextNode(value);
		parent.appendChild(node);
	},
	br: function(context, parent) {
		parent.appendChild(document.createElement('br'));
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
		var xpr = args[0],
			val = xpr;
		var disable = function(value, type, path) {
			if (value)
				node.setAttribute('disabled');
			else
				node.removeAttribute('disabled');
		};
		if (xpr.__interpolable__) {
			node.binds = node.binds || [];
			val = xpr.output(context);
			xpr.subscribeTo(context, disable, node.binds);
			disable(xpr.output(context), 'set');
		} else
			disable((value !== undefined) ? value : true, 'set');
	},
	val: function(context, node, args) {
		var varPath = args[0],
			value = args[1],
			val = value;
		if (value.__interpolable__) {
			node.addEventListener('input', function(event) {
				var newVal = event.target.value;
				if (val === newVal)
					return;
				val = newVal;
				console.log('.val : textarea value : ', event.target.value)
				console.log('.val : textarea innerHTML : ', event.target.innerHTML)
				context.set(varPath, event.target.value);
			});
			node.binds = node.binds || [];
			val = value.output(context);
			value.subscribeTo(context, function(value, type, path) {
				if (value === val)
					return;
				if (node.tagName.toLowerCase() === 'textarea')
					node.value = value;
				else
					node.setAttribute('value', value);
				val = value;
			}, node.binds);
			node.setAttribute('value', val);
		} else
			node.setAttribute('value', value);
	},
	contentEditable: function(context, node, args) {
		var varPath = args[0],
			value = args[1],
			flag = args[2],
			freeze,
			val;

		if (value.__interpolable__) {
			val = value.output(context);
			var handler = function(event) {
				var newVal = event.target.textContent;
				if (val === newVal)
					return;
				val = newVal;
				freeze = true;
				context.set(varPath, val);
				freeze = false;
			};
			var flagValue = true;
			if (flag && flag.__interpolable__) {
				flagValue = flag.output(context);
				flag.subscribeTo(context, function(value, type, path, index) {
					if (value == flagValue)
						return;
					flagValue = value;
					if (value)
						node.addEventListener('input', handler);
					else
						node.removeEventListener('input', handler);
					node.setAttribute('contenteditable', !!value);
				});
			}
			if (flagValue) {
				node.addEventListener('input', handler);
				node.setAttribute('contenteditable', true);
			}
			node.binds = node.binds || [];
			value.subscribeTo(context, function(value, type, path, key) {
				if (freeze || value === val)
					return;
				val = value;
				node.textContent = value;
			}, node.binds);
		} else
			val = value;
		node.textContent = val;
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
		if (!node.on)
			throw new Error(onOffErrorMessage);
		node.on(args[0], args[1], [context]);
	},
	once: function(context, node, args) {
		if (!node.once)
			throw new Error(onOffErrorMessage);
		node.once(args[0], args[1], [context]);
	},
	off: function(context, node, args) {
		if (!node.off)
			throw new Error(onOffErrorMessage);
		node.off(args[0], args[1]);
	},
	//______________________________________________ CLIENT/SERVER
	client: function(context, node, args, container) {
		if (context.env.data.isServer)
			return;
		args[0].call(node, context, container);
	},
	server: function(context, node, args, container) {
		if (!context.env.data.isServer)
			return;
		args[0].call(node, context, container);
	},
	//_____________________________________ MISC
	suspendUntil: function(context, node, args, container) {
		var xpr = args[0],
			index = args[1],
			templ = args[2],
			val = xpr.__interpolable__ ? xpr.output(context) : xpr,
			rest = new Template(templ._queue.slice(index)),
			instance;
		if (val)
			rest.call(node, context, container);
		else if (xpr.__interpolable__)
			instance = xpr.subscribeTo(context, function(value, type, path) {
				if (value) {
					instance.destroy();
					rest.call(node, context, container);
				}
			});
	}
};

function _execQueue(node, queue, context, container) {
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
		if (f.__yTemplate__)
			f.call(node, node.context || context, container);
		else
			f(node.context || context, node, handler.args, container);
		if (handler.suspendAfter)
			break;
		handler = queue[++index];
	}
}

Template.prototype.call = function(node, context, container) {
	context = context || new Context();
	_execQueue(node, this._queue, context, container);
};

Template.prototype.toContainer = function(context, parent) {
	var container = new Container(parent);
	if (this._queue.length === 1 && this._queue[0].asContainer)
		return this._queue[0].args[1].toContainer(context, container);
	_execQueue(container, this._queue, context, container);
	return container;
};

module.exports = engine;
