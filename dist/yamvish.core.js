(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.y = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
// core
var y = function(t) {
	return new y.Template(t);
};
y.env = require('./lib/env');
y.utils = require('./lib/utils');
y.Context = require('./lib/context');
y.Template = require('./lib/template');
y.PureNode = require('./lib/pure-node');
// y.Virtual = require('./lib/virtual');
y.Container = require('./lib/container');
y.Filter = require('./lib/filter');
y.View = require('./lib/view');
var interpolable = require('./lib/interpolable');
y.interpolable = interpolable.interpolable;
y.Interpolable = interpolable.Interpolable;

module.exports = y;


/*
	Polyfills for IE8/9: 

	es6-promise or promis

 */

},{"./lib/container":3,"./lib/context":4,"./lib/env":6,"./lib/filter":7,"./lib/interpolable":8,"./lib/pure-node":9,"./lib/template":10,"./lib/utils":11,"./lib/view":12}],2:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var Emitter = require('./emitter'),
	utils = require('./utils');

var AsyncManager = function() {
	this._async = {
		count: 0,
		errors: [],
		successes: [],
		fails: [],
		callbacks: []
	};
	Emitter.call(this);
};

function remove(mgr) {
	mgr._async.count--;
	if (mgr._async.count <= 0)
		trigger(mgr);
}

function trigger(mgr) {
	var async = mgr._async,
		list = async.errors.length ? async.fails : async.successes,
		args = async.errors.length ? async.errors : true;
	if (mgr.dispatchEvent)
		mgr.dispatchEvent('done');
	for (var j = 0; j < list.length; j++)
		list[j](args);
	async.successes = [];
	async.fails = [];
	async.errors = [];
}

AsyncManager.prototype = {
	waiting: function(promise) {
		this._async.count++;
		var self = this;
		if (this.parent && this.parent.waiting)
			this.parent.waiting(promise);
		return promise.then(function(s) {
			remove(self);
			return s;
		}, function(e) {
			console.log('async waiting error : ', e);
			self._async.errors.push(e);
			remove(self);
			throw e;
		});
	},
	delay: function(func, ms) {
		var self = this;
		this._async.count++;
		if (this.parent && this.parent.delay)
			this.parent.delay(function() {}, ms);
		return setTimeout(function() {
			func();
			remove(self);
		}, ms);
	},
	done: function(func, fail) {
		var self = this;
		if (this._async.count === 0)
			return Promise.resolve(true).then(func, fail);
		return new Promise(function(resolve, reject) {
				self._async.successes.push(resolve);
				self._async.fails.push(reject);
			})
			.then(func, fail);
	},
	once: function(event, fct) {
		this._events = this._events || {};
		var self = this;
		(this._events[event] = this._events[event] || []).push(function(evt) {
			self.removeEventListener(event, fct);
			fct.call(this, evt);
		});
		return this;
	}
};

utils.mergeProto(Emitter.prototype, AsyncManager.prototype);

module.exports = AsyncManager;

},{"./emitter":5,"./utils":11}],3:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var utils = require('./utils'),
	PureNode = require('./pure-node'),
	Emitter = require('./emitter');

/**
 * Container Container
 */
function Container(opt /*tagName, context*/ ) {
	opt = opt || {};
	this.__yContainer__ = true;
	if (opt.parent)
		this.parent = opt.parent;
	this.childNodes = [];
	PureNode.call(this, opt);
};

