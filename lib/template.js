/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

(function() {

	"use strict";

	var utils = require('./utils'),
		env = require('./env'),
		interpolable = require('./interpolable').interpolable,
		PureNode = require('./pure-node'),
		openTags = require('./parsers/open-tags'),
		Container = require('./container'),
		Context = require('./context'),
		listenerParser = require('./parsers/listener-call');

	function StringOutputDescriptor() {
		this.attributes = '';
		this.classes = '';
		this.children = '';
		this.style = '';
	}

	//_______________________________________________________ TEMPLATE

	function Template(t) {
		this.__yTemplate__ = true;
		if (t) {
			this._queue = t._queue.slice();
			this._hasEach = t._hasEach;
		} else
			this._queue = [];
	}

	var y = function() {
		return new Template();
	};

	var getEachTemplate = function(parent, templ) {
		templ = templ || parent._eachTemplate;
		if (!templ)
			throw utils.produceError('no template for .each template handler', parent);
		return templ;
	};

	function execQueue(callee, queue, context, container) {
		container = callee.__yContainer__ ? callee : container;
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
			r = handler.toElement.call(callee, callee.context || context, container);
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
		call: function(caller, context, container) {
			return execQueue(caller, this._queue, context, container);
		},
		toContainer: function(context, container) {
			var container = new Container();
			container.promise = execQueue(container, this._queue, context, container);
			return container;
		},
		toHTMLString: function(context, descriptor, container) {
			descriptor = descriptor ||  new StringOutputDescriptor();
			for (var i = 0, len = this._queue.length; i < len; ++i)
				if (this._queue[i].toHTMLString)
					this._queue[i].toHTMLString(context, descriptor, container);
			return descriptor.children;
		},
		//_____________________________ BASE Template handler (every template handler is from one of those two types (done or catch))
		exec: function(toElement, toHTMLString) {
			this._queue.push({
				toElement: toElement,
				toHTMLString: (toHTMLString === true) ? toElement : toHTMLString
			});
			return this;
		},
		log: function() {
			var args = Array.prototype.slice.call(arguments);
			return this.exec(function(context) {
				console.log.apply(console, args);
			}, true);
		},
		//_____________________________ Conditional branching
		'if': function(condition, trueCallback, falseCallback) {
			var type = typeof condition;
			if (type === 'string')
				condition = interpolable(condition);
			return this.exec(
				//to element
				function(context, container) {
					var ok = condition,
						self = this;
					var exec = function(type, path, ok) {
						if (ok)
							return trueCallback.call(self, self.context || context, container);
						else if (falseCallback)
							return falseCallback.call(self, self.context || context, container);
					};
					if (condition && condition.__interpolable__) {
						ok = condition.output(context);
						(this._binds = this._binds || []).push(condition.subscribeTo(context, exec));
					} else if (type === 'function')
						ok = condition.call(this, context);
					return exec('set', null, ok);
				},
				// to string
				function(context, descriptor, container) {
					var ok;
					if (condition && condition.__interpolable__)
						ok = condition.output(context);
					else if (type === 'function')
						ok = condition.call(this, context);
					if (ok)
						return trueCallback.toHTMLString(context, descriptor, container);
					else if (falseCallback)
						return falseCallback.toHTMLString(context, descriptor, container);
				}
			);
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
			return this.exec(
				// to element
				function(context, container) {
					// data, handlers, parent, path
					var ctx = new Context({
						data: typeof path === 'string' ? context.get(path) : path,
						parent: context,
						path: path
					})
					return template.call(this, ctx, container);
				},
				// to string
				function(context, descriptor, container) {
					var ctx = new Context({
						data: typeof path === 'string' ? context.get(path) : path,
						parent: context,
						path: path
					})
					var newDescriptor = new StringOutputDescriptor();
					template.toHTMLString(ctx, newDescriptor, container);
					descriptor.attributes += newDescriptor.attributes;
					if (newDescriptor.style)
						descriptor.style += newDescriptor.style;
					if (newDescriptor.classes)
						descriptor.classes += newDescriptor.classes;
					if (newDescriptor.children)
						descriptor.children += newDescriptor.children;
				}
			);
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
					var attributeUpdate = function(type, path, newValue) {
						self.setAttribute(name, newValue);
					};
					(this._binds = this._binds || []).push(value.subscribeTo(context, attributeUpdate));
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
					if (!env().isServer)
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
			return this.exec(function(context) {
				var self = this,
					node,
					val;
				this.setAttribute('contenteditable', true);
				if (value.__interpolable__) {
					val = context.get(value.directOutput);
					if (!env().isServer)
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
				node = env().factory.createTextNode(val);
				this.appendChild(node);
			}, function(context, descriptor) {
				descriptor.attributes += ' contenteditable';
			});
		},
		setClass: function(name, flag) {
			if (flag)
				flag = interpolable(flag);
			name = interpolable(name);
			flag = !arguments[1] ? true : flag;
			return this.exec(function(context) {
				var self = this,
					classValue = name,
					flagValue = flag;
				var flagUpdate = function(type, path, newValue) {
					// console.log('setClass : ', name, newValue);
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
					(this._binds = this._binds || []).push(name.subscribeTo(context, nameUpdate));
					classValue = name.output(context);
				}
				if (flag.__interpolable__) {
					(this._binds = this._binds || []).push(flag.subscribeTo(context, flagUpdate));
					flagUpdate('set', null, flag.output(context));
				} else
					flagUpdate('set', null, flag);
			}, function(context, descriptor) {
				if ((flag.__interpolable__ && flag.output(context)) || flag)
					descriptor.classes += ' ' + (name.__interpolable__ ? name.output(context) : name);
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
					if (!this.style)
						this.style = {};
					this.style[prop] = val;
				},
				// To String
				function(context, descriptor) {
					descriptor.style += prop + ':' + (value.__interpolable__ ? value.output(context) : value);
				}
			);
		},
		visible: function(flag) {
			flag = interpolable(flag);
			return this.exec(
				// to Element
				function(context) {
					var val = flag,
						self = this,
						initial = (this.style ? this.style.display : '') || '';
					if (!this.style)
						this.style = {};
					if (flag.__interpolable__) {
						val = flag.output(context);
						(this._binds = this._binds || []).push(flag.subscribeTo(context, function(type, path, newValue) {
							if (self.__yContainer__)
								newValue ? self.show() : self.hide();
							else
								self.style.display = newValue ? initial : 'none';
						}));
					}
					if (this.__yContainer__)
						val ? this.show() : this.hide();
					else
						this.style.display = val ? initial : 'none';
				},
				// To String
				function(context, descriptor) {
					var val = flag.__interpolable__ ? flag.output(context) : flag;
					if (!val)
						descriptor.style += 'display:none;';
				}
			);
		},
		//_______________________________________ HTML TAGS
		br: function() {
			return this.exec(function(context) {
				this.appendChild(env().factory.createElement('br'));
			}, function(context, descriptor) {
				descriptor.children += '<br>';
			});
		},
		text: function(value) {
			if (typeof value === 'string')
				value = interpolable(value);
			return this.exec(function(context) {
				var envi = env();
				var node;
				if (value.__interpolable__) {
					node = envi.factory.createTextNode(value.output(context));
					(this._binds = this._binds || []).push(value.subscribeTo(context, function(type, path, newValue) {
						if (node.__yVirtual__) {
							node.nodeValue = newValue;
							if (node.el && node.el.nodeValue !== newValue)
								node.el.nodeValue = newValue;
						}
						if (node.nodeValue !== newValue)
							node.nodeValue = newValue;
					}));
				} else
					node = envi.factory.createTextNode(value);
				this.appendChild(node);
			}, function(context, descriptor) {
				descriptor.children += value.__interpolable__ ? value.output(context) : value;
			});
		},
		tag: function(name) { // arguments : name, template1, t2, ...
			var args = [];
			for (var i = 1, len = arguments.length; i < len; ++i) {
				if (!arguments[i])
					continue;
				if (!arguments[i].call)
					args.push(y().text(arguments[i]));
				else
					args.push(arguments[i]);
			}
			return this.exec(
				// toElement
				function(context, container) {
					var node = env().factory.createElement(name),
						promises = [],
						p;
					// utils.hide(node);
					this.appendChild(node);
					for (var i = 0, len = args.length; i < len; ++i) {
						p = args[i].call(node, this.childrenContext || context, container);
						if (p && p.then)
							promises.push(p);
					}
					// utils.show(node);
					if (promises.length)
						if (promises.length === 1)
							return promises[0];
						else
							return Promise.all(promises);
				},
				// toHTMLString
				function(context, descriptor, container) {
					var out = '<' + name;
					if (this._id)
						out += ' id="' + this._id + '"';
					var newDescriptor = new StringOutputDescriptor();
					for (var i = 0, len = args.length; i < len; i++) {
						if (args[i].toHTMLString)
							args[i].toHTMLString(context, newDescriptor, container);
					}
					out += newDescriptor.attributes;
					if (newDescriptor.style)
						out += ' style="' + newDescriptor.style + '"';
					if (newDescriptor.classes)
						out += ' class="' + newDescriptor.classes + '"';
					if (newDescriptor.children)
						descriptor.children += out + '>' + newDescriptor.children + '</' + name + '>';
					else if (openTags.test(name))
						descriptor.children += out + '>';
					else if (/span|script|meta/.test(name))
						descriptor.children += out + '></' + name + '>';
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
		img: function(href) {
			var args = Array.prototype.slice.call(arguments, 1);
			args.unshift('img', y().attr('src', href));
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
			if (typeof handler === 'string')
				handler = listenerParser.parseListener(handler);
			return this.exec(function(context) {
				this.addEventListener(name, function(evt) {
					return handler.call(context, evt);
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
				function(context, container) {
					var self = this,
						template = getEachTemplate(this, templ),
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
						var p = template.call(child, ctx, container);
						if (p && p.then)
							promises.push(p);
						return child;
					}

					var render = function(type, path, value, index) {
						if (path && path.forEach)
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
								var mountPoint = fragment || self.mountPoint || self;
								nextSibling = fragment ? null : nextSibling;
								for (var len = value.length; j < len; ++j) // reset existing or create new node 
									if (container.childNodes[j]) // reset existing
										container.childNodes[j].context.reset(value[j]);
									else { // create new node
										var child = push(value[j], promises);
										if ((!self.__yPureNode__ || self.mountPoint) && child.childNodes)
											utils.mountChildren(child, mountPoint, nextSibling);
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
								return node.context.reset(value);
						}));
						data = context.get(path);
					}
					if (data)
						return render('set', path, data);
				},

				// toHTMLString
				function(context, descriptor, container) {
					var template = getEachTemplate(this, templ),
						nd = new StringOutputDescriptor(),
						values = (typeof path === 'string') ? context.get(path) : path;
					if (values)
						for (var i = 0, len = values.length; i < len; ++i)
							template.toHTMLString(new Context({
								data: values[i],
								parent: context
							}), nd, container);
					descriptor.children += nd.children;
				}
			);
		},
		use: function(name) {
			return this.exec(function(context, container) {
				if (typeof name === 'string') {
					var envi = env();
					name = envi.templates[name] || envi.views[name];
				}
				if (!name)
					throw new Error('no template/container found with "' + name + '"');
				if (name.__yContainer__)
					return name.mount(this, 'append');
				else
					return name.call(this, context, container);
			}, function(context, descriptor, container) {
				if (typeof name === 'string') {
					var envi = env();
					name = envi.templates[name] || envi.views[name];
				}
				if (!name)
					throw new Error('no template/container found with "' + name + '"');
				return name.toHTMLString(this, context, descriptor, container);
			});
		},
		client: function(templ) {
			return this.exec(function(context, container) {
				if (env().isServer)
					return;
				return templ.call(this, context, container);
			}, function(context, descriptor, container) {
				if (env().isServer)
					return;
				return templ.toHTMLString(context, descriptor, container);
			});
		},
		server: function(templ) {
			return this.exec(function(context, container) {
				if (!env().isServer)
					return;
				return templ.call(this, context, container);
			}, function(context, descriptor, container) {
				if (!env().isServer)
					return;
				return templ.toHTMLString(context, descriptor, container);
			});
		},

		api: function(name) {
			var Api = (typeof name === 'string') ? env().api[name] : name;
			if (!Api)
				throw new Error('no template api found with : ' + name);
			for (var i in Api) {
				if (!Api.hasOwnProperty(i))
					continue;
				this[i] = Api[i];
			}
			return this;
		},

		find: function(selector, handler) {
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
		},

		contentSwitch: function(xpr, map) {
			xpr = interpolable(xpr);
			return this.exec(function(context, container) {
				var current, dico = utils.shallowCopy(map),
					self = this;
				var valueUpdate = function(type, path, value) {
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
				(this._binds = this._binds || []).push(xpr.subscribeTo(context, valueUpdate));
				return valueUpdate('set', null, xpr.output(context));
			}, function(context, descriptor, container) {

			});
		},

		cssSwitch: function(cssVar, xpr, map) {
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
		},

		html: function(fragment, condition, success) {
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
		}
	};



	Template.addAPI = function(api) {
		for (var i in api)
			Template.prototype[i] = api[i];
	};

	Template.prototype.cl = Template.prototype.setClass;

	// Complete tag list
	['div', 'span', 'ul', 'li', 'button', 'p', 'form'].forEach(function(tag) {
		Template.prototype[tag] = function() {
			var args = Array.prototype.slice.call(arguments);
			args.unshift(tag);
			return this.tag.apply(this, args);
		};
	});
	// Complete events list
	['click', 'blur', 'focus', 'submit'].forEach(function(eventName) {
		Template.prototype[eventName] = function(handler) {
			if (env().isServer)
				return;
			return this.on(eventName, handler);
		};
	});

	module.exports = Template;
})();
