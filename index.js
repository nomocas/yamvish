/*
	TODO : 
		parsing 
			from DOM
				still data-*
			from String

		context
			still $parent

		request and c3po

		views pool

		route

		client 

		promise management : catch end render / load

		y.dependent('this.bloupi', 'foo', function(bloupi, foo){});

		if('!initialised', ..., ...)

		query.call() ==> produce a virtual node

		.log familly

		view  = mix of Virtual + Query + own Context
		==> keep query queue in view
		==> allow up/bottom with query

		mount/umount event
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
			if (tmp && !(tmp = tmp[path[i]]))
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
			if (tmp && !(tmp = tmp[path[i]]))
				tmp = tmp[path[i]] = {};
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
	//_______________________________________________________ DATA BIND CONTEXT

	function Context(data, parent, subscribeTo) {
		this.data = data || {};
		this.parent = parent;
		this.map = {};
		this.subscribedTo = subscribeTo;
		var self = this;
		if (subscribeTo)
			this.bind = parent.subscribe(subscribeTo, function(type, path, value) {
				self.reset(value);
			});
	}

	Context.prototype = {
		destroy: function() {
			if (this.bind)
				this.bind();
			this.bind = null;
			this.parent = null;
			this.data = null;
		},
		reset: function(data) {
			this.data = data || {};
			this.notifyAll('reset', null, this.map, data);
			return this;
		},
		set: function(path, value) {
			if (!path.forEach)
				path = path.split('.');
			if (path[0] == '$parent') {
				if (this.parent)
					return this.parent.set(path.slice(1), value);
				throw produceError('there is no parent in current context. could not find : ' + path.join('.'));
			}
			this.data = this.data || {};
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
			this.data = this.data || {};
			var arr = getProp(this.data, path);
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
			var key;
			if (!path.forEach)
				path = path.split('.');
			else
				path = path.slice();
			if (path[0] == '$parent') {
				if (this.parent)
					return this.parent.del(path.slice(1));
				throw produceError('there is no parent in current context. could not find : ' + path.join('.'));
			}
			key = path.pop();
			var parent = getProp(this.data, path);
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

	var y = function(q) {
		return new y.Query(q);
	};

	y.isServer = (typeof process !== 'undefined') && process.versions && process.versions.node;
	y.Context = Context;
	//_______________________________________________________ QUERY

	y.Query = function(q) {
		this._queue = q ? q._queue.slice() : [];
	};

	y.Query.prototype = {
		call: function(caller, context) {
			return execQueue(caller, this._queue, context ||  caller.context);
		},
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
					ok = condition.output(context.data);
					(this.binds = this.binds || []).push(condition.subscribeTo(context, exec));
				} else if (type === 'function')
					ok = condition.call(this, context);

				return exec('set', ok);
			});
			return this;
		},
		all: function() {
			var args = arguments;
			return this.done(function() {
				var promises = [];
				for (var i = 0, len = args.length; i < len; ++i)
					promises.push(args[i].call(this));
				return Promise.all(promises);
			});
		},
		set: function(path, value) {
			return this.done(function(context) {
				if (!context)
					context = this.context = new Context();
				context.set(path, value);
			});
		},
		context: function(value) {
			var parentPath;
			if (typeof value === 'string')
				parentPath = value;
			return this.done(function(context) {
				this.context = new Context(parentPath ? null : value, context, parentPath ? parentPath : null);
			});
		},
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
		with: function(path) {
			return this.done(function(context) {
				this.childrenContext = new Context(null, context, path);
			});
		},
		attr: function(name, value) {
			if (typeof value === 'string')
				value = interpolable(value);
			return this.done(function(context) {
				var self = this;
				if (value.__interpolable__) {
					(this.binds = this.binds || []).push(value.subscribeTo(context, function(type, path, newValue) {
						self.setAttribute(name, newValue);
					}));
					this.setAttribute(name, value.output(context.data));
				} else
					this.setAttribute(name, value);
			});
		},
		setClass: function(name, flag) {
			var len = arguments.length;
			return this.done(function() {
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
		on: function(name, handler) {
			return this.done(function(context) {
				var self = this,
					h;
				if (typeof handler === 'string') {
					if (!context.handlers)
						throw produceError('on(%s) : no "%s" handlers define in current context', name, handler);
					h = context.handlers[handler];
				} else
					h = handler;
				this.addEventListener(name, function(evt) {
					h.call(self, context, evt);
				});
			});
		},
		click: function(handler) {
			return this.on('click', handler);
		},
		off: function(name, handler) {
			return this.done(function() {
				this.removeEventListener(name, handler);
			});
		},
		val: function(value) {
			return this.attr('value', value);
		},
		text: function(value) {
			if (typeof value === 'string')
				value = interpolable(value);
			return this.done(function(context) {
				var node, val;
				if (value.__interpolable__) {
					val = value.output(context.data);
					(this.binds = this.binds || []).push(value.subscribeTo(context, function(type, path, newValue) {
						node.textContent = newValue;
						if (node.el)
							node.el.nodeValue = newValue;
					}));
				} else
					val = value;
				if (this.__yVirtual__) {
					node = new y.Virtual('textnode');
					node.textContent = val;
				} else
					node = document.createTextNode(val);
				emptyNode(this);
				this.appendChild(node);
			});
		},
		id: function(id) {
			return this.done(function() {
				this.id = id;
			});
		},
		tag: function(name) { // arguments : name, q1, q2, ...
			var args = arguments;
			return this.done(function(context) {
				var node;
				if (this.__yVirtual__)
					node = new y.Virtual(name);
				else
					node = document.createElement(name);
				var temp;
				for (var i = 1, len = args.length; i < len; ++i) {
					temp = args[i].call(node, this.childrenContext || context);
				}
				this.appendChild(node);
			});
		},
		div: function() {
			var args = Array.prototype.slice.call(arguments);
			args.unshift('div');
			return this.tag.apply(this, args);
		},
		each: function(path, templ) { // arguments : path, q1, q2, ...

			return this.done(function(context) {
				var template = templ || this._eachTemplate;

				if (!template)
					if (!y.isServer)
						template = this._eachTemplate = y.elementChildrenToQuery(this);
					else
						throw produceError('no template for .each query handler', this);

				var render = function(type, path, value, opt) {
					// console.log('render : ', type, path, value, opt);
					if (path.forEach)
						path = path.join('.');
					switch (type) {
						case 'reset':
						case 'set':
							emptyNode(self);
							for (var i = 0, len = value.length; i < len; ++i)
								template.call(self, new Context(value[i], context, path + '.' + i));
							break;
						case 'removeAt':
							destroy(self.childNodes[opt.index]);
							self.childNodes.splice(opt.index, 1);
							break;
						case 'push':
							template.call(self, new Context(value, context, path + '.' + opt.index));
							if (self.el)
								self.el.appendChild(self.childNodes[self.childNodes.length - 1].toElement());
							break;
					}
				};

				var self = this;
				(this.binds = this.binds || []).push(context.subscribe(path, render));
				var data = context.get(path);
				if (data)
					return render('set', path, data);
			});
		},
		push: function(path, value) {
			return this.done(function(context) {
				context.push(path, value);
			});
		},
		freeze: function() {
			return this.done(function() {

			});
		},
		unfreeze: function() {
		//__________ STILL TO DO
			return this.done(function() {

			});
		},
		router: function() {
			return this.done(function() {

			});
		},
		from: function(name) {
			return this.done(function() {

			});
		},
		load: function(path, uri, query) {
			return this.done(function() {

			});
		},
		css: function() {
			return this.done(function() {

			});
		}
	};

	y.call = function(node) { // args : node, q1, q2, ...
		var promises = [];
		for (var i = 1, len = arguments.length; i < len; ++i) {
			var p = arguments[i].call(node);
			if (p && p.then)
				promises.push(p);
		}
		if (promises.length)
			return Promise.all(promises);
	};
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
	y.Virtual = function(tagName, context) {
		// mock
		this.tagName = tagName;
		this.classList = new ClassList();
		this.__yVirtual__ = true;
		this.context = context;
	};

	y.Virtual.prototype  = {
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

	/**
	 * DOM element.childNodes parsing to y.Query
	 * @param  {[type]} element [description]
	 * @param  {[type]} query   [description]
	 * @return {[type]}         [description]
	 */
	y.elementChildrenToQuery = function elementChildrenToQuery(element, query) {
		var t = query || y();
		for (var i = 0, len = element.childNodes.length; i < len; ++i)
			elementToQuery(element.childNodes[i], t);
		return t;
	};
	/**
	 * DOM element parsing to y.Query
	 * @param  {[type]} element [description]
	 * @param  {[type]} query   [description]
	 * @return {[type]}         [description]
	 */
	y.elementToQuery = function elementToQuery(element, query) {
		var t = query || y();
		switch (element.nodeType) {
			case 1:
				// if (element.tagName.toLowerCase() === 'script')
				// console.log('CATCH script');
				var childQuery = y();
				elementChildrenToQuery(element, childQuery);
				if (element.id)
					childQuery.id(element.id)
				if (element.attributes.length)
					for (var j = 0, len = element.attributes.length; j < len; ++j) {
						var o = element.attributes[j];
						childQuery.attr(o.name, o.value);
					}
				for (var l = 0; l < element.classList; ++l)
					childQuery.setClass(element.classList[l]);
				t.tag.apply(t, [element.tagName.toLowerCase(), childQuery]);
				break;
			case 3:
				t.text(element.textContent);
				break;
			case 4:
				console.log('element is CDATA : ', element);
				break;
			default:
				console.warn('k : error : DOM node not managed : type : %s, ', element.nodeType, element);
		}
		return t;
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
					callback(type, path, self.output(context.data));
				}));
			if (binds.length == 1)
				return binds[0];
			return function() {
				binds.forEach(function(bind) {
					bind();
				});
			};
		},
		output: function(data) {
			if (this.directOutput)
				return getProp(data, this.directOutput);
			var out = "",
				odd = true;
			for (var j = 0, len = this.splitted.length; j < len; ++j) {
				if (odd)
					out += this.splitted[j];
				else
					out += getProp(data, this.splitted[j]);
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
	y.interpolable = interpolable;

	//_______________________________________________________ DOM PARSING
	//____________________________________________________ END PARSING
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
			var node = new y.Virtual(this.tagName);
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
