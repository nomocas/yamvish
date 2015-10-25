/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

(function() {

	"use strict";

	var utils = require('./utils'),
		env = require('./env'),
		interpolable = require('./interpolable').interpolable,
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

	function execQueue(callee, queue, context, factory) {
		var handler = queue[0],
			nextIndex = 0,
			promises = [],
			r;
		while (handler) {
			nextIndex++;
			if (!handler.toElement) {
				handler = queue[nextIndex];
				continue;
			}
			r = handler.toElement.call(callee, context, factory);
			if (r && r.then)
				promises.push(r);
			handler = queue[nextIndex];
		}
		if (promises.length)
			if (Promise.length === 1)
				return promises[0];
			else
				return Promise.all(promises);
	}

	Template.prototype = {
		call: function(caller, context, factory) {
			return execQueue(caller, this._queue, context, factory || (env().isServer ? Virtual : document));
		},
		toContainer: function(context, factory) {
			var container = new Container({
				factory: factory
			});
			container.promise = execQueue(container, this._queue, context, factory || (env().isServer ? Virtual : document));
			return container;
		},
		toString: function(context, descriptor) {
			descriptor = descriptor ||  new StringOutputDescriptor();
			for (var i = 0, len = this._queue.length; i < len; ++i)
				if (this._queue[i].toString)
					this._queue[i].toString(context, descriptor);
			return descriptor.children;
		},
		//_____________________________ BASE Template handler (every template handler is from one of those two types (done or catch))
		exec: function(toElement, toString) {
			this._queue.push({
				toElement: toElement,
				toString: (toString === true) ? toElement : toString
			});
			return this;
		},
		log: function() {
			var args = arguments;
			return this.exec(function(context, factory) {
				console.log.apply(console, args);
			}, true);
		},
		//_____________________________ Conditional branching
		'if': function(condition, trueCallback, falseCallback) {
			var type = typeof condition;
			if (type === 'string')
				condition = interpolable(condition);
			return this.exec(function(context, factory) {
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
			return this.exec(function(context) {
				context.set(path, value);
			}, true);
		},
		dependent: function(path, args, func) {
			return this.exec(function(context) {
				context.dependent(path, args, func);
			}, true);
		},
		push: function(path, value) {
			return this.exec(function(context) {
				context.push(path, value);
			}, true);
		},
		del: function(path) {
			return this.exec(function(context) {
				context.del(path);
			}, true);
		},
		context: function(value) {
			var parentPath;
			if (typeof value === 'string')
				parentPath = value;
			return this.exec(function(context) {
				this.context = new Context({
					data: parentPath ? null : value,
					parent: context,
					path: parentPath ? parentPath : null
				});
			}, true);
		},
		sub: function(path, handler, upstream) {
			return this.exec(function(context) {
				context.subscribe(path, handler, upstream);
			});
		},
		unsub: function(path, handler, upstream) {
			return this.exec(function(context) {
				context.unsubscribe(path, handler, upstream);
			});
		},
		with: function(path, template) {
			return this.exec(function(context, factory) {
				// data, handlers, parent, path
				var ctx = new Context({
					data: typeof path === 'string' ? context.get(path) : path,
					parent: context,
					path: path
				})
				return template.call(this, ctx, factory);
			}, function(context, descriptor) {
				var ctx = new Context({
					data: typeof path === 'string' ? context.get(path) : path,
					parent: context,
					path: path
				})
				var newDescriptor = new StringOutputDescriptor();
				template.toString(ctx, newDescriptor)
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
			return this.exec(function(context) {
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
			return this.exec(function(context) {
				this.removeAttribute(name);
			}, function(context, descriptor) {
				// todo : remove attr from descriptor.attributes
			});
		},
		disabled: function(value) {
			var invert = false;
			if (value && value[0] === '!') {
				value = value.substring(1);
				invert = true;
			}
			return this.exec(function(context) {
				var self = this;
				var disable = function(type, path, newValue) {
					if (invert)
						newValue = !newValue;
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
			var varPath;
			if (typeof value === 'string') {
				value = interpolable(value);
				if (value.__interpolable__) {
					if (value.dependenciesCount !== 1)
						throw new Error("template.val expression could only depend to one variable.");
					varPath = value.parts[1].dep[0];
				}
			}
			return this.exec(function(context) {
				var self = this;
				if (value.__interpolable__) {
					if (!utils.isServer)
						this.addEventListener('input', function(event) {
							context.set(varPath, event.target.value);
						});
					(this._binds = this._binds || []).push(value.subscribeTo(context, function(type, path, newValue) {
						self.setAttribute('value', newValue);
					}));
					this.setAttribute('value', value.output(context));
				} else
					this.setAttribute('value', value);
			}, function(context, descriptor) {
				descriptor.attributes += ' value="' + (value.__interpolable__ ? value.output(context) : value) + '"';
			});
		},
		contentEditable: function(value) {
			if (typeof value === 'string')
				value = interpolable(value);
			return this.exec(function(context, factory) {
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
			var invert = false;
			if (flag && flag[0] === '!') {
				flag = flag.substring(1);
				invert = true;
			}
			return this.exec(function(context) {
				var self = this;

				function applyClass(type, path, newValue) {
					if (invert)
						newValue = !newValue;
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
				if (flag === undefined || (invert ? !context.get(flag) : context.get(flag)))
					descriptor.classes += ' ' + name;
			});
		},
		css: function(prop, value) {
			if (typeof value === 'string')
				value = interpolable(value);
			return this.exec(
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
			var invert = false;
			if (flag[0] === '!') {
				flag = flag.substring(1);
				invert = true;
			}
			return this.exec(
				// to Element
				function(context) {
					var val = flag,
						self = this,
						initial = (this.style ? this.style.display : '') || '';
					if (!this.style)
						this.style = {};
					if (typeof flag === 'string') {
						val = context.get(flag);
						(this._binds = this._binds || []).push(context.subscribe(flag, function(type, path, newValue) {
							if (invert)
								newValue = !newValue;
							self.style.display = newValue ? initial : 'none';
						}));
					}
					if (invert)
						val = !val;
					this.style.display = val ? initial : 'none';
				},
				// To String
				function(context, descriptor) {
					var val = typeof flag === 'string' ? context.get(flag) : flag;
					if (invert)
						val = !val;
					if (!val)
						descriptor.style += 'display:none;';
				}
			);
		},
		//_______________________________________ HTML TAGS
		text: function(value) {
			if (typeof value === 'string')
				value = interpolable(value);
			return this.exec(function(context, factory) {
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
			return this.exec(
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
						if (promises.length === 1)
							return promises[0];
						else
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
			return this.exec(function(context) {
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
			return this.exec(function() {
				this.removeEventListener(name, handler);
			});
		},
		//___________________________________________ Collection
		each: function(path, templ) {
			this._hasEach = true;
			return this.exec(
				// toElement
				function(context, factory) {
					var self = this,
						template = getEachTemplate(this, templ),
						promises = [],
						container = new PureNode();
					container.childNodes = [];
					if (this.__yPureNode__)
						this.appendChild(container);
					else
						(this._yamvish_containers = this._yamvish_containers || []).push(container);

					function push(value, promises) {
						var ctx = new Context({
								data: value,
								parent: context
							}),
							child = new PureNode();
						child.context = ctx;
						container.childNodes.push(child);
						var p = template.call(child, ctx, factory);
						if (p && p.then)
							promises.push(p);
						return child;
					}

					var render = function(type, path, value, index) {
						if (path.forEach)
							path = path.join('.');
						switch (type) {
							case 'reset':
							case 'set':
								var j = 0,
									fragment,
									promises = [],
									//parent = (!self.__yPureNode__ || self.mountPoint) && (self.mountPoint || self),
									//showAtEnd = false,
									nextSibling = (!self.__yPureNode__ || self.mountPoint) ? utils.findNextSibling(container) : null;

								// if (parent) {
								// 	if (parent.style.display != 'none') {
								// 		parent.style.display = 'none';
								// 		showAtEnd = true;
								// 	}
								// 	// fragment = document.createDocumentFragment();
								// }
								for (var len = value.length; j < len; ++j) // reset existing or create new node 
									if (container.childNodes[j]) // reset existing
										container.childNodes[j].context.reset(value[j]);
									else { // create new node
										var child = push(value[j], promises);
										if ((!self.__yPureNode__ || self.mountPoint) && child.childNodes)
											utils.mountChildren(child, fragment || self.mountPoint || self, fragment ? null : nextSibling);
									}
									// fragment is used to append children (all in one time) without reflow
									// if (fragment && fragment.children.length) {
									// 	// console.log('add fragment : ', fragment.children.length)
									// 	if (nextSibling)
									// 		(self.mountPoint || self).insertBefore(fragment, nextSibling);
									// 	else
									// 		(self.mountPoint || self).appendChild(fragment);
									// }
									// delete additional nodes that is not used any more
								if (j < container.childNodes.length) {
									var end = j,
										lenJ = container.childNodes.length;
									for (; j < lenJ; ++j)
										utils.destroyElement(container.childNodes[j], true);
									container.childNodes.splice(end);
								}
								// if (showAtEnd)
								// 	parent.style.display = '';
								if (promises.length)
									return Promise.all(promises);
								break;
							case 'removeAt':
								utils.destroyElement(container.childNodes[index], true);
								container.childNodes.splice(index, 1);
								break;
							case 'push':
								var nextSibling = utils.findNextSibling(container),
									promises = [],
									child = push(value, promises);
								if ((!self.__yPureNode__ || self.mountPoint) && child.childNodes)
									utils.mountChildren(child, self.mountPoint || self, nextSibling);
								if (promises.length)
									return promises[0];
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
			return this.exec(function(context, factory, promises) {

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