Container.prototype  = {
	mount: function(selector, mode, querier) {
		if (this.destroyed)
			throw new Error('yamvish container has been destroyed. could not mount anymore.');
		if (selector && (selector === this.mountPoint || selector === this.mountSelector))
			return this;
		if (!this.childNodes)
			return this;
		var node = selector;
		if (typeof node === 'string') {
			this.mountSelector = selector;
			node = (querier || utils.domQuery)(selector);
		}
		if (!node)
			throw new Error('yamvish : mount point not found : ' + selector);
		this.mountPoint = node;
		if (!mode) // mount as innerHTML : empty node before appending
			utils.emptyNode(node);

		utils.mountChildren(this, node);

		(node._yamvish_containers = node._yamvish_containers || []).push(this);
		return this.dispatchEvent('mounted', this);
	},
	appendTo: function(selector, querier) {
		return this.mount(selector, 'append', querier);
	},
	unmount: function() {
		if (!this.mountPoint)
			return this;
		for (var i = 0; i < this.childNodes.length; i++)
			this.mountPoint.removeChild(this.childNodes[i]);
		this.mountPoint = null;
		this.mountSelector = null;
		return this.dispatchEvent('unmounted', this);
	},
	destroy: function() {
		if (this.destroyed)
			return this;
		this.dispatchEvent('destroy', this);
		this.destroyed = true;
		if (this.childNodes)
			for (var i = 0; i < this.childNodes.length; i++)
				utils.destroyElement(this.childNodes[i], true);
		this.childNodes = null;
		this.context = null;
		this.mountPoint = null;
		this.mountSelector = null;
		if (this._route)
			this._route = null;
	},
	hide: function() {
		if (this.destroyed)
			return this;
		this.childNodes.forEach(function(child) {
			child.style.display = 'none';
		});
	},
	show: function() {
		if (this.destroyed)
			return this;
		this.childNodes.forEach(function(child) {
			child.style.display = '';
		});
	},
	done: function(success, error) {
		if (this.destroyed)
			return Promise.reject(new Error('yamvish container has been destroyed : nothing to wait for.'));
		if (this.promise)
			return this.promise.then(success, error);
		return Promise.resolve(this).then(success);
	}
};

utils.mergeProto(PureNode.prototype, Container.prototype);
utils.mergeProto(Emitter.prototype, Container.prototype);

Container.prototype.appendChild = function(child) {
	PureNode.prototype.appendChild.call(this, child);
	if (this.mountPoint)
		this.mountPoint.appendChild(child);
	return child;
};
Container.prototype.removeChild = function(child) {
	if (!this.childNodes)
		return false;
	PureNode.prototype.removeChild.call(this, child);
	if (this.mountPoint)
		this.mountPoint.removeChild(child);
	return child;
};

module.exports = Container;

},{"./emitter":5,"./pure-node":9,"./utils":11}],4:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var utils = require('./utils'),
	AsyncManager = require('./async');
//_______________________________________________________ DATA BIND CONTEXT

function Context(opt /*data, handlers, parent, path*/ ) {
	opt = opt || {};
	this.data = (opt.data !== undefined) ? opt.data : {};
	if (opt.parent)
		this.parent = opt.parent;
	this.map = {};
	if (opt.path)
		this.path = opt.path;
	var self = this;
	this._binds = [];
	if (opt.path && this.parent)
		this._binds.push(this.parent.subscribe(opt.path, function(type, path, value) {
			self.reset(value);
		}));
	AsyncManager.call(this, opt);
}

Context.prototype = {
	destroy: function() {
		if (this._binds)
			this._binds.forEach(function(unbind) {
				unbind();
			});
		this._binds = null;
		this.parent = null;
		this.data = null;
		this.map = null;
	},
	dependent: function(path, dependencies, func) {
		var argsOutput = [],
			willFire,
			self = this;
		dependencies.forEach(function(dependency) {
			// subscribe to arguments[i]
			(this.binds = this.binds || []).push(this.subscribe(dependency, function(type, p, value, key) {
				if (!willFire)
					willFire = self.delay(function() {
						if (willFire) {
							willFire = null;
							var argsOutput = [];
							for (var i = 0, len = dependencies.length; i < len; ++i) {
								var depPath = dependencies[i];
								if (key === depPath)
									argsOutput.push(value);
								else
									argsOutput.push(self.get(depPath));
							}
							self.set(path, func.apply(self, argsOutput));
						}
					}, 0);
			}));
			argsOutput.push(this.get(dependency));
		});
		this.set(path, func.apply(this, argsOutput));
		return this;
	},
	reset: function(data) {
		this.data = data || {};
		this.notifyAll('reset', null, this.map, data, '*');
		return this;
	},
	toggle: function(path) {
		this.set(path, !this.get(path));
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
			throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
		}
		var old = utils.setProp(this.data, path, value);
		if (old !== value)
			this.notify('set', path, value, path[path.length - 1]);
		return this;
	},
	push: function(path, value) {
		if (!path.forEach)
			path = path.split('.');
		if (path[0] == '$parent') {
			if (this.parent)
				return this.parent.push(path.slice(1), value);
			throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
		}
		var arr;
		if (path[0] === '$this')
			arr = this.data;
		else
			arr = utils.getProp(this.data, path);
		if (!arr)
			throw new Error("yamvish.Context : Missing array at " + path.join(".") + " : couldn't push object.");
		if (!arr.forEach)
			throw new Error("yamvish.Context : Object is not array at " + path.join(".") + " : couldn't push object.");
		arr.push(value);
		this.notify('push', path, value, arr.length - 1);
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
			throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
		}
		var key = path.pop(),
			parent = path.length ? utils.getProp(this.data, path) : this.data;
		if (parent)
			if (parent.forEach) {
				var index = parseInt(key, 10);
				parent.splice(index, 1);
				this.notify('removeAt', path, null, index);
			} else {
				delete parent[key];
				this.notify('delete', path, null, key);
			}
		return this;
	},
	get: function(path) {
		if (!path.forEach)
			path = path.split('.');
		if (path[0] === '$this' && path.length === 1)
			return this.data;
		else if (path[0] == '$parent') {
			if (!this.parent)
				throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
			return this.parent.get(path.slice(1));
		}

		var r = utils.getProp(this.data, path);
		if (r === undefined)
			return '';
		return r;
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
			throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
		} else
			space = utils.getProp(this.map, path);
		if (upstream) {
			if (!space)
				utils.setProp(this.map, path, {
					_upstreams: [fn]
				});
			else
				(space._upstreams = space._upstreams || []).push(fn);
		} else if (!space)
			utils.setProp(this.map, path, {
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
			if (this.parent) {
				this.parent.unsubscribe(path.slice(1), fn, upstream);
				return this;
			}
			throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
		} else
			space = utils.getProp(this.map, path);
		if (!space)
			return this;
		var arr = upstream ? space._upstreams : space._listeners;
		for (var i = 0, len = arr.length; i < len; ++i)
			if (arr[i] === fn) {
				arr.splice(i, 1);
				break;
			}
		return this;
	},
	notifyAll: function(type, path, space, value, index) {
		space = space ||  this.map;
		value = (arguments.length < 2) ? this.data : value;
		if (space._listeners)
			for (var i = 0, len = space._listeners.length; i < len; ++i) {
				var r = space._listeners[i](type, path, value, index);
				if (r && r.then)
					this.waiting(r);
			}
		if (type !== 'push' && type !== 'removeAt')
			for (var j in space) {
				if (j === '_listeners' || j === '_upstreams')
					continue;
				this.notifyAll(type, path, space[j], value ? value[j] : undefined, index);
			}
		return this;
	},
	notify: function(type, path, value, index) {
		if (!path.forEach)
			path = path.split('.');
		if (path[0] === '$this')
			path = [];
		var space = this.map,
			i = 0,
			star;
		for (var len = path.length; i < len; ++i) {
			star = space['*'];
			if (star && star._upstreams)
				notifyUpstreams.call(this, star, type, path, value, index);
			if (!(space = space[path[i]]))
				break;
			if (space._upstreams)
				notifyUpstreams.call(this, space, type, path, value, index);
		}
		if (star)
			this.notifyAll(type, path, star, value, index);
		if (space)
			this.notifyAll(type, path, space, value, index);
		return this;
	},
	setAsync: function(path, promise) {
		var self = this;
		return this.waiting(promise.then(function(s) {
			self.set(path, s);
			return s;
		}, function(e) {
			console.error('error while Context.setAsync : ', e);
			throw e;
		}));
	}
};

utils.mergeProto(AsyncManager.prototype, Context.prototype);

function notifyUpstreams(space, type, path, value, index) {
	for (var i = 0, len = space._upstreams.length; i < len; ++i) {
		var r = space._upstreams[i](type, path, value, index);
		if (r && r.then)
			this.waiting(r);
	}
}

module.exports = Context;

},{"./async":2,"./utils":11}],5:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

/**
 * Event Emitter
 * 
 * Directly inspired from : https://github.com/jeromeetienne/microevent.js
 * Just renamed API as browser standards and remove mixins
 */

var Emitter = function() {}
Emitter.prototype = {
	addEventListener: function(event, fct) {
		this._events = this._events || {};
		(this._events[event] = this._events[event] || []).push(fct);
		return this;
	},
	removeEventListener: function(event, fct) {
		if (!this._events || (event in this._events === false))
			return this;
		this._events[event].splice(this._events[event].indexOf(fct), 1);
		return this;
	},
	dispatchEvent: function(event /* , args... */ ) {
		if (!this._events || (event in this._events === false))
			return this;
		for (var i = 0; i < this._events[event].length; i++)
			this._events[event][i].apply(this, Array.prototype.slice.call(arguments, 1));
		return this;
	}
};
module.exports = Emitter;

},{}],6:[function(require,module,exports){
(function (global){
var env = function() {
	return Promise.context || env.global;
};

var isServer = (typeof window === 'undefined') && (typeof document === 'undefined');

env.global = {
	isServer: isServer,
	debug: false,
	templates: {},
	views: {},
	api: {},
	expressionsGlobal: isServer ? global : window,
	factory: isServer ? null : document
};

module.exports = env;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],7:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

function Filter(f) {
	this._queue = f ? f._queue.slice() : [];
};

Filter.prototype = {
	//_____________________________ APPLY filter on input
	call: function(callee, input) {
		for (var i = 0, len = this._queue.length; i < len; ++i)
			input = this._queue[i].call(callee, input);
		return input;
	},
	//_____________________________ BASE Filter handler (every template handler is from one of those two types (done or catch))
	lower: function() {
		this._queue.push(function(input) {
			return input.toLowerCase();
		});
		return this;
	},
	upper: function() {
		this._queue.push(function(input) {
			return input.toUpperCase();
		});
		return this;
	},
	reverse: function() {
		this._queue.push(function(input) {
			return input.reverse();
		});
		return this;
	},
	join: function(sep) {
		this._queue.push(function(input) {
			return input.join(sep);
		});
		return this;
	},
	json: function(pretty) {
		this._queue.push(function(input) {
			return JSON.stringify.apply(JSON, pretty ? [input, null, ' '] : [input]);
		});
		return this;
	}
};

module.exports = Filter;

/**
 * could be added :  (list from swigjs)
 
addslashes
capitalize
default
escape
first
last
raw
replace
safe
striptags
title
uniq
url_encode
url_decode
 */

},{}],8:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var env = require('./env'),
	Filter = require('./filter'),
	replacementRegExp = /true|false|null|\$\.(?:[a-zA-Z]\w*(?:\.\w*)*)|\$this(?:\.\w*)*|\$parent(?:\.\w*)+|\$(?:[a-zA-Z]\w*(?:\.\w*)*)|"[^"]*"|'[^']*'|[a-zA-Z_]\w*(?:\.\w*)*/g;

function tryExpr(func, context) {
	if (!context)
		throw new Error('context is undefined')
	try {
		return func.call(context.data, context, env().expressionsGlobal);
	} catch (e) {
		console.error(e, env().debug ? e.stack : '');
		return '';
	}
}

// analyse and produce xpr func
function xpr(expr, filter, dependencies) {
	// console.log('xpr parse : ', expr);
	expr = expr.replace(replacementRegExp, function(whole) {
		if (whole == 'true' || whole == 'false' ||  whole == 'null')
			return whole;
		switch (whole[0]) {
			case '$':
				if (whole[1] === '.')
					return '__global' + whole.substring(1);
				else {
					dependencies.push(whole);
					return '__context.get("' + whole + '")';
				}
			case '"':
			case "'":
				return whole;
			default:
				dependencies.push(whole);
				return '__context.get("' + whole + '")';
		}
	});

	var func = new Function("__context", "__global", "return " + expr + ";");
	if (!filter)
		return func;
	// produce filter 
	var fltr = new Function('Filter', 'return new Filter().' + filter)(Filter);
	// wrap expr func with filter
	return function(__context, __global) {
		return fltr.call(this, func.call(this, __context, __global));
	};
}

// produce context's subscibtion event handler
function handler(instance, context, func, index, callback) {
	return function(type, path, newValue) {
		if (instance.dependenciesCount === 1) {
			instance.results[index] = tryExpr(func, context);
			callback(type, path, instance.output(context));
		} else if (!instance.willFire)
			instance.willFire = context.delay(function() { // allow small time to manage other dependencies update without multiple rerender
				if (instance.willFire) {
					instance.willFire = null;
					instance.results[index] = tryExpr(func, context);
					callback(type, path, instance.output(context));
				}
			}, 0);
	};
}

// special case when interpolable is composed of only one expression with no text decoration
// return expr result directly
function directOutput(context) {
	var o = tryExpr(this.parts[1].func, context);
	return (typeof o === 'undefined' && !this._strict) ? '' : o;
}

//___________________________________ INSTANCE of interpolable (linked to specific context)
/*
We need an instance of interpolable object when we want to bind interpolable object with a specific context. 
We hold original interpolable parts array reference in instance and use it to produce output with local values from binded context.
 */
var Instance = function(interpolable) {
	this.outputed = false;
	this.binds = [];
	this.results = [];
	this.willFire = null;
	this.parts = interpolable.parts;
	this.dependenciesCount = interpolable.dependenciesCount;
};

// produce interpolable output
Instance.prototype.output = function(context) {
	var out = '',
		odd = true,
		count = 0;
	for (var i = 0, len = this.parts.length; i < len; i++) {
		if (odd)
			out += this.parts[i];
		else {
			out += this.outputed ? this.results[count] : (this.results[count] = tryExpr(this.parts[i].func, context));
			count++;
		}
		odd = !odd;
	}
	if (!this.outputed)
		this.outputed = true;
	return out;
};

//_______________________________________________________ INTERPOLABLE

// Constructor
var Interpolable = function(splitted, strict) {
	this.__interpolable__ = true;
	this._strict = strict || false;
	var dp;
	if (splitted.length === 5 && splitted[0] === "" && splitted[2] === "")
		this.directOutput = directOutput;
	// interpolable string
	this.parts = [];
	this.dependenciesCount = 0;
	var odd = false;
	for (var i = 0, len = splitted.length; i < len; i++) {
		odd = !odd;
		if (odd) {
			this.parts.push(splitted[i]);
			continue;
		}
		var dp = [];
		this.parts.push({
			func: xpr(splitted[i], splitted[i + 2], dp),
			dep: dp
		});
		i += 2;
		this.dependenciesCount += dp.length;
	}
};

Interpolable.prototype = {
	// produce instance and bind to context
	subscribeTo: function(context, callback) {
		var instance = new Instance(this);
		var count = 0;
		for (var i = 1, len = this.parts.length; i < len; i = i + 2) {
			var h = handler(instance, context, this.parts[i].func, count, callback),
				dep = this.parts[i].dep;
			count++;
			for (var j = 0, lenJ = dep.length; j < lenJ; j++)
				instance.binds.push(context.subscribe(dep[j], h));
		}
		return function() {
			// unbind all
			instance.willFire = null;
			for (var i = 0; i < instance.binds.length; i++)
				instance.binds[i]();
		};
	},
	// output interpolable with given context
	output: function(context) {
		if (this.directOutput)
			return this.directOutput(context);
		var out = "",
			odd = true,
			parts = this.parts;
		for (var j = 0, len = parts.length; j < len; ++j) {
			if (odd)
				out += parts[j];
			else {
				var r = tryExpr(parts[j].func, context);
				if (typeof r === 'undefined') {
					if (this._strict)
						return;
					out += '';
				}
				out += r;
			}
			odd = !odd;
		}
		return out;
	}
};

var splitRegEx = /\{\{\s*(.+?)((?:(?:\s\|\s)(.+?))?)\s*\}\}/;
// check if a string is interpolable. if so : return new Interpolable. else return original string.
function interpolable(string, strict) {
	if (typeof string !== 'string')
		return string;
	var splitted = string.split(splitRegEx);
	if (splitted.length == 1)
		return string; // string is not interpolable
	return new Interpolable(splitted, strict);
};

module.exports = {
	interpolable: interpolable,
	Interpolable: Interpolable
};

},{"./env":6,"./filter":7}],9:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
/**
 * Pure Virtual Node
 */
function PureNode() {
	this.__yPureNode__ = true;
};

PureNode.prototype  = {
	insertBefore: function(toInsert, o) {
		var index = this.childNodes.indexOf(o);
		if (index == -1)
			return false;
		if (index == 0)
			this.childNodes.unshift(toInsert);
		else
			this.childNodes.splice(index, 0, toInsert);
		return true;
	},
	appendChild: function(child) {
		(this.childNodes = this.childNodes || []).push(child);
		child.parentNode = this;
		return child;
	},
	removeChild: function(child) {
		if (!this.childNodes)
			return false;
		for (var i = 0, len = this.childNodes.length; i < len; ++i)
			if (this.childNodes[i] === child) {
				child.parentNode = null;
				this.childNodes.splice(i, 1);
				return child;
			}
		return false;
	},
	toString: function() {
		if (!this.childNodes)
			return '';
		var out = '';
		for (var j = 0, len = this.childNodes.length; j < len; ++j)
			out += this.childNodes[j].toString();
		return out;
	}
};

