/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * Pure DOM engine (modern browser first).
 *
 * Applies everything (binds, loads, events, ...) directly on DOM node.
 * No virtual DOM. Here it's simply replaced with arrays of (nested) functions that keep binds.
 * Ultra Fast.
 */
var utils = require('../../utils'),
	Context = require('../../context').Context,
	Template = require('../../template'),
	domutils = require('./utils');

utils.shallowMerge(domutils, utils);

var Switcher = require('./switcher'),
	Container = require('./container');

function findEventActor(name, context, node, container) {
	var splitted = name.split('.'),
		out = {
			actor: node,
			name: name
		};
	if (splitted.length == 2) {
		switch (splitted[0]) {
			case 'context':
				out.actor = context;
				break;
			case 'container':
				out.actor = container;
				break;
			default:
				throw new Error('unrecognized template.on event path : ' + name);
		}
		out.name = splitted[1];
	}
	return out;
}

var engine = {
	//___________________________________ Structure Flow
	each: require('./each'),
	eachTemplates: function(context, node, args, container) {
		var templates = args[0],
			handler = args[1];
		templates.forEach(function(templ) {
			(handler ? handler(templ) : templ).toDOM(node, context, container);
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
			successTempl.toDOM(node, context, container);
		else if (failTempl)
			failTempl.toDOM(node, context, container);
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
			context.onAgora(channel + ':toggle', function(emitter, message) {
				if (!container || !container.mounted || container.closing)
					this.toAgora(channel + ':show', message);
				else
					this.toAgora(channel + ':hide', message);
			});
			context.onAgora(channel + ':show', function(emitter, message) {
				if (!container) {
					container = new Template().view(template).toContainer(this, parentContainer);
					container.witness = witness;
				}
				if (message)
					container.context.reset(message);
				container.remount();
				container.emit('shown', container)
			});
			context.onAgora(channel + ':hide', function(emitter, message) {
				if (!container)
					return;
				if (message)
					container.context.reset(message);
				if (container.mounted)
					container.unmount(true);
			});
		}, template, container]);
	},
	mountIf: function(context, node, args, container) {
		var condition = args[0],
			templates = [{
				value: true,
				template: args[1]
			}];
		if (args[2])
			templates.push({
				value: false,
				template: args[2]
			});
		new Switcher(context, node, container, templates).expression(condition);
	},
	switch: function(context, node, args, container) {
		var expression = args[0],
			map = args[1],
			destructOnSwitch = args[2],
			sequencedSwitch = args[3],
			templates = [];
		for (var i in map)
			templates.push({
				value: i,
				template: map[i]
			});
		new Switcher(context, node, container, templates, destructOnSwitch, sequencedSwitch)
			.expression(expression);
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
			template = args[1],
			pathIsString = typeof path === 'string',
			ctx = new Context(pathIsString ? context.get(path) : path, context, pathIsString ? path : null),
			tempCtx = node.context;
		node.context = ctx;
		template.toDOM(node, ctx, container);
		node.context = tempCtx;
	},
	//_______________________________________ TAGS
	tag: function(context, parent, args, container) {
		var name = args[0],
			template = args[1],
			node = document.createElement(name);
		template.toDOM(node, context, container);
		parent.appendChild(node);
	},
	text: function(context, parent, args) {
		var value = args[0],
			node;
		if (value.__interpolable__) {
			var val = value.output(context);
			node = document.createTextNode(val);
			node.binds = node.binds || [];
			value.subscribeTo(context, function(value, type, path) {
				node.nodeValue = value;
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
	prop: function(context, node, args) {
		var name = args[0],
			value = args[1],
			val = args[1];

		var attributeUpdate = function(value) {
			if (value)
				node[name] = true;
			else
				node[name] = false;
		};

		if (value && value.__interpolable__) {
			val = value.output(context);
			node.binds = node.binds || [];
			value.subscribeTo(context, attributeUpdate, node.binds);
		}
		attributeUpdate(val);
	},
	data: function(context, node, args) {
		var name = args[0],
			value = args[1],
			val = args[1];

		var attributeUpdate = function(value) {
			if (typeof value === 'undefined')
				value = '';
			node.dataset[name] = value;
		};

		if (value && value.__interpolable__) {
			val = value.output(context);
			node.binds = node.binds || [];
			value.subscribeTo(context, attributeUpdate, node.binds);
		}
		attributeUpdate(val);
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
				context.set(varPath, event.target.value);
			});
			node.binds = node.binds || [];
			val = value.output(context);
			value.subscribeTo(context, function(value, type, path) {
				if (value === val)
					return;
				node.value = value;
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
			castTo = args[3],
			eventName = args[4],
			onUpdate = args[5],
			freeze,
			val;

		if (castTo !== 'html')
			node.addEventListener('keypress', function(evt) {
				if (evt.which === 13)
					evt.preventDefault();
			});

		if (value.__interpolable__) {
			val = value.output(context);
			node.binds = node.binds || [];
			var handler = function(event) {
				var newVal = utils.castNodeValueTo(node, castTo);
				if (val === newVal)
					return;
				val = newVal;
				if (!val)
					node.classList.add('empty');
				else
					node.classList.remove('empty');
				freeze = true;
				context.set(varPath, val);
				freeze = false;
				if (onUpdate)
					onUpdate.call(context, {
						context: context,
						path: varPath,
						node: node,
						value: val
					});
			};
			var flagValue = true;
			if (flag && flag.__interpolable__) {
				flagValue = !!flag.output(context);
				flag.subscribeTo(context, function(value, type, path, index) {
					if (value == flagValue)
						return;
					flagValue = value;
					if (value)
						node.addEventListener(eventName, handler);
					else
						node.removeEventListener(eventName, handler);
					node.contentEditable = !!value;
				}, node.binds);
			} else
				node.contentEditable = !!flag;

			if (flagValue) {
				node.addEventListener(eventName, handler);
				node.contentEditable = true;
			}
			value.subscribeTo(context, function(value, type, path, key) {
				if (freeze || value === val)
					return;
				val = value;
				node.textContent = value;
				node.classList[!value ? 'add' : 'remove']('empty');
			}, node.binds);
		} else
			val = value;
		node.textContent = val;
		node.classList[!val ? 'add' : 'remove']('empty');
	},
	setClass: function(context, node, args) {
		var name = args[0],
			flag = args[1],
			classValue = name,
			flagValue;
		var flagUpdate = function(value, type, path) {
			flagValue = value;
			try {
				if (value)
					node.classList.add(classValue);
				else
					node.classList.remove(classValue);
			} catch (e) {
				console.error('error while setting node class with : ', node, classValue);
			}
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
	on: function(context, node, args, container) {
		var parsed = findEventActor(args[0], context, node, container);
		if (parsed.actor.on)
			parsed.actor.on(parsed.name, args[1], [context]);
		else if (parsed.actor.addEventListener) {
			var handler = function(e) {
				args[1].call(context, e);
			};
			parsed.actor.addEventListener(parsed.name, handler);
		}
	},
	once: function(context, node, args, container) {
		var parsed = findEventActor(args[0], context, node, container);
		if (parsed.actor.once)
			parsed.actor.once(parsed.name, args[1], [context]);
		else if (parsed.actor.addEventListener) {
			var handler = function(e) {
				parsed.actor.removeEventListener(parsed.name, handler)
				args[1].call(context, e);
			};
			parsed.actor.addEventListener(parsed.name, handler);
		}
	},
	off: function(context, node, args) {
		var parsed = findEventActor(args[0], context, node, container);
		if (parsed.actor.off)
			parsed.actor.off(parsed.name, args[1]);
		else if (parsed.actor.removeEventListener)
			parsed.actor.removeEventListener(parsed.name, args[1]);
	},
	//______________________________________________ CLIENT/SERVER
	client: function(context, node, args, container) {
		if (context.env.data.isServer)
			return;
		args[0].toDOM(node, context, container);
	},
	server: function(context, node, args, container) {
		if (!context.env.data.isServer)
			return;
		args[0].toDOM(node, context, container);
	},
	log: function(context, node, args, container) {
		console.log(args[0] ||  'yamvish template log');
		console.log('-> context', context);
		console.log('-> node', node);
		console.log('-> container', container);
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
			rest.toDOM(node, context, container);
		else if (xpr.__interpolable__)
			instance = xpr.subscribeTo(context, function(value, type, path) {
				if (value) {
					instance.destroy();
					rest.toDOM(node, context, container);
				}
			});
	},
	useFromContext: function(context, node, args, container) {
		var path = args[0],
			useArgs = args[1],
			val,
			update = function(value) {
				if (value === val)
					return;
				val = value;
				container.empty();
				if (value) {
					var t = y();
					t.use.apply(t, [value].concat(useArgs))
						.toDOM(container, context);
				}
			};
		node.binds = node.binds || [];
		container.addWitness('use from context : ' + path);
		context.subscribe(path, update, false, node.binds);
		update(context.get(path));
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
			f.toDOM(node, node.context || context, container);
		else
			f(node.context || context, node, handler.args, container);
		if (handler.suspendAfter)
			break;
		handler = queue[++index];
	}
}

Template.prototype.toDOM = function(node, context, container) {
	context = context || new Context();
	_execQueue(node, this._queue, context, container);
};

Template.prototype.toContainer = function(context, parent) {
	context = context || new Context();
	var container = new Container(parent);
	if (this._queue.length === 1 && this._queue[0].asContainer)
		return this._queue[0].args[1].toContainer(context, container);
	_execQueue(container, this._queue, context, container);
	return container;
};

module.exports = engine;