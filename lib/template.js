/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

(function() {

	"use strict";

	var utils = require('./utils'),
		interpolable = require('./interpolable').interpolable,
		// expression = require('./parsers/expression'),
		dom = require('./parsers/dom-to-template'),
		Virtual = require('./virtual'),
		PureNode = require('./pure-node'),
		Container = require('./container'),
		Context = require('./context');

	function StringOutputDescriptor() {
		this.attributes = '';
		this.classes = '';
		this.children = '';
		this.style = '';
	}

	//_______________________________________________________ TEMPLATE

	function Template(t) {
		if (t) {
			this._queue = t._queue.slice();
			this._hasEach = t._hasEach;
		} else
			this._queue = [];
	};

	var y = function() {
		return new Template()
	};

	var getEachTemplate = function(parent, templ) {
		templ = templ || parent._eachTemplate;
		if (!templ)
			throw utils.produceError('no template for .each template handler', parent);
		return templ;
	}

	function execHandler(callee, fn, context, factory) {
		try {
			return fn.call(callee, callee.context || context, factory);
		} catch (e) {
			return e;
		}
	}

	function execQueue(callee, queue, context, factory, error) {
		var handler = queue[0],
			nextIndex = 0,
			r;
		while (handler) {
			nextIndex++;
			if (error) {
				if (handler.type !== 'catch' || !handler.toElement) {
					handler = queue[nextIndex];
					continue;
				}
				r = execHandler(callee, handler.toElement, context, factory);
				error = null;
			} else {
				if (handler.type === 'catch' || !handler.toElement) {
					handler = queue[nextIndex];
					continue;
				}
				r = execHandler(callee, handler.toElement, context, factory);
				/*if (r && r.then) {
					var rest = queue.slice(nextIndex);
					return r.then(function(s) {
						return execQueue(callee, rest, context, factory);
					}, function(e) {
						return execQueue(callee, rest, context, factory, e);
					});
				}*/
			}
			if (r instanceof Error)
				error = r;
			handler = queue[nextIndex];
		}
		if (error)
			console.error('y.Template exec error : ', error, error.stack);
		return error || r;
	}

	Template.prototype = {
		call: function(caller, context, factory) {
			return execQueue(caller, this._queue, context, factory || (utils.isServer ? Virtual : document));
		},
		toElement: function(context, factory) {
			var caller = new Container({
					factory: factory
				}),
				output = execQueue(caller, this._queue, context, factory || (utils.isServer ? Virtual : document));
			return caller;
		},
		toString: function(context, descriptor) {
			descriptor = descriptor ||  new StringOutputDescriptor();
			for (var i = 0, len = this._queue.length; i < len; ++i)
				if (this._queue[i].toString)
					this._queue[i].toString(context, descriptor);
			return descriptor.children;
		},
		//_____________________________ BASE Template handler (every template handler is from one of those two types (done or catch))
		done: function(toElement, toString) {
			this._queue.push({
				type: 'done',
				toElement: toElement,
				toString: (toString === true) ? toElement : toString
			});
			return this;
		},
		'catch': function(toElement, toString) {
			this._queue.push({
				type: 'catch',
				toElement: toElement,
				toString: (toString === true) ? toElement : toString
			});
			return this;
		},
		//_____________________________ Conditional branching
		'if': function(condition, trueCallback, falseCallback) {
			var type = typeof condition;
			if (type === 'string')
				condition = interpolable(condition);
			return this.done(function(context, factory) {
				var ok = condition,
					self = this;
				var exec = function(type, path, ok) {
					if (ok)
						return trueCallback.call(self, context, factory);
					else if (falseCallback)
						return falseCallback.call(self, context, factory);
				};
				if (condition && condition.__interpolable__) {
					ok = condition.output(context);
					(this._binds = this._binds || []).push(condition.subscribeTo(context, exec));
				} else if (type === 'function')
					ok = condition.call(this, context);
				return exec('set', ok);
			}, function(context, descriptor) {
				var ok;
				if (condition && condition.__interpolable__)
					ok = condition.output(context);
				else if (type === 'function')
					ok = condition.call(this, context);
				if (ok)
					return trueCallback.toString(context, descriptor);
				else if (falseCallback)
					return falseCallback.toString(context, descriptor);
			});
			return this;
		},
		//________________________________ CONTEXT and Assignation
		set: function(path, value) {
			return this.done(function(context) {
				context = context || this.context;
				if (!context)
					throw utils.produceError('no context avaiable to set variable in it. aborting.', this);
				context.set(path, value);
			}, true);
		},
		push: function(path, value) {
			return this.done(function(context) {
				context.push(path, value);
			}, true);
		},
		del: function(path) {
			return this.done(function(context) {
				context.del(path);
			}, true);
		},
		setHandler: function(name, handler) {
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
			}, true);
		},
		sub: function(path, handler, upstream) {
			return this.done(function(context) {
				context.subscribe(path, handler, upstream);
			});
		},
		unsub: function(path, handler, upstream) {
			return this.done(function(context) {
				context.unsubscribe(path, handler, upstream);
			});
		},
		with: function(path, template) {
			return this.done(function(context, factory) {
				// data, handlers, parent, path
				var ctx = new Context({
					data: typeof path === 'string' ? context.get(path) : path,
					parent: context,
					path: path
				})
				template.call(this, ctx, factory);
			}, function(context, descriptor) {
				var newDescriptor = new StringOutputDescriptor();
				template.toString(context, newDescriptor)
				descriptor.attributes += newDescriptor.attributes;
				if (newDescriptor.style)
					descriptor.style += newDescriptor.style;
				if (newDescriptor.classes)
					descriptor.classes += newDescriptor.classes;
				if (newDescriptor.children)
					descriptor.children += newDescriptor.children;
			});
		},
		//__________________________________ Attributes
		attr: function(name, value) {
			if (typeof value === 'string')
				value = interpolable(value);
			(this._attributes = this._attributes || []).push({
				name: name,
				value: value
			});
			return this.done(function(context) {
				var self = this,
					val = value;
				if (value.__interpolable__) {
					val = value.output(context);
					(this._binds = this._binds || []).push(value.subscribeTo(context, function(type, path, newValue) {
						self.setAttribute(name, newValue);
					}));
				}
				this.setAttribute(name, val);
			}, function(context, descriptor) {
				descriptor.attributes += ' ' + name;
				if (value)
					descriptor.attributes += '="' + (value.__interpolable__ ? value.output(context) : value) + '"';
				return '';
			});
		},
		removeAttr: function(name) {
			return this.done(function(context) {
				this.removeAttribute(name);
			}, function(context, descriptor) {
				// todo : remove attr from descriptor.attributes
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
					(this._binds = this._binds || []).push(context.subscribe(value, disable));
					disable('set', null, context.get(value));
				} else
					disable('set', null, (value !== undefined) ? value : true);
			}, function(context, descriptor) {
				if (value === undefined || context.get(value))
					descriptor.attributes += ' disabled';
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
					(this._binds = this._binds || []).push(value.subscribeTo(context, function(type, path, newValue) {
						self.setAttribute('value', newValue);
					}));
					this.setAttribute('value', context.get(value.directOutput));
				} else
					this.setAttribute('value', value);
			}, function(context, descriptor) {
				descriptor.attributes += ' value="' + (value.__interpolable__ ? value.output(context) : value) + '"';
			});
		},
		contentEditable: function(value) {
			if (typeof value === 'string')
				value = interpolable(value);
			return this.done(function(context, factory) {
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
					(this._binds = this._binds || []).push(value.subscribeTo(context, function(type, path, newValue) {
						if (!self.freeze) {
							self.nodeValue = newValue;
							if (self.el)
								self.el.nodeValue = newValue;
						}
						self.freeze = false;
					}));
				} else
					val = value;
				node = factory.createTextNode(val);
				this.appendChild(node);
			}, function(context, descriptor) {
				descriptor.attributes += ' contenteditable';
			});
		},
		setClass: function(name, flag) {
			return this.done(function(context) {
				var self = this;

				function applyClass(type, path, newValue) {
					if (newValue)
						utils.setClass(self, name);
					else
						utils.removeClass(self, name);
				};

				if (flag !== undefined) {
					if (typeof flag === 'string') {
						(this._binds = this._binds || []).push(context.subscribe(flag, applyClass));
						applyClass('set', null, context.get(flag));
					} else
						applyClass('set', null, flag);
				} else
					applyClass('set', null, true);
			}, function(context, descriptor) {
				if (flag === undefined || context.get(flag))
					descriptor.classes += ' ' + name;
			});
		},
		css: function(prop, value) {
			if (typeof value === 'string')
				value = interpolable(value);
			return this.done(
				// to Element
				function(context) {
					var val = value,
						self = this;
					if (value.__interpolable__) {
						val = value.output(context);
						(this._binds = this._binds || []).push(value.subscribeTo(context, function(type, path, newValue) {
							self.style[prop] = newValue;
						}));
					}
					(this.style = this.style || {})[prop] = val;
				},
				// To String
				function(context, descriptor) {
					descriptor.style += prop + ':' + (value.__interpolable__ ? value.output(context) : value);
				}
			);
		},
		visible: function(flag) {
			return this.done(
				// to Element
				function(context) {
					var val = flag,
						self = this,
						initial = (this.style ? this.style.display : 'block') || 'block';
					if (!this.style)
						this.style = {};
					if (typeof flag === 'string') {
						val = context.get(flag);
						(this._binds = this._binds || []).push(context.subscribe(flag, function(type, path, newValue) {
							self.style.display = newValue ? initial : 'none';
						}));
					}
					this.style.display = val ? initial : 'none';
				},
				// To String
				function(context, descriptor) {
					var val = typeof flag === 'string' ? context.get(flag) : flag;
					if (!val)
						descriptor.style += 'display:none;';
				}
			);
		},
		//_______________________________________ HTML TAGS
		text: function(value) {
			if (typeof value === 'string')
				value = interpolable(value);
			return this.done(function(context, factory) {
				var node;
				if (value.__interpolable__) {
					node = factory.createTextNode(value.output(context));
					(this._binds = this._binds || []).push(value.subscribeTo(context, function(type, path, newValue) {
						if (node.__yVirtual__) {
							node.nodeValue = newValue;
							if (node.el)
								node.el.nodeValue = newValue;
						}
						node.nodeValue = newValue;
					}));
				} else
					node = factory.createTextNode(value);
				this.appendChild(node);
			}, function(context, descriptor) {
				descriptor.children += value.__interpolable__ ? value.output(context) : value;
			});
		},
		tag: function(name) { // arguments : name, template1, t2, ...
			var args = [];
			for (var i = 1, len = arguments.length; i < len; ++i) {
				if (!arguments[i].call)
					args.push(y().text(arguments[i]));
				else
					args.push(arguments[i]);
			}
			return this.done(
				// toElement
				function(context, factory) {
					var node = factory.createElement(name),
						promises = [],
						p;
					for (var i = 0, len = args.length; i < len; ++i) {
						p = args[i].call(node, this.childrenContext || context, factory);
						if (p && p.then)
							promises.push(p);
					}
					this.appendChild(node);
					if (promises.length)
						return Promise.all(promises);
				},
				// toString
				function(context, descriptor) {
					var out = '<' + name;
					if (this._id)
						out += ' id="' + this._id + '"';
					var newDescriptor = new StringOutputDescriptor();
					for (var i = 0, len = args.length; i < len; i++) {
						if (args[i].toString)
							args[i].toString(context, newDescriptor);
					}
					out += newDescriptor.attributes;
					if (newDescriptor.style)
						out += ' style="' + newDescriptor.style + '"';
					if (newDescriptor.classes)
						out += ' class="' + newDescriptor.classes + '"';
					if (newDescriptor.children)
						descriptor.children += out + '>' + newDescriptor.children + '</' + name + '>';
					else
						descriptor.children += out + '/>';
				}
			);
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
		//___________________________________________ Collection
		each: function(path, templ) {
			this._hasEach = true;
			return this.done(
				// toElement
				function(context, factory) {
					var self = this,
						template = getEachTemplate(this, templ),
						container = new PureNode();
					container.childNodes = [];
					if (this.__yPureNode__)
						this.appendChild(container);
					else
						(this._yamvish_containers = this._yamvish_containers || []).push(container);

					function push(value, nextSibling) {
						var ctx = new Context({
								data: value,
								parent: context
							}),
							child = new PureNode();
						child.context = ctx;
						container.childNodes.push(child);
						template.call(child, ctx, factory);
						if ((!self.__yPureNode__ || self.mountPoint) && child.childNodes)
							utils.mountChildren(child, self.mountPoint || self, nextSibling);
					}

					var render = function(type, path, value, index) {
						if (path.forEach)
							path = path.join('.');
						switch (type) {
							case 'reset':
							case 'set':
								var j = 0,
									nextSibling = (!self.__yPureNode__ || self.mountPoint) ? utils.findNextSibling(container) : null;
								for (var len = value.length; j < len; ++j)
									if (container.childNodes[j])
										container.childNodes[j].context.reset(value[j]);
									else
										push(value[j], nextSibling);
								if (j < container.childNodes.length) {
									var end = j,
										lenJ = container.childNodes.length;
									for (; j < lenJ; ++j)
										utils.destroyElement(container.childNodes[j], true);
									container.childNodes.splice(end);
								}
								break;
							case 'removeAt':
								utils.destroyElement(container.childNodes[index], true);
								container.childNodes.splice(index, 1);
								break;
							case 'push':
								push(value, (!self.__yPureNode__ || self.mountPoint) ? utils.findNextSibling(container) : null);
								break;
						}
					};
					var data = path;
					if (typeof path === 'string') {
						(this._binds = this._binds || []).push(context.subscribe(path, render));
						(this._binds = this._binds || []).push(context.subscribe(path + '.*', function(type, path, value, key) {
							var node = container.childNodes[key];
							if (node)
								node.context.reset(value);
						}));
						data = context.get(path);
					}
					if (data)
						return render('set', path, data);
				},

				// toString
				function(context, descriptor) {
					var template = getEachTemplate(this, templ),
						nd = new StringOutputDescriptor(),
						values = (typeof path === 'string') ? context.get(path) : path;
					if (values)
						for (var i = 0, len = values.length; i < len; ++i)
							template.toString(new Context({
								data: values[i],
								parent: context
							}), nd);
					descriptor.children += nd.children;
				}
			);
		},
		//__________ STILL TO DO
		from: function(name) {
			return this.done(function(context, factory, promises) {

			}, function(context, descriptor, promises) {

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

})();


/*


	Parser : 
		split html texts in static/interpolable atoms
		interpret with new Function() to allow complexe expression

	Should :

		rename _yamvish_binds in _binds
		rename all privates vars with _*

		for each template handler : 
		add args in queue (through done) and place inner functions outside : no more closure

	Context with *

		could register to path.*
		and receive the * as key  +  value
		then items[key].reset(value)

			Should be OK : to be tested more accurately

	Eacher : 

		hybrid structure ?												OK
			virtual that could contains real DOM node in childNodes

		associate to real DOMNode that execute 'each' the virtual node that hold children  		OK

		DOMNode.childNodes = [ flat array of real nodes ]
		DOMNode.virtuals = [ Virtual nodes that hold structure (pure + hybrid) ] 

		ok but what about deletion ?

			through virtual structure get DOM nodes references, delete them

		ok what about push or insert/growing with deco just after ?

			apply template on new virtual pure/hybrid node for structure 
			insert its childNodes just after last node from structure

		==> maybe introduce special token/tag/comment for each/filter/sort 
			=> it resolves the html/js template equivalence
		e.g. 

			<div ...>
				<h1>...</h1>
				<each:users filter="name" sort="lastname">
						

				</each>
				...
				<each:events>
					

				</each>
				...
				<todo-list:todoId  />
			</div>



	ES5/6

		get setter for
			textContent/nodeValue

		arrows everywhere

		arguments manip

		simple interpolation

		classes


		...



	Usage


		var templ = y.html.toTemplate('<div>...</div>');




		var string = templ.toString(context);

		// or

		templ.toElement(context)
		.then(function(virtual){
			// virtual has been fully constructed
			virtual.mount('#myid');
			context.set('loading', false);
		});


		//...
		virtual.unmount();
		
		virtual.appendTo(".bloupi")
		virtual.prependTo(".bloupi")

		//... 
		virtual.destroy();



		virtual.childNodes == [ DOMNodes ]
		virtual.children = [ Virtuals ]

		//_________________________


		var node = document.createElement('div');


		var virtual = templ.call(node, context);



 */