module.exports = PureNode;

},{}],10:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

(function() {

	"use strict";

	var utils = require('./utils'),
		env = require('./env'),
		interpolable = require('./interpolable').interpolable,
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
							if (self.__yContainer__)
								newValue ? self.show() : self.hide();
							else
								self.style.display = newValue ? initial : 'none';
						}));
					}
					if (invert)
						val = !val;
					if (this.__yContainer__)
						val ? this.show() : this.hide();
					else
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
				var node;
				if (value.__interpolable__) {
					node = env().factory.createTextNode(value.output(context));
					(this._binds = this._binds || []).push(value.subscribeTo(context, function(type, path, newValue) {
						if (node.__yVirtual__) {
							node.nodeValue = newValue;
							if (node.el)
								node.el.nodeValue = newValue;
						}
						node.nodeValue = newValue;
					}));
				} else
					node = env().factory.createTextNode(value);
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
				var h;
				if (typeof handler === 'string') {
					if (!context.data[handler])
						throw utils.produceError('on(' + name + ') : no "' + handler + '" event handlers define in current context', this);
					h = context.data[handler];
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
			if (env().isServer)
				return;
			return this.on(eventName, handler);
		};
	});

	module.exports = Template;
})();

},{"./container":3,"./context":4,"./env":6,"./interpolable":8,"./pure-node":9,"./utils":11}],11:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
//__________________________________________________________ UTILS

function produceError(msg, report) {
	var e = new Error(msg);
	e.report = report;
	return e;
}

//________________________________ Properties management with dot syntax

function getProp(from, path) {
	var start = 0;
	if (path[0] === '$this')
		start = 1;
	var tmp = from;
	for (var i = start, len = path.length; i < len; ++i)
		if (!tmp || (tmp = tmp[path[i]]) === undefined)
			return;
	return tmp;
}

function deleteProp(from, path) {
	var tmp = from,
		i = 0;
	for (len = path.length - 1; i < len; ++i)
		if (tmp && !(tmp = tmp[path[i]]))
			return;
	if (tmp)
		delete tmp[path[i]];
}

