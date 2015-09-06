/*
	TODO : 
		parsing 
			from DOM
				still data-*
			from String

		request and c3po

		views pool

		.client( t1, t2, ...)
		.server(t1, t2, ...)

		promise management : catch end render / load

		if('!initialised', ..., ...)

		template.call() ==> produce a virtual node

		.log familly

		view  = mix of Virtual + Template + Context
		==> keep template queue in view
		==> allow up/bottom with template

		==> view.context = view; 

		mount/umount event

		EAch : children  : place els in Virtual Node (could be many)
			==> is natural : no need... each node has it's own dom element
		//______________________
		y.dependent('bloupi', 'foo', function(bloupi, foo){});
		
		==> a dependent function should only be a value in context.data
			that is registred to dependencies (as a Interpolable)

		y.applyToDOM(node | selector, template)		==> apply template on dom element (select it if selector)

		y.createDOM(opt) ==> meme opt que new Virtual(opt)

*/
(function() {

	//__________________________________________________________ UTILS

	function produceError(msg, report) {
		var e = new Error(msg);
		e.report = report;
		return e;
	}

	function isDOMElement(node) {
		return (typeof HTMLElement !== 'undefined' && this instanceof HTMLElement);
	}

	function emptyNode(node) {
		if (isDOMElement(this)) {
			while (this.firstChild)
				this.removeChild(this.firstChild);
		} else
			this.childNodes = [];
	}

	function execHandler(node, fn, context) {
		try {
			return fn.call(node, node.context || context);
		} catch (e) {
			return e;
		}
	}

	function execQueue(node, queue, context, error) {
		var handler = queue[0],
			nextIndex = 0,
			r;
		while (handler) {
			nextIndex++;
			if (error) {
				if (handler.type !== 'catch') {
					handler = queue[nextIndex];
					continue;
				}
				r = execHandler(node, handler.fn, context, error);
				error = null;
			} else {
				if (handler.type === 'catch') {
					handler = queue[nextIndex];
					continue;
				}
				r = execHandler(node, handler.fn, context);
				if (r && r.then) {
					var rest = queue.slice(nextIndex);
					return r.then(function(s) {
						return execQueue(node, rest, context);
					}, function(e) {
						return execQueue(node, rest, context, e);
					});
				}
			}
			if (r instanceof Error)
				error = r;
			handler = queue[nextIndex];
		}
		if (error)
			console.error('has error : ', error, error.stack);
		return error || r;
	}

	function getProp(from, path) {
		if ((path.forEach && path[0] === '$this') || path === '$this')
			return from;
		if (!path.forEach)
			path = path.split('.');
		var tmp = from;
		for (var i = 0, len = path.length; i < len; ++i)
			if (!tmp || (tmp = tmp[path[i]]) === undefined)
				return;
		return tmp;
	}

	function deleteProp(from, path) {
		if (!path.forEach)
			path = path.split('.');
		var tmp = from,
			i = 0;
		for (len = path.length - 1; i < len; ++i)
			if (tmp && !(tmp = tmp[path[i]]))
				return;
		if (tmp)
			delete tmp[path[i]];
	}

	function setProp(to, path, value) {
		if (!path.forEach)
			path = path.split('.');
		var tmp = to,
			i = 0,
			old,
			len = path.length - 1;
		for (; i < len; ++i)
			if (tmp && !tmp[path[i]])
				tmp = tmp[path[i]] = {};
			else
				tmp = tmp[path[i]];
		if (tmp) {
			old = tmp[path[i]];
			tmp[path[i]] = value;
		}
		return old;
	}

	function destroy(node) {
		if (node.context) {
			node.context.destroy();
			node.context = null;
		}
		if (node.childrenContext) {
			node.childrenContext.destroy();
			node.childrenContext = null;
		}
		if (node.__yVirtual__) {
			node.attributes = null;
			node.classList = null;
			node.listeners = null;
			if (node.el && node.el.parentNode)
				node.el.parentNode.removeChild(node.el);
			node.el.parentNode = null;
			node.el = null;
			if (node.binds)
				for (var i = 0; i < node.binds.length; i++)
					node.binds[i]();
		} else if (node.parentNode) {
			node.parentNode.removeChild(node);
			node.parentNode = null;
		}
	}

	function mergeProto(src, target) {
		for (var i in src) {
			if (target[i] === undefined)
				target[i] = src[i];
			else if (src[i].__composition__)
				target[i] = src[i]._clone()._bottom(target[i]);
			else {
				target[i] = src[i];
			}
		}
	};

	//_______________________________________________________ DATA BIND CONTEXT

	function Context(opt /*data, handlers, parent, path*/ ) {
		opt = opt || {};
		this.data = (opt.data !== undefined) ? opt.data : {};
		this.parent = opt.parent;
		this.handlers = opt.handlers || {};
		this.map = {};
		this.path = opt.path;
		var self = this;
		if (opt.path)
			(this.binds = this.binds || []).push(this.parent.subscribe(opt.path, function(type, path, value) {
				self.reset(value);
			}));
	}

	Context.prototype = {
		destroy: function() { // at least for special trick, should not be called directly. 
			if (this.binds)
				this.binds.forEach(function(unbind) {
					unbind();
				});
			this.binds = null;
			this.parent = null;
			this.data = null;
			this.handlers = null;
			this.map = null;
		},
		reset: function(data) {
			this.data = data || {};
			this.notifyAll('reset', null, this.map, data);
			return this;
		},
		set: function(path, value) {
			if (!path.forEach)
				path = path.split('.');
			if (path[0] === '$this')
				return this.reset(value);
			if (path[0] === '$parent') {
				if (this.parent)
					return this.parent.set(path.slice(1), value);
				throw produceError('there is no parent in current context. could not find : ' + path.join('.'));
			}
			var old = setProp(this.data, path, value);
			if (old !== value)
				this.notify('set', path, value);
			return this;
		},
		push: function(path, value) {
			if (!path.forEach)
				path = path.split('.');
			if (path[0] == '$parent') {
				if (this.parent)
					return this.parent.push(path.slice(1), value);
				throw produceError('there is no parent in current context. could not find : ' + path.join('.'));
			}
			var arr;
			if (path[0] === '$this')
				arr = this.data;
			else
				arr = getProp(this.data, path);
			if (!arr) {
				arr = [];
				setProp(this.data, path, arr);
			}
			arr.push(value);
			this.notify('push', path, value, {
				index: arr.length - 1
			});
			return this;
		},
		del: function(path) {
			if (!path.forEach)
				path = path.split('.');
			else
				path = path.slice();
			if (path[0] == '$parent') {
				if (this.parent)
					return this.parent.del(path.slice(1));
				throw produceError('there is no parent in current context. could not find : ' + path.join('.'));
			}
			var key = path.pop(),
				parent = path.length ? getProp(this.data, path) : this.data;
			if (parent)
				if (parent.forEach) {
					var index = parseInt(key, 10);
					parent.splice(index, 1);
					this.notify('removeAt', path, null, {
						index: index
					});
				} else {
					delete parent[key];
					this.notify('delete', path, null);
				}
			return this;
		},
		get: function(path) {
			if (!path.forEach)
				path = path.split('.');
			if (path[0] === '$this')
				return this.data;
			if (path[0] == '$parent') {
				if (this.parent)
					return this.parent.get(path.slice(1));
				throw produceError('there is no parent in current context. could not find : ' + path.join('.'));
			}
			return getProp(this.data, path);
		},
		subscribe: function(path, fn, upstream) {
			if (!path.forEach)
				path = path.split('.');
			var space;
			if (path[0] === '$this')
				space = this.map;
			else if (path[0] === '$parent') {
				if (this.parent)
					return this.parent.subscribe(path.slice(1), fn, upstream);
				throw produceError('there is no parent in current context. could not find : ' + path.join('.'));
			} else
				space = getProp(this.map, path);
			if (upstream) {
				if (!space)
					setProp(this.map, path, {
						_upstreams: [fn]
					});
				else
					(space._upstreams = space_upstreams || []).push(fn);
			} else if (!space)
				setProp(this.map, path, {
					_listeners: [fn]
				});
			else
				(space._listeners = space._listeners || []).push(fn);
			var self = this;
			return function() {
				self.unsubscribe(path, fn, upstream);
			};
		},
		unsubscribe: function(path, fn, upstream) {
			if (!path.forEach)
				path = path.split('.');
			var space;
			if (path[0] === '$this')
				space = this.map;
			else if (path[0] === '$parent') {
				if (this.parent)
					return this.parent.unsubscribe(path.slice(1), fn, upstream);
				throw produceError('there is no parent in current context. could not find : ' + path.join('.'));
			} else
				space = getProp(this.map, path);
			if (!space)
				return;
			var arr = upstream ? space._upstreams : space._listeners;
			for (var i = 0, len = arr.length; i < len; ++i)
				if (arr[i] === fn) {
					arr.splice(i, 1);
					return;
				}
			return this;
		},
		notifyAll: function(type, path, space, value, opt) {
			space = space ||  this.map;
			value = (arguments.length < 2) ? this.data : value;
			if (space._listeners)
				for (var i = 0, len = space._listeners.length; i < len; ++i)
					space._listeners[i](type, path, value, opt);
			if (type !== 'push' && type !== 'removeAt')
				for (var j in space) {
					if (j === '_listeners' || j === '_upstreams')
						continue;
					this.notifyAll(type, path, space[j], value ? value[j] : undefined);
				}
			return this;
		},
		notify: function(type, path, value, opt) {
			// console.log('Notify : ', type, path, value, opt);
			if (!path.forEach)
				path = path.split('.');
			if (path[0] === '$this')
				path = [];
			var space = this.map;
			for (var i = 0, len = path.length; i < len; ++i) {
				if (space && !(space = space[path[i]]))
					return this;
				if (space._upstreams)
					for (var i = 0, len = space._upstreams.length; i < len; ++i)
						space._upstreams[i](type, path, value, opt);
			}
			this.notifyAll(type, path, space, value, opt);
			return this;
		}
	};

	//_______________________________________________________ QUERY

	function Template(q) {
		this._queue = q ? q._queue.slice() : [];
	};

	Template.prototype = {
		//_____________________________ APPLY QUERY ON NODE
		call: function(caller, context) {
			return execQueue(caller, this._queue, context ||  caller.context);
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
					throw produceError('no context avaiable to set variable in it. aborting.', this);
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
				destroy(this, context);
			});
		},
		remove: function() {
			return this.done(function() {
				remove(this);
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
					y().on('input', function(event) {
						context.set(value.directOutput, event.target.value);
					}).call(this, context);
					(this.binds = this.binds || []).push(value.subscribeTo(context, function(type, path, newValue) {
						self.setAttribute('value', newValue);
					}));
					this.setAttribute('value', context.get(value.directOutput));
				} else
					this.setAttribute('value', value);
			});
		},
		setClass: function(name, flag) {
			var len = arguments.length;
			return this.done(function(context) {
				var self = this;
				var applyClass = function(type, path, newValue) {
					if (newValue) {
						self.classList.add(name);
						if (self.el)
							self.el.classList.add(name);
					} else {
						self.classList.remove(name);
						if (self.el)
							self.el.classList.remove(name);
					}
				};
				if (flag) {
					(this.binds = this.binds || []).push(context.subscribe(flag, applyClass));
					applyClass('set', null, context.get(flag));
				} else
					applyClass('set', null, true);
			});
		},
		//___________________________________ EVENTS LISTENER
		on: function(name, handler) {
			return this.done(function(context) {
				var h;
				if (typeof handler === 'string') {
					if (!context.handlers) {
						// console.log('error no handler in context : ', context.handlers);
						throw produceError('on(' + name + ') : no "' + handler + '" handlers define in current context', this);
					}
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
				emptyNode(this);
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
		//___________________________________________ ARRAY
		each: function(path, templ) { // arguments : path, q1, q2, ...

			return this.done(function(context) {
				var template = templ || this._eachTemplate,
					self = this;

				if (!template)
					if (!y.isServer)
						template = this._eachTemplate = elementChildrenToTemplate(this);
					else
						throw produceError('no template for .each template handler', this);

				var render = function(type, path, value, opt) {
					// console.log('render : ', type, path, value, opt);
					if (path.forEach)
						path = path.join('.');
					switch (type) {
						case 'reset':
						case 'set':
							emptyNode(self);
							for (var i = 0, len = value.length; i < len; ++i)
							/*data, handlers, parent, path*/
								template.call(self, new Context({
								data: value[i],
								parent: context,
								path: path + '.' + i
							}));
							break;
						case 'removeAt':
							destroy(self.childNodes[opt.index]);
							self.childNodes.splice(opt.index, 1);
							break;
						case 'push':
							template.call(self, new Context({
								data: value,
								parent: context,
								path: path + '.' + opt.index
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
		freeze: function() {
			return this.done(function() {

			});
		},
		unfreeze: function() {
			return this.done(function() {

			});
		},
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
	//_______________________________________________________ CLASS LIST

	/**
	 * ClassList mockup for Virtual
	 */
	var ClassList = function() {
		this.classes = {};
	};
	ClassList.prototype = {
		add: function(name) {
			this.classes[name] = true;
		},
		remove: function(name) {
			delete this.classes[name];
		}
	};
	//_______________________________________________________ VIRTUAL

	/**
	 * Virtual Node
	 * @param {String} tagName the tagName of the virtual node
	 */
	function Virtual(opt /*tagName, context*/ ) {
		// mock
		opt = opt || {};
		this.tagName = opt.tagName;
		this.classList = new ClassList();
		this.__yVirtual__ = true;
		if (opt.context)
			this.context = opt.context;
		var ctx = opt.context || y.mainContext;
		if (opt.template)
			if (!ctx)
				throw produceError("no context could be found when initialising Virtual with template. aborting.", this);
			else
				opt.template.call(this, ctx);

	};

	Virtual.prototype  = {
		// _____________________________ MOCK STANDARD NODE
		setAttribute: function(name, value) {
			(this.attributes = this.attributes || {})[name] = value;
			if (this.el)
				this.el.setAttribute(name, value);
		},
		addEventListener: function(type, listener) {
			this.listeners = this.listeners || {};
			(this.listeners[type] = this.listeners[type] || []).push(listener);
			if (this.el)
				this.el.addEventListener(name, value);
		},
		removeEventListener: function(type, listener) {
			if (!this.listeners || !this.listeners[type])
				return;
			for (var i = 0, list = this.listeners[type], len = list.length; i < len; ++i)
				if (list[i] === listener) {
					list.splice(i, 1);
					break;
				}
			if (this.el)
				this.el.removeEventListener(name, value);
		},
		appendChild: function(child) {
			(this.childNodes = this.childNodes || []).push(child);
			if (this.el)
				this.el.appendChild(child.toElement());
			return child;
		},
		// _____________________________ OUTPUT
		/**
		 * Virtual to DOM element output
		 * @return {HTMLElement} the HTMLElement représentation of Virtual node
		 */
		toElement: function() {
			if (this.tagName === 'textnode')
				return this.el = document.createTextNode(this.textContent);
			var node = document.createElement(this.tagName);
			if (this.id)
				node.id = this.id;
			for (var a in this.attributes)
				node.setAttribute(a, this.attributes[a]);
			for (var c in this.classList.classes)
				node.classList.add(c);
			if (this.childNodes)
				for (var j = 0, len = this.childNodes.length; j < len; ++j)
					node.appendChild(this.childNodes[j].toElement());
			for (var k in this.listeners)
				for (var l = 0, len = this.listeners[k].length; l < len; ++l)
					node.addEventListener(k, this.listeners[k][l]);
			return this.el = node;
		},
		/**
		 * Virtual to String output
		 * @return {String} the String représentation of Virtual node
		 */
		toString: function() {
			if (this.tagName === 'textnode')
				return this.textContent;
			var node = '<' + this.tagName;
			if (this.id)
				node += ' id="' + this.id + '"';
			for (var a in this.attributes)
				node += ' ' + a + '="' + this.attributes[a] + '"';
			var classes = Object.keys(this.classList.classes);
			if (classes.length)
				node += ' class="' + classes.join(' ') + '">';
			else
				node += '>\n';
			if (this.childNodes)
				for (var j = 0, len = this.childNodes.length; j < len; ++j)
					node += this.childNodes[j].toString() + '\n';
			node += '</' + this.tagName + '>';
			return node;
		}
	};

	//_______________________________________________________ INTERPOLABLE

	var Interpolable = function(splitted) {
		this.__interpolable__ = true;
		if (splitted.length === 3 && splitted[0] === "" && splitted[2] === "") {
			this.directOutput = splitted[1];
			this.dependencies = [splitted[1]];
		} else {
			this.splitted = splitted;
			this.dependencies = [];
			for (var i = 1, len = splitted.length; i < len; i = i + 2)
				this.dependencies.push(splitted[i]);
		}
	};
	Interpolable.prototype = {
		subscribeTo: function(context, callback) {
			var binds = [],
				self = this;
			for (var i = 0, len = this.dependencies.length; i < len; ++i)
				binds.push(context.subscribe(this.dependencies[i], function(type, path, newValue) {
					callback(type, path, self.directOutput ? newValue : self.output(context));
				}));
			if (binds.length == 1)
				return binds[0];
			return function() {
				binds.forEach(function(bind) {
					bind();
				});
			};
		},
		output: function(context) {
			if (this.directOutput)
				return context.get(this.directOutput);
			var out = "",
				odd = true;
			for (var j = 0, len = this.splitted.length; j < len; ++j) {
				if (odd)
					out += this.splitted[j];
				else
					out += context.get(this.splitted[j]);
				odd = !odd;
			}
			return out;
		}
	};

	var splitRegEx = /\{\{\s*([^\}\s]+)\s*\}\}/g;

	function interpolable(string) {
		var splitted = string.split(splitRegEx);
		if (splitted.length == 1)
			return string; // string is not interpolable
		return new Interpolable(splitted);
	};

	//_______________________________________________________ DOM PARSING

	/**
	 * DOM element.childNodes parsing to y.Template
	 * @param  {[type]} element [description]
	 * @param  {[type]} template   [description]
	 * @return {[type]}         [description]
	 */
	function elementChildrenToTemplate(element, template) {
		var t = template || y();
		for (var i = 0, len = element.childNodes.length; i < len; ++i)
			elementToTemplate(element.childNodes[i], t);
		return t;
	};
	/**
	 * DOM element parsing to y.Template
	 * @param  {[type]} element [description]
	 * @param  {[type]} template   [description]
	 * @return {[type]}         [description]
	 */
	function elementToTemplate(element, template) {
		var t = template || y();
		switch (element.nodeType) {
			case 1:
				// if (element.tagName.toLowerCase() === 'script')
				// console.log('CATCH script');
				var childTemplate = y();
				elementChildrenToTemplate(element, childTemplate);
				if (element.id)
					childTemplate.id(element.id)
				if (element.attributes.length)
					for (var j = 0, len = element.attributes.length; j < len; ++j) {
						var o = element.attributes[j];
						childTemplate.attr(o.name, o.value);
					}
				for (var l = 0; l < element.classList; ++l)
					childTemplate.setClass(element.classList[l]);
				t.tag.apply(t, [element.tagName.toLowerCase(), childTemplate]);
				break;
			case 3:
				t.text(element.textContent);
				break;
			case 4:
				console.log('element is CDATA : ', element);
				break;
			default:
				console.warn('y.elementToTemplate : DOM node not managed : type : %s, ', element.nodeType, element);
		}
		return t;
	};

	//____________________________________________________ YAMVISH

	var y = function(q) {
		return new Template(q);
	};
	//____________________________________________________ VIEW
	y.View = function View(opt) {
		opt = opt || {};
		this.context = opt.context = this;
		if (opt.componentName)
			y.addComponent(opt.componentName, this);
		Context.call(this, opt);
		Virtual.call(this, opt);
	}
	mergeProto(Virtual.prototype, y.View.prototype);
	mergeProto(Template.prototype, y.View.prototype);
	mergeProto(Context.prototype, y.View.prototype);
	y.View.prototype.done = function(fn) {
		fn.call(this, this);
		return this;
	};
	delete y.View.prototype['catch'];
	delete y.View.prototype.call;
	delete y.View.prototype.id;

	//________________________________________________ END VIEW

	y.mainContaxt = null;
	y.components = {};
	y.addComponent = function(name, template /* or view instance */ ) {
		y.components[name] = template;
	};

	y.isServer = (typeof process !== 'undefined') && process.versions && process.versions.node;
	y.Context = Context;
	y.Template = Template;

	y.elementChildrenToTemplate = elementChildrenToTemplate;
	y.elementToTemplate = elementToTemplate;
	y.interpolable = interpolable;
	y.Virtual = Virtual;
	y.Interpolable = Interpolable;

	if (typeof module !== 'undefined')
		module.exports = y;
	else
		this.y = y;
})()


/*


	function copy(obj, deep) {
		if (obj && typeof obj === 'object') {
			if (obj.forEach)
				return deep ? obj.slice() : obj.map(function(item) {
					return copy(item, true);
				});
			for (var i in obj)
				output[i] = deep ? copy(obj[i], true) : obj[i];
		}
		return output;
	}

		cloneNode: function(deep) {
			var node = new Virtual(this.tagName);
			node.id = this.id;
			if (this.attributes)
				node.attributes = copy(this.attributes);
			node.classList.classes = copy(this.classList.classes);
			if (this.listeners)
				node.listeners = copy(this.listeners, true);
			if (!deep || !this.childNodes)
				return node;
			this.childNodes.forEach(function(child) {
				node.appendChild(child.cloneNode(true));
			});
			return node;
		},


 */