function setProp(to, path, value) {
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

//______________________ EMPTY / DESTROY

function emptyNode(node) {
	if (!node.childNodes || !node.childNodes.length)
		return;
	for (var i = 0, len = node.childNodes.length; i < len; ++i)
		destroyElement(node.childNodes[i]);
	if (node.__yVirtual__)
		node.childNodes = [];
	else
		node.innerHTML = '';
}

function destroyElement(node, removeFromParent) {
	if (removeFromParent && node.parentNode) {
		node.parentNode.removeChild(node);
		node.parentNode = null;
	}

	if (node.__yPureNode__) {
		if (node.__yVirtual__) {
			node.attributes = undefined;
			node.listeners = undefined;
			node.classes = undefined;
			node.style = undefined;
		}
		if (node.childNodes && node.childNodes.length)
			destroyChildren(node, removeFromParent);
	} else if (node.childNodes && node.childNodes.length)
		destroyChildren(node);

	// todo remove listener when needed
	if (node._binds) {
		for (var i = 0, len = node._binds.length; i < len; i++)
			node._binds[i]();
		node._binds = null;
	}
	if (node._yamvish_containers)
		node._yamvish_containers = null;
	if (node.context)
		node.context.destroy();
	if (node._route)
		node._route = null;
}

function destroyChildren(node, removeFromParent) {
	if (!node.childNodes)
		return;
	for (var i = 0; i < node.childNodes.length; i++)
		destroyElement(node.childNodes[i], removeFromParent);
}

//_____________________________ MERGE PROTO

function mergeProto(src, target) {
	for (var i in src)
		target[i] = src[i];
}

// DOM/Virtual utils

function mountChildren(node, parent, nextSibling) {
	if (!node.childNodes || !node.__yPureNode__)
		return;
	if (nextSibling) {
		for (var k = node.childNodes.length - 1; k >= 0; --k) {
			var child = node.childNodes[k];
			if (child.__yPureNode__ && !child.__yVirtual__)
				mountChildren(child, parent, nextSibling);
			else
				parent.insertBefore(child, nextSibling);
		}
	} else
		for (var i = 0, len = node.childNodes.length; i < len; ++i) {
			var child = node.childNodes[i];
			if (child.__yPureNode__ && !child.__yVirtual__)
				mountChildren(child, parent);
			else
				parent.appendChild(child);
		}
}

function findNextSibling(node) {
	var tmp = node;
	while (tmp && !tmp.__yVirtual__ && tmp.__yPureNode__ && tmp.childNodes && tmp.childNodes.length)
		tmp = tmp.childNodes[tmp.childNodes.length - 1];
	if (!tmp || (tmp.__yPureNode__ && !tmp.__yVirtual__))
		return null;
	return tmp.nextSibling;
}

//__________________________________________ Classes

function setClass(node, name) {
	if (node.__yVirtual__) {
		if (node.el)
			node.el.classList.add(name);
		(node.classes = node.classes || {})[name] = true;
	} else
		node.classList.add(name);
}

function removeClass(node, name) {
	if (node.__yVirtual__) {
		if (node.el)
			node.el.classList.remove(name);
		if (node.classes)
			delete node.classes[name];
	} else
		node.classList.remove(name);
}

//_______________________________________ EXPORTS

module.exports = {
	mountChildren: mountChildren,
	mergeProto: mergeProto,
	destroyElement: destroyElement,
	destroyChildren: destroyChildren,
	setProp: setProp,
	deleteProp: deleteProp,
	getProp: getProp,
	emptyNode: emptyNode,
	produceError: produceError,
	setClass: setClass,
	removeClass: removeClass,
	findNextSibling: findNextSibling,
	hide: function(node) {
		if (node.__yContainer__)
			return node.hide();
		if (!node.style)
			node.style = {};
		node.style.display = 'none';
	},
	show: function(node) {
		if (node.__yContainer__)
			return node.show();
		if (!node.style)
			node.style = {};
		node.style.display = '';
	},
	merge: function(background, foreground) {
		var obj = {};
		for (var i in background)
			obj[i] = background[i];
		for (var j in foreground)
			obj[j] = foreground[j];
		return obj;
	},
	domQuery: function(selector) {
		if (selector[0] === '#')
			return document.getElementById(selector.substring(1));
		else
			return document.querySelector(selector);
	},
	shallowCopy: function(obj) {
		if (obj && obj.forEach)
			return obj.slice();
		if (obj && typeof obj === 'object') {
			if (obj instanceof RegExp)
				return obj;
			var res = {};
			for (var i in obj)
				res[i] = obj[i];
			return res;
		}
		return obj;
	}
}

},{}],12:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var utils = require('./utils'),
	Template = require('./template'),
	Container = require('./container'),
	Context = require('./context');
//____________________________________________________ VIEW
var View = function View(opt) {
	this.__yView__ = true;
	opt = opt || {};
	if (opt.componentName)
		addComponent(opt.componentName, this);
	Context.call(this, opt);
	Container.call(this, opt);
};
utils.mergeProto(Template.prototype, View.prototype);
utils.mergeProto(Container.prototype, View.prototype);
utils.mergeProto(Context.prototype, View.prototype);
View.prototype.exec = function(fn) {
	var p = fn.call(this, this, this); // apply directly toElement handler on this
	if (p && p.then)
		this.waiting(p);
	return this;
};
View.prototype.destroy = function() {
	Container.prototype.destroy.call(this);
	Context.prototype.destroy.call(this);
};
// remove API that does not make sens with view
// view is directly constructed : no call, catch, or toElement
delete View.prototype.call;
delete View.prototype.toElement;
// view is a context : could not change it
delete View.prototype.context;
// view is a container : no attributes
delete View.prototype.id;
delete View.prototype.attr;
delete View.prototype.setClass;
delete View.prototype.visible;
delete View.prototype.css;
delete View.prototype.val;
delete View.prototype.contentEditable;

module.exports = View;

},{"./container":3,"./context":4,"./template":10,"./utils":11}]},{},[1])(1)
});