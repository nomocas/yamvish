(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.y = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Todo :
 * - oneOf : add optional flag
 * - add string 'arg and return' management in regExp handlers
 */
(function() {
    var defaultSpaceRegExp = /^[\s\n\r]+/;

    function exec(string, rule, descriptor, parser, opt) {
        if (typeof rule === 'string')
            rule = parser.rules[rule];
        var rules = rule._queue;
        for (var i = 0, len = rules.length; i < len; ++i) {
            var current = rules[i];
            if (current.__lexer__)
                string = exec(string, current, descriptor, parser, opt);
            else // is function
                string = current.call(parser, string, descriptor, opt);
            if (string === false)
                return false;
        }
        return string;
    };

    function Rule() {
        this._queue = [];
        this.__lexer__ = true;
    };

    Rule.prototype = {
        // base for all rule's handlers
        done: function(callback) {
            this._queue.push(callback);
            return this;
        },
        // for debug purpose
        log: function(title) {
            title = title || '';
            return this.done(function(string, descriptor, opt) {
                console.log("elenpi.log : ", title, string, descriptor);
                return string;
            });
        },
        //
        regExp: function(reg, optional, as) {
            return this.done(function(string, descriptor, opt) {
                if (!string)
                    if (optional)
                        return string;
                    else
                        return false;
                var cap = reg.exec(string);
                if (cap) {
                    if (as) {
                        if (typeof as === 'string')
                            descriptor[as] = cap[0];
                        else
                            as.call(this, descriptor, cap, opt);
                    }
                    return string.substring(cap[0].length);
                }
                if (!optional)
                    return false;
                return string;
            });
        },
        char: function(test, optional) {
            return this.done(function(string, descriptor) {
                if (!string)
                    return false;
                if (string[0] === test)
                    return string.substring(1);
                if (optional)
                    return string;
                return false;
            });
        },
        xOrMore: function(name, rule, separator, minimum) {
            minimum = minimum || 0;
            return this.done(function(string, descriptor, opt) {
                var output = [];
                var newString = true,
                    count = 0;
                while (newString && string) {
                    var newDescriptor = name ? (this.createDescriptor ? this.createDescriptor() : {}) : descriptor;
                    newString = exec(string, rule, newDescriptor, this, opt);
                    if (newString !== false) {
                        count++;
                        string = newString;
                        if (!newDescriptor.skip)
                            output.push(newDescriptor);
                        if (separator && string) {
                            newString = exec(string, separator, newDescriptor, this, opt);
                            if (newString !== false)
                                string = newString;
                        }
                    }
                }
                if (count < minimum)
                    return false;
                if (name && output.length)
                    descriptor[name] = output;
                return string;
            });
        },
        zeroOrMore: function(as, rule, separator) {
            return this.xOrMore(as, rule, separator, 0);
        },
        oneOrMore: function(as, rule, separator) {
            return this.xOrMore(as, rule, separator, 1);
        },
        zeroOrOne: function(as, rule) {
            if (arguments.length === 1) {
                rule = as;
                as = null;
            }
            return this.done(function(string, descriptor, opt) {
                if (!string)
                    return string;
                var newDescriptor = as ? (this.createDescriptor ? this.createDescriptor() : {}) : descriptor,
                    res = exec(string, rule, newDescriptor, this, opt);
                if (res !== false) {
                    if (as)
                        descriptor[as] = newDescriptor;
                    string = res;
                }
                return string;
            });
        },
        oneOf: function(as, rules, optional) {
            if (arguments.length === 1) {
                rules = as;
                as = null;
            }
            return this.done(function(string, descriptor, opt) {
                if (!string)
                    return false;
                var count = 0;
                while (count < rules.length) {
                    var newDescriptor = as ? (this.createDescriptor ? this.createDescriptor() : {}) : descriptor,
                        newString = exec(string, rules[count], newDescriptor, this, opt);
                    if (newString !== false) {
                        if (as)
                            descriptor[as] = newDescriptor;
                        return newString;
                    }
                    count++;
                }
                if (optional)
                    return string;
                return false;
            });
        },
        rule: function(name) {
            return this.done(function(string, descriptor, opt) {
                var rule = this.rules[name];
                if (!rule)
                    throw new Error('elenpi.Rule :  rules not found : ' + name);
                return exec(string, rule, descriptor, this, opt);
            });
        },
        skip: function() {
            return this.done(function(string, descriptor) {
                descriptor.skip = true;
                return string;
            });
        },
        space: function(needed) {
            return this.done(function(string, descriptor) {
                if (!string)
                    if (needed)
                        return false;
                    else
                        return string;
                var cap = (this.rules.space || defaultSpaceRegExp).exec(string);
                if (cap)
                    return string.substring(cap[0].length);
                else if (needed)
                    return false;
                return string;
            });
        },
        end: function(needed) {
            return this.done(function(string, descriptor) {
                if (!string || !needed)
                    return string;
                return false;
            });
        }
    };

    var Parser = function(rules, defaultRule) {
        this.rules = rules;
        this.defaultRule = defaultRule;
    };
    Parser.prototype = {
        exec: function(string, descriptor, rule, opt) {
            if (!rule)
                rule = this.rules[this.defaultRule];
            return exec(string, rule, descriptor, this, opt);
        },
        parse: function(string, rule, opt) {
            var descriptor = this.createDescriptor ? this.createDescriptor() : {};
            var ok = this.exec(string, descriptor, rule, opt);
            if (ok === false || (ok && ok.length > 0))
                return false;
            return descriptor;
        }
    };

    var elenpi = {
        r: function() {
            return new Rule();
        },
        Rule: Rule,
        Parser: Parser
    };

    if (typeof module !== 'undefined' && module.exports)
        module.exports = elenpi; // use common js if avaiable
    else this.elenpi = elenpi; // assign to global window
})();
//___________________________________________________

},{}],2:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

/**
 * Event Emitter
 * 
 * Directly inspired from : https://github.com/jeromeetienne/microevent.js
 * Just remove mixins + add .once()
 */

var Emitter = function() {}
Emitter.prototype = {
	on: function(event, fct, args) {
		event = (typeof event === 'object' ? event.type : event);
		this._events = this._events || {};
		(this._events[event] = this._events[event] || []).push({ fct: fct, args: args });
		return this;
	},
	off: function(event, fct) {
		event = (typeof event === 'object' ? event.type : event);
		if (!this._events || (event in this._events === false))
			return this;
		var queue = this._events[event];
		for (var i = 0, len = queue.length; i < len; ++i)
			if (queue[i].fct === fct) {
				this._events[event].splice(i, 1);
				break;
			}
		return this;
	},
	once: function(event, func, args) {
		this._events = this._events || {};
		var handler = function() {
			this.off(event, handler);
			func.apply(this, arguments);
		};

		(this._events[event] = this._events[event] || []).push({ fct: handler, args: args });
		return this;
	},
	emit: function(event /* , args... */ ) {
		if (!this._events || (event in this._events === false) || !this._events[event].length)
			return this;
		var cloned = this._events[event].slice(),
			args = [].slice.call(arguments, 1);
		for (var i = 0, len = cloned.length; i < len; i++)
			cloned[i].fct.apply(this, cloned[i].args ? cloned[i].args.concat(args) : args);
		return this;
	}
};
module.exports = Emitter;

},{}],3:[function(require,module,exports){
//________________________________ Properties management with dot syntax
module.exports = {
	getProp: function(from, path) {
		var start = 0;
		if (path[0] === '$this')
			start = 1;
		var tmp = from;
		for (var i = start, len = path.length; i < len; ++i)
			if (!tmp || (tmp = tmp[path[i]]) === undefined)
				return;
		return tmp;
	},
	deleteProp: function(from, path) {
		var tmp = from,
			i = 0;
		for (len = path.length - 1; i < len; ++i)
			if (tmp && !(tmp = tmp[path[i]]))
				return;
		if (tmp)
			delete tmp[path[i]];
	},
	setProp: function(to, path, value) {
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
	},
	shallowMerge: function(src, target) {
		for (var i in src)
			target[i] = src[i];
	},
	shallowCopy: function(obj) {
		if (obj && obj.forEach)
			return obj.slice();
		if (obj && typeof obj === 'object') {
			if (obj instanceof RegExp || obj instanceof Date)
				return obj;
			var res = {};
			for (var i in obj)
				res[i] = obj[i];
			return res;
		}
		return obj;
	},
	copy: function(obj) {
		if (!obj)
			return obj;
		var res = null;
		if (typeof obj.clone === 'function')
			return obj.clone();
		if (obj.forEach) {
			res = [];
			for (var i = 0, len = obj.length; i < len; ++i)
				res.push(this.copy(obj[i]));
		} else if (obj && typeof obj === 'object') {
			if (obj instanceof RegExp || obj instanceof Date)
				return obj;
			res = {};
			for (var j in obj) {
				var v = obj[j];
				if (typeof v === 'object')
					res[j] = this.copy(v);
				else
					res[j] = v;
			}
		} else
			res = obj;
		return res;
	},
	array: {
		includes: function(arr, value) {
			return arr.some(function(item) {
				return item === value;
			});
		},
		remove: function(arr, value) {
			for (var i = 0, len = arr.length; i < len; ++i)
				if (arr[i] === value) {
					arr.splice(i, 1);
					return;
				}
		},
		randomize: function(arr) {
			if (!arr)
				return null;
			return arr.sort(function() {
				return 0.5 - Math.random();
			});
		},
		insertAfter: function(arr, ref, newItem) {
			var index = arr.indexOf(ref);
			if (ref === -1)
				throw new Error('utils.array.insertAfter : ref not found.');
			if (index === arr.length - 1)
				arr.push(newItem);
			else
				arr.splice(index + 1, 0, newItem);
		}
	}
};

},{}],4:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var y = function(t) {
	return new y.Template(t);
};

// yamvish core
y.api = require('./lib/api');
y.env = require('./lib/env');
y.utils = require('./lib/utils');
y.AsyncManager = require('./lib/async');

var ctx = require('./lib/context');
y.Context = ctx.Context;
y.Env = ctx.Env;

y.Filter = require('./lib/filter');
var interpolable = require('./lib/interpolable');
y.interpolable = interpolable.interpolable;
y.Interpolable = interpolable.Interpolable;

// Templates
y.Template = require('./lib/template');

// API management
y.toAPI = function(apiName, methodsObj) {
	var api = y.api[apiName] = y.api[apiName] || {};
	y.utils.shallowMerge(methodsObj, api);
	return api;
};

// PARSERS and related
y.elenpi = require('elenpi');
y.listenerParser = require('./lib/parsers/listener-call');
y.html = require('./lib/parsers/html-to-template');
y.emmet = require('./lib/parsers/emmet-style');

// load DOM engine by default
require('./lib/output-engine/dom/engine');
y.Container = require('./lib/output-engine/dom/container');

y.Error = function(status, message, report) {
	this.status = status;
	this.message = message;
	this.report = report;
}
y.Error.prototype = new Error();

module.exports = y;

},{"./lib/api":5,"./lib/async":6,"./lib/context":7,"./lib/env":8,"./lib/filter":9,"./lib/interpolable":10,"./lib/output-engine/dom/container":11,"./lib/output-engine/dom/engine":13,"./lib/parsers/emmet-style":15,"./lib/parsers/html-to-template":16,"./lib/parsers/listener-call":17,"./lib/template":21,"./lib/utils":22,"elenpi":1}],5:[function(require,module,exports){
// simple global object where store apis
module.exports = {};

},{}],6:[function(require,module,exports){
/** 
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * asynchroneous events (aka promise and setTimeout calls) manager.
 * Context will inherit of this class to manage all internal or external asynchroneous calls.
 * It allows us to know when a context and its descendants are stabilised (i.e. all data are up to date).
 */

var Emitter = require('nomocas-utils/lib/emitter'),
	utils = require('./utils');

function AsyncManager() {
	this._async = {
		count: 0,
		errors: [],
		successes: [],
		fails: [],
		callbacks: []
	};
};

function remove(mgr) {
	mgr._async.count--;
	if (mgr._async.count <= 0)
		trigger(mgr);
}

function trigger(mgr) {
	var async = mgr._async,
		list = async.errors.length ? async.fails : async.successes,
		args = async.errors.length ? async.errors : mgr;
	for (var j = 0; j < list.length; j++)
		list[j](args.length === 1 ? args[0] : args);
	if (mgr.emit)
		mgr.emit('stabilised', mgr);
	async.successes = [];
	async.fails = [];
	async.errors = [];
}

function delayEnd(func, self) {
	if (func) func();
	remove(self);
}

AsyncManager.prototype = {
	/**
	 * waiting a promise. 
	 * warning : 
	 * 		this.waiting(prom.then(...).then(...)) ===> "then"(s) will be executed BEFORE "stabilised" event/resolution
	 *   	this.waiting(prom).then(...).then(...) ===> "then"(s) will be executed AFTER "stabilised" event/resolution
	 * @param  {Promise} promise the promise to wait for
	 * @return {Promise}         a promise that will be resolved AFTER "stabilised" event/resolution
	 */
	waiting: function(promise) {
		this._async.count++;
		var self = this;
		var p = promise.then(function(s) {
			remove(self);
			return s;
		}, function(e) {
			if (self.env && self.env.data.debug)
				console.error('async waiting error : ', e);
			self._async.errors.push(e);
			remove(self);
			throw e;
		});
		if (this.parent && this.parent.waiting)
			this.parent.waiting(p);
		return p;
	},
	delay: function(func, ms) {
		this._async.count++;
		var t = setTimeout(delayEnd, ms, func, this);
		if (this.parent && this.parent.delay)
			this.parent.delay(null, ms);
		return t;
	},
	stabilised: function() {
		if (this._async.count === 0)
			return Promise.resolve(this);
		var store = this._async;
		return new Promise(function(resolve, reject) {
			store.successes.push(resolve);
			store.fails.push(reject);
		});
	}
};

utils.shallowMerge(Emitter.prototype, AsyncManager.prototype);

module.exports = AsyncManager;

},{"./utils":22,"nomocas-utils/lib/emitter":2}],7:[function(require,module,exports){
/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * Context : An observable data holder.
 * it's the heart of yamvish data-binding.
 */

var utils = require('./utils'),
	env = require('./env'),
	AsyncManager = require('./async');
//_______________________________________________________ DATA BIND CONTEXT

function Context(data, parent, path, env) {
	AsyncManager.call(this);
	this.__yContext__ = true;
	this.data = (data !== undefined) ? data : {};
	this.map = {};
	if (parent) {
		this.parent = parent;
		this.env = env ? new Context(env) : parent.env;
		if (path) {
			var self = this;
			this.path = path;
			this.binds = [];
			this.parent.subscribe(path, function(value) {
				self.reset(value);
			}, false, this.binds);
		}
	} else
		this.env = env ? (env.__yContext__ ? env : new Env(env)) : Context.env;
}

function unsub(context, path, fn, upstream) {
	return function() {
		if (!context.destroyed)
			context.unsubscribe(path, fn, upstream);
	};
}

var outputFiler = /^\$/;

Context.prototype = {
	destroy: function() {
		if (this.binds)
			this.binds.forEach(function(unbind) {
				unbind();
			});
		this.destroyed = true;
		this.binds = null;
		this.parent = null;
		this.data = null;
		this.map = null;
	},
	get: function(path) {
		if (!path.forEach)
			path = path.split('.');
		switch (path[0]) {
			case '$this':
				if (path.length === 1)
					return this.data;
				break;
			case '$parent':
				if (!this.parent)
					throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
				return this.parent.get(path.slice(1));
				break;
			case '$env':
				return this.env.get(path.slice(1));
		}
		var r = utils.getProp(this.data, path);
		if (r === undefined)
			return '';
		return r;
	},
	call: function(methodName) {
		var func = this.get(methodName),
			args = [].slice.call(arguments, 1);
		if (!func)
			throw new Error('Context.call : no method found with : ' + methodName);
		return func.apply(this, args);
	},
	dependent: function(path, dependencies, func) {
		var argsOutput = [],
			willFire,
			self = this,
			count = 0;
		this.binds = this.binds ||  [];
		dependencies.forEach(function(dependency) {
			argsOutput.push(this.get(dependency));
			var index = count++;
			this.subscribe(dependency, function(value, type, p, key) {
				argsOutput[index] = value;
				if (!willFire)
					willFire = self.delay(function() {
						if (willFire) {
							willFire = null;
							self.set(path, func.apply(self, argsOutput));
						}
					}, 0);
			}, false, this.binds);
		}, this);
		this.set(path, func.apply(this, argsOutput));
		return this;
	},
	reset: function(data) {
		if (typeof data === 'undefined')
			data = {};
		if (data === this.data || (this.data instanceof Date && data instanceof Date && this.data.valueOf() === data.valueOf()))
			return this;
		this.data = data;
		this.notifyAll('reset', null, null, this.data, '*');
		return this;
	},
	set: function(path, value) {
		// console.log('set : [%s] ', path, value, arguments.length)
		if (arguments.length === 1) {
			for (var i in path)
				this.set(i, path[i]);
			return this;
		}
		if (!path.forEach)
			path = path.split('.');
		switch (path[0]) {
			case '$this':
				if (path.length === 1)
					return this.reset(value);
				else
					path.shift();
				break;
			case '$parent':
				if (this.parent)
					return this.parent.set(path.slice(1), value) && this;
				throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
			case '$env':
				return this.env.set(path.slice(1), value) && this;
		}
		var old = utils.setProp(this.data, path, value);
		if (old !== value) {
			if (old instanceof Date && old == value)
				return this;
			this.notify('set', path, value, path[path.length - 1]);
		}
		return this;
	},
	toggle: function(path, value) {
		this.set(path, !this.get(path));
		return this;
	},
	toggleInArray: function(path, value) {
		var arr = this.get(path);
		for (var i = 0, len = arr.length; i < len; ++i)
			if (arr[i] === value) {
				this.del(path + '.' + i)
				return this;
			}
		return this.push(path, value);
	},
	push: function(path, value) {
		if (!path.forEach)
			path = path.split('.');
		switch (path[0]) {
			case '$parent':
				if (this.parent)
					return this.parent.push(path.slice(1), value) && this;
				throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
			case '$env':
				return this.env.push(path.slice(1), value) && this;
		}
		var arr;
		if (path[0] === '$this')
			arr = this.data;
		else
			arr = utils.getProp(this.data, path);
		if (!arr) {
			arr = [];
			utils.setProp(this.data, path, arr);
		}
		if (!arr.forEach) {
			console.error(path, 'is not array at context.push : ', arr);
			throw new Error("yamvish.Context : Object is not array at " + path.join(".") + " : couldn't push object.");
		}
		arr.push(value);
		this.notify('push', path, value, arr.length - 1);
		return this;
	},
	del: function(path) {
		if (!path.forEach)
			path = path.split('.');
		else
			path = path.slice();
		switch (path[0]) {
			case '$parent':
				if (this.parent)
					return this.parent.del(path.slice(1)) && this;
				throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
			case '$env':
				return this.env.del(path.slice(1)) && this;
		}
		var path2 = path.slice();
		var key = path2.pop(),
			parent = path2.length ? utils.getProp(this.data, path2) : this.data;
		if (parent)
			if (parent.forEach) {
				var index = parseInt(key, 10);
				if (index < parent.length)
					this.notify('removeAt', path2, parent.splice(index, 1), index);
			} else {
				var val = parent[key];
				delete parent[key];
				this.notify('delete', path, val, key);
			}
		return this;
	},
	subscribe: function(path, fn, upstream, binds) {
		if (!path.forEach)
			path = path.split('.');
		var space;
		switch (path[0]) {
			case '$this':
				space = this.map;
				break;
			case '$env':
				return this.env.subscribe(path.slice(1), fn, upstream, binds);
			case '$parent':
				if (!this.parent)
					throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
				return this.parent.subscribe(path.slice(1), fn, upstream, binds);
			default:
				space = utils.getProp(this.map, path);
		}
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
		if (binds)
			binds.push(unsub(this, path, fn, upstream));
		return this;
	},
	unsubscribe: function(path, fn, upstream) {
		if (this.destroyed)
			return this;
		if (!path.forEach)
			path = path.split('.');
		var space;
		switch (path[0]) {
			case '$this':
				space = this.map;
				break;
			case '$parent':
				return this.env.unsubscribe(path.slice(1), fn, upstream) && this;
			case '$parent':
				if (this.parent)
					return this.parent.unsubscribe(path.slice(1), fn, upstream) && this;
				throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
			default:
				space = utils.getProp(this.map, path);
		}
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
		if (space._listeners)
			for (var i = 0, len = space._listeners.length; i < len; ++i) {
				var listener = space._listeners[i];
				if (!listener) {
					// maybe it's because listeners length has change so update it
					len = space._listeners.length;
					continue;
				}
				var r = listener.call(this, value, type, path, index);
				if (r && r.then)
					this.waiting(r);
			}
		if (type !== 'push' && type !== 'removeAt')
			for (var j in space) {
				if (j === '_listeners' || j === '_upstreams')
					continue;
				this.notifyAll(type, path ? path.concat(j) : path, space[j], (value && typeof value === 'object') ? value[j] : value, j);
			}
		return this;
	},
	notify: function(type, path, value, index) {
		if (!path.forEach)
			path = path.split('.');
		if (path[0] === '$this')
			path = path.slice(1);
		else if (path[0] === '$parent') {
			if (!this.parent)
				throw new Error('could not notify parent : no parent found. for : ' + path.join('.'));
			this.parent.notify(type, path.slice(1), value, index);
			return this;
		}
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
	},
	pushAsync: function(path, promise) {
		var self = this;
		return this.waiting(promise.then(function(s) {
			self.push(path, s);
			return s;
		}, function(e) {
			console.error('error while Context.pushAsync : ', e);
			throw e;
		}));
	},
	//______________________ AGORA MANAGEMENT
	onAgora: function(messageName, handler) {
		var agora = this.env.data.agora,
			self = this;
		agora.on(messageName, handler, [this]);
		(this.binds = this.binds ||  []).push(function() {
			agora.off(messageName, handler);
		});
		return this;
	},
	toAgora: function(name) {
		var args = [name].concat([].slice.call(arguments, 1))
		this.env.data.agora.emit.apply(this.env.data.agora, args);
		return this;
	},
	output: function() {
		var output = {};
		for (var i in this.data)
			if (!outputFiler.test(i))
				output[i] = this.data[i];
		return output;
	},
	clone: function(cloneEnv) {
		return new Context(utils.copy(this.data), this.parent, this.path, cloneEnv ? this.env.clone() : this.env);
	},
	waitUntil: function(path, handler) {
		var val = this.get(path),
			self = this;
		if (val)
			handler(val);
		else {
			var wrapper = function(value) {
				if (!value)
					return;
				handler(value);
				self.unsubscribe(path, wrapper, true);
			};
			this.subscribe(path, wrapper, true);
		}
		return this;
	}
};

utils.shallowMerge(AsyncManager.prototype, Context.prototype);


//___________________________________ Env class
function Env(data, parent, path) {
	Context.call(this, data, parent, path);
	delete this.env;
}
Env.prototype = new Context();
Env.prototype.clone = function() {
	return new Env(this.data.clone());
};

// general env
Context.env = new Env(env);

function notifyUpstreams(space, type, path, value, index) {
	for (var i = 0, len = space._upstreams.length; i < len; ++i) {
		var upstream = space._upstreams[i];
		if (!upstream) {
			// maybe it's because upstreams length has change so update it
			len = space._upstreams.length;
			continue;
		}
		var r = upstream.call(this, value, type, path, index);
		if (r && r.then)
			this.waiting(r);
	}
}

module.exports = { Context: Context, Env: Env };

},{"./async":6,"./env":8,"./utils":22}],8:[function(require,module,exports){
(function (global){
var isServer = (typeof window === 'undefined') && (typeof document === 'undefined'),
	Emitter = require('nomocas-utils/lib/emitter');
var env = {
	isServer: isServer,
	debug: true,
	expressionsGlobal: isServer ? global : window,
	factory: isServer ? null : document,
	agora: new Emitter(),
	/**
	 * shallow clone env object
	 * @param  {[type]} keepAgora [description]
	 * @return {[type]}           [description]
	 */
	clone: function(keepAgora) {
		var cloned = {};
		for (var i in this) {
			if (i === 'agora' && !keepAgora) {
				cloned.agora = new Emitter();
				continue;
			}
			cloned[i] = this[i];
		}
		return cloned;
	}
};

module.exports = env;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"nomocas-utils/lib/emitter":2}],9:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

function Filter(f) {
	this._queue = f ? f._queue.slice() : [];
};

var truncateRegExp = /^(?:[\w'"\(\),]+\s*){0,10}/;

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
	json: function(pretty) {
		this._queue.push(function(input) {
			return JSON.stringify.apply(JSON, pretty ? [input, null, ' '] : [input]);
		});
		return this;
	},
	truncate: function() {
		this._queue.push(function(input) {
			var match = truncateRegExp.exec(input);
			return match ? (match[0] + '...') : input;
		});
		return this;
	},
	randomizeArray: function() {
		this._queue.push(function(input) {
			if (!input)
				return null;
			if (!input.forEach)
				return input;
			return input.sort(function() {
				return 0.5 - Math.random();
			});
		});
		return this;
	},
	urlencode: function() {
		this._queue.push(function(input) {
			return encodeURI(input);
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

},{}],10:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var Filter = require('./filter'),
	replacementRegExp = /true|false|null|\$\.(?:[a-zA-Z]\w*(?:\.[\w\$]*)*)|\$(?:[a-zA-Z]\w*(?:\.[\w\$]*)*)\(?|"[^"]*"|'[^']*'|[a-zA-Z_]\w*(?:\.[\w\$]*)*\(?/g,
	splitRegEx = /(\{{1,2})\s*(.+?)((?:(?:\s\|\s)(.+?))?)\s*(\}{1,2})/,
	cacheFull = {},
	cacheXpr = {};

function tryExpr(func, context) {
	try {
		return func.call(context.data, context, context.env.data.expressionsGlobal);
	} catch (e) {
		console.error('interpolable error : ', func.expression || e);
		console.error(e.stack);
		return '';
	}
}

// analyse and produce xpr func
function compileExpression(expr, filter, dependencies) {
	// console.log('xpr parse : ', expr);
	var total = expr + filter;
	if (cacheXpr[total]) {
		dependencies.push.apply(dependencies, cacheXpr[total].dependencies);
		return cacheXpr[total].func;
	}
	var dep = [],
		exprReplaced = expr.replace(replacementRegExp, function(whole) {
			if (whole == 'true' || whole == 'false' ||  whole == 'null')
				return whole;
			switch (whole[0]) {
				case '"':
				case "'":
					return whole;
				case '$':
					if (whole[1] === '.')
						return '__global' + whole.substring(1);
				default:
					if (whole[whole.length - 1] === '(') { // function call
						dep.push(whole.substring(0, whole.length - 1));
						return '__context.data.' + whole;
					} else { // simple path to var
						dep.push(whole);
						// we use indirect value retrieval to avoid throw if path provides null or undefined somewhere
						return '__context.get(["' + whole.split('.').join('","') + '"])';
					}
			}
		});
	// console.log('xpr parsing res : ', expr);
	dependencies.push.apply(dependencies, dep);

	var func = new Function("__context", "__global", "return " + exprReplaced + ";");
	if (!filter) {
		cacheXpr[total] = {
			func: func,
			dependencies: dep
		};
		if (Interpolable.debug)
			func.expression = expr;
		return func;
	}
	// produce filter 
	var fltr = new Function('Filter', 'return new Filter().' + filter)(Filter);
	// wrap expr func with filter
	var f = function(context, global) {
		return fltr.call(context, func.call(this, context, global));
	};
	if (Interpolable.debug)
		f.expression = expr;
	cacheXpr[total] = {
		func: f,
		dependencies: dep
	};
	return f;
}

// produce context's subscibtion event handler
function handler(instance, context, func, index, callback) {
	return function() {
		var old = instance.results[index];
		instance.results[index] = tryExpr(func, context);
		if (old === instance.results[index])
			return;
		if (instance.dependenciesCount === 1)
			callback(instance.output(context), 'set');
		else if (!instance.willFire)
			instance.willFire = context.delay(function() { // call on nextTick to manage other dependencies update without multiple rerender
				if (instance.willFire) {
					instance.willFire = null;
					callback(instance.output(context), 'set');
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
We need instances of "interpolables" when we bind interpolable object on a specific context. 
We hold original interpolable parts array reference in instance and use it to produce output with local values from binded context.
 */
var Instance = function(interpolable) {
	this.outputed = false;
	this.results = [];
	this.willFire = null;
	this.parts = interpolable.parts;
	this.dependenciesCount = interpolable.dependenciesCount;
	this.directOutput = interpolable.directOutput;
	this._strict = interpolable._strict;
	this.binds = [];
};

// produce interpolable output
Instance.prototype = {
	output: function(context) {
		if (this.directOutput) {
			if (this.outputed)
				return this.results[0];
			this.outputed = true;
			return this.results[0] = this.directOutput(context);
		}
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
		this.outputed = true;
		return out;
	},
	destroy: function() {
		for (var i = 0, len = this.binds.length; i < len; ++i)
			this.binds[i]();
	}
};

//_______________________________________________________ INTERPOLABLE

// Constructor
var Interpolable = function(original, splitted, strict) {
	this.__interpolable__ = true;
	this._strict = strict || false;
	var dp;
	if (splitted.length === 7 && splitted[0] === "" && splitted[6] === "")
		this.directOutput = directOutput;
	// interpolable string
	this.parts = [];
	this.original = original;
	this.dependenciesCount = 0;
	var part = splitted[0],
		index = 0;
	while (part !== undefined) {
		this.parts.push(part);
		if (index + 1 === splitted.length)
			break;
		var bracket = splitted[index + 1];
		if (bracket.length !== splitted[index + 5].length)
			throw new Error('interpolation need same number of brackets on both sides : ' + original)
		var dp = [];
		this.parts.push({
			binded: (bracket.length === 2),
			func: compileExpression(splitted[index + 2], splitted[index + 4], dp),
			dep: dp
		});
		this.dependenciesCount += dp.length;

		index += 6;
		part = splitted[index];
	}
};

function unsub(instance) {
	return function() {
		instance.destroy();
	};
}

Interpolable.prototype = {
	// produce instance and bind to context
	subscribeTo: function(context, callback, binds) {
		var instance = new Instance(this);
		var count = 0,
			binded = false;
		for (var i = 1, len = this.parts.length; i < len; i = i + 2) {
			var block = this.parts[i];
			if (block.binded) {
				binded = true;
				var h = handler(instance, context, block.func, count, callback),
					dep = block.dep;
				for (var j = 0, lenJ = dep.length; j < lenJ; j++)
					context.subscribe(dep[j], h, false, instance.binds);
			}
			count++;
		}
		if (binded && binds)
			binds.push(unsub(instance));
		return instance;
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

module.exports = {
	// check if a string is interpolable. if so : return new Interpolable. else return original string.
	interpolable: function(string, strict) {
		if (typeof string !== 'string')
			return string;
		if (cacheFull[string])
			return cacheFull[string];
		var splitted = string.split(splitRegEx);
		if (splitted.length == 1)
			return string; // string is not interpolable
		return cacheFull[string] = new Interpolable(string, splitted, strict);
	},
	Interpolable: Interpolable
};

},{"./filter":9}],11:[function(require,module,exports){
/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * DOM only.
 * Container : The missing DOM node's type : a simple virtual nodes container that could be (un)mounted somewhere in other dom nodes.
 * Think it as an evoluated DocumentFragment.
 */
var utils = require('../../utils'),
	Emitter = require('nomocas-utils/lib/emitter');
var Container = function(parent) {
	this.__yContainer__ = true;
	this.parent = parent;
	this.childNodes = [];
};

Container.prototype = new Emitter();

var proto = {
	appendChildrenToFragment: function(frag, parentNode, mounted) {
		this.parentNode = parentNode;
		if (this.witness)
			frag.appendChild(this.witness);
		if (mounted)
			mounted.push(this);
		for (var i = 0, len = this.childNodes.length; i < len; ++i) {
			var child = this.childNodes[i];
			if (child.__yContainer__)
				child.appendChildrenToFragment(frag, parentNode, mounted);
			else
				frag.appendChild(child);
		}
		return this;
	},
	empty: function() {
		utils.destroyChildren(this.childNodes, true);
		this.childNodes = [];
		return this;
	},
	mount: function(node) {
		if (typeof node === 'string')
			node = document.querySelector(node);
		if (this.mounted && node === this.parentNode) {
			if (this.closing && this.transitionIn)
				this.transitionIn();
			return this;
		}
		utils.emptyNode(node);
		return this.appendTo(node);
	},
	appendTo: function(parent) {
		var par = parent;
		if (typeof parent === 'string')
			parent = document.querySelector(parent);
		if (this.mounted && parent === this.parentNode) {
			if (this.closing && this.transitionIn)
				this.transitionIn();
			return this;
		}
		if (!parent)
			throw new Error('could not mount container : no parent found with ' + par);
		this.mounted = true;
		if (parent.__yContainer__)
			parent.appendChild(this);
		else {
			if (this.witness)
				parent.appendChild(this.witness);
			this.parentNode = parent;
			for (var i = 0, len = this.childNodes.length; i < len; ++i) {
				var child = this.childNodes[i];
				if (child.__yContainer__)
					child.appendTo(parent);
				else
					parent.appendChild(child);
			}
		}
		this.emit('mounted', this);
		return this;
	},
	insertBeforeNode: function(node) {
		if (!node.parentNode)
			throw new Error('insertBeforeNode error : given node has no parent.');
		this.mounted = true;
		var frag = document.createDocumentFragment(),
			mounted = [];
		this.appendChildrenToFragment(frag, node.parentNode, mounted);
		// console.log('will insert container before : ', frag, node);
		node.parentNode.insertBefore(frag, node);
		for (var i = 0, len = mounted.length; i < len; ++i)
			mounted[i].emit('mounted', this);
		return this;
	},
	setWitness: function(witness) {
		this.witness = witness;
	},
	addWitness: function(title, parent) {
		if (this.witness)
			return this;
		this.witness = document.createComment(title);
		if (parent) {
			parent.appendChild(this.witness);
			return this;
		}
		if (!this.parentNode)
			return this;
		if (!this.childNodes.length) {
			console.warn('addWitness : container has been mounted without witness and children. Appending witness in parent.', this);
			this.parentNode.appendChild(this.witness);
		} else
			this.parentNode.insertBefore(this.witness, this.firstChild);
		return this;
	},
	removeWitness: function() {
		if (!this.witness)
			return this;
		if (this.witness.parentNode)
			this.witness.parentNode.removeChild(this.witness);
		this.witness = null;
		return this;
	},
	remount: function() {
		if (!this.witness.parentNode)
			throw new Error('container could not be remounted : witness has been unmounted.');
		if (this.mounted) {
			if (this.closing && this.transitionIn) {
				this.transitionIn();
			}
			return this;
		}
		var nextSibling = this.witness.nextSibling;
		if (nextSibling)
			this.insertBeforeNode(nextSibling);
		else
			this.appendTo(this.witness.parentNode);
		return this;
	},
	doUnmount: function(keepWitness) {
		this.mounted = false;
		if (!this.parentNode)
			return this;
		if (this.witness && !keepWitness)
			this.parentNode.removeChild(this.witness);
		for (var i = 0, len = this.childNodes.length; i < len; ++i) {
			var child = this.childNodes[i];
			if (child.__yContainer__)
				child.doUnmount();
			else if (child.parentNode)
				child.parentNode.removeChild(child);
		}
		this.parentNode = null;
		this.emit('unmounted', this);
		return this;
	},
	unmount: function(keepWitness, done) {
		if (!this.parentNode) { // container hasn't been mounted
			if (done)
				done(this);
			return this;
		}
		if (!this._beforeUnmount) {
			this.doUnmount(keepWitness);
			if (done)
				done(this);
			return this;
		}
		var self = this;
		this._beforeUnmount(function() {
			self.doUnmount(keepWitness);
			if (done)
				done(self);
		});
		return this;
	},
	appendChild: function(child) {
		if (this.parentNode) { // container has been mounted
			var nextSibling = this.nextSibling;
			if (nextSibling) {
				if (child.__yContainer__)
					child.insertBeforeNode(nextSibling);
				else
					this.parentNode.insertBefore(child, nextSibling);
			} else if (child.__yContainer__)
				child.appendTo(this.parentNode);
			else
				this.parentNode.appendChild(child);
		}
		this.childNodes.push(child);
		return this;
	},
	removeChild: function(child) {
		if (typeof child !== 'object') {
			var index = child;
			child = this.childNodes[index];
			if (!child)
				throw new Error('container.removeChild not found : ', index);
			this.childNodes.splice(index, 1);
		} else
			utils.array.remove(this.childNodes, child);
		if (this.parentNode) { // container has been mounted
			if (child.__yContainer__)
				child.unmount();
			else
				this.parentNode.removeChild(child);
		}
		return this;
	},
	destroyer: function() {
		var self = this;
		return function() {
			self.destroy();
		};
	},
	destroy: function() {
		this.mounted = false;
		this.emit('destroy', this);
		utils.destroyElement(this, true);
		this.destroyed = true;
		this.comment = null;
		this.parentNode = null;
	},
	hide: function() {
		this.childNodes.forEach(function(child) {
			if (child.__yContainer__)
				return child.hide();
			if (child.style)
				child.style.display = 'none';
		});
		return this;
	},
	show: function() {
		this.childNodes.forEach(function(child) {
			if (child.__yContainer__)
				return child.show();
			if (child.style)
				child.style.display = '';
		});
		return this;
	},
	beforeUnmount: function(handler) {
		this._beforeUnmount = handler;
	}
};

Object.defineProperty(Container.prototype, "nextSibling", {
	get: function() {
		if (!this.childNodes.length)
			if (this.witness)
				return this.witness.nextSibling;
			else
				return null;

		if (!this.parentNode)
			return null;
		var last = this.childNodes[this.childNodes.length - 1];
		if (last)
			return last.nextSibling;
		return null;
	}
});
Object.defineProperty(Container.prototype, "firstChild", {
	get: function() {
		var first = this.childNodes[0];
		if (first)
			if (first.__yContainer__)
				return first.firstChild;
			else
				return first;
		return null;
	}
});
Object.defineProperty(Container.prototype, "lastChild", {
	get: function() {
		var last = this.childNodes[this.childNodes.length - 1];
		if (last)
			if (last.__yContainer__)
				return last.lastChild;
			else
				return last;
		return null;
	}
});
utils.shallowMerge(proto, Container.prototype);

module.exports = Container;

},{"../../utils":22,"nomocas-utils/lib/emitter":2}],12:[function(require,module,exports){
/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * DOM only.
 * Collection manager (aka .each(...))
 *
 *
 *
 * to be rewrited : 
 * 
 * we need an eacher that manage array of pure contexts (or proxy) based on initial collection updates
 *
 * eacher.manage(context, collectionPath)
 * 		subscribe to collection updates and manage local context array
 * 
 * eacher.addRenderer(node, args, parentContainer, template, emptyTemplate)
 */
var utils = require('../../utils'),
	Container = require('./container'),
	Context = require('../../context').Context,
	Switcher = require('./switcher');

// Template .each method for DOM handling
var each = function(context, node, args, parentContainer) {
	var eacher = new Each(context, node, args[1], args[2], parentContainer),
		data = args[0];

	if (typeof data === 'string') {
		node.binds = node.binds ||  [];
		eacher.varPath = data;
		var splitted = data.split('.');
		context.subscribe(data, function(value, type, path, index) {
			// console.log('eacher : data update : |%s|', type, value, path, index)
			switch (type) {
				case 'delete':
					eacher.updateArray([]);
					break;
				case 'reset':
				case 'set':
					eacher.updateArray(value);
					break;
				case 'push':
					eacher.pushItem(value, index);
					break;
				case 'removeAt':
					eacher.deleteItem(index);
					break;
			}
		}, false, node.binds);
		context.subscribe(data + '.*', function(value, type, path, index) {
			var p = path.slice(splitted.length);
			// console.log('each data.* update : ', type, value, path, index, p)
			eacher.updateItem(type, p.slice(1), value, index, p[0]);
		}, true, node.binds);
		data = context.get(data);
	}
	eacher.updateArray(data);
};


// Each : Class that inherits from Switcher and does items-list/empty management
var Each = function(context, node, itemTemplate, emptyTemplate, parentContainer) {
	this.itemTemplate = itemTemplate;
	this.itemsContainer = new Container();
	this.parentContainer = parentContainer;
	var templates = [{
		value: 'items',
		container: this.itemsContainer
	}];
	if (emptyTemplate)
		templates.push({
			value: 'empty',
			template: emptyTemplate
		});
	Switcher.call(this, context, node, parentContainer, templates);
};

Each.prototype = {
	_createItem: function(value, index) {
		var ctx = new Context(value, this.context),
			self = this,
			child = this.itemTemplate.toContainer(ctx, this.parentContainer);
		child.context = ctx;
		ctx.index = index;
		ctx.path = self.varPath + '.' + index;
		return child;
	},
	updateArray: function(array) {
		if (!array || !array.length) {
			this.switch('empty');
			if (this.itemsContainer)
				this.itemsContainer.empty();
			return;
		}
		this.switch('items');
		var items = this.itemsContainer.childNodes;

		// reset existing
		var i = 0,
			len = Math.min(items.length, array.length);
		for (; i < len; ++i)
			items[i].context.reset(array[i]);

		if (len < items.length) {
			// array has less elements than rendered items : remove items from i to items.length
			len = items.length;
			var start = i;
			for (; i < len; ++i)
				items[i].destroy();
			items.splice(start);
		} else if (len < array.length) {
			// array has more elements than rendered items : add new items from i to array.length
			var frag = this.itemsContainer.parentNode ? document.createDocumentFragment() : null;
			len = array.length;
			for (; i < len; ++i) {
				var item = this._createItem(array[i], i);
				items.push(item);
				if (frag)
					item.appendChildrenToFragment(frag, this.itemsContainer.parentNode);
			}
			if (frag)
				appendFragment(frag, this.itemsContainer.parentNode, this.itemsContainer.childNodes.length ? (this.itemsContainer.nextSibling || this.witness.nextSibling) : this.witness.nextSibling);
		}
	},
	updateItem: function(type, path, value, index, key) {
		var node = this.itemsContainer.childNodes[index];
		if (node) {
			// console.log('each update item : ', type, node.context.path, path, value);
			if (!path.length)
				node.context.reset(value);
			else
				node.context.set(path, value);
		}
	},
	pushItem: function(data, index) {
		this.switch('items');
		var item = this._createItem(data, index),
			nextSibling = this.witness.nextSibling;
		if (this.itemsContainer.childNodes.length || !nextSibling)
			return this.itemsContainer.appendChild(item);
		if (nextSibling) {
			item.insertBeforeNode(nextSibling);
			this.itemsContainer.childNodes.push(item);
		}
		// console.log('item pushed : ', item);
	},
	deleteItem: function(index) {
		var node = this.itemsContainer.childNodes[index];
		node.doUnmount();
		var children = this.itemsContainer.childNodes;
		children.splice(index, 1);
		if (!children.length)
			this.switch('empty');
		else
			for (var i = index, len = children.length; i < len; ++i) {
				children[i].context.index = i;
				children[i].context.path = this.varPath + '.' + i;
			}
	}
};

function appendFragment(frag, parent, nextSibling) {
	// console.log('append to fragment : ', frag, parent, nextSibling);
	if (nextSibling)
		parent.insertBefore(frag, nextSibling);
	else
		parent.appendChild(frag);
}

utils.shallowMerge(Switcher.prototype, Each.prototype);

module.exports = {
	Each: Each,
	each: each
};



/*

function eacher(context, node, args, parentContainer) {}


function Eacher(context, node, itemTemplate, emptyTemplate, parentContainer) {

}

Eacher.prototype = {
	renderItem: function(context, itemTemplate) {

	},
	subscribeTo: function(context, path) {

	},
	addOutput: function(node, itemTemplate, emptyTemplate) {
		this.output.push(new Switch())
	}
}*/

},{"../../context":7,"../../utils":22,"./container":11,"./switcher":14}],13:[function(require,module,exports){
/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * Pure DOM engine (modern browser first).
 *
 * Applies everything (binds, loads, events, ...) directly on DOM node.
 * No virtual DOM. Here it's simply replaced with arrays of (nested) functions that keep binds.
 * Ultra Fast.
 */
var utils = require('../../utils'),
	Container = require('./container'),
	Context = require('../../context').Context,
	Template = require('../../template'),
	Switcher = require('./switcher');

function findEventActor(name, context, node, container) {
	var splitted = name.split('.'),
		out = { actor: node, name: name };
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
	each: require('./each').each,
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
			context.onAgora(channel + ':toggle', function(context, message) {
				if (!container || !container.mounted || container.closing)
					context.toAgora(channel + ':show', message);
				else
					context.toAgora(channel + ':hide', message);
			});
			context.onAgora(channel + ':show', function(context, message) {
				if (!container) {
					container = y().view(template).toContainer(context, parentContainer);
					container.setWitness(witness);
				}
				if (message)
					container.context.set(message);
				container.remount();
			});
			context.onAgora(channel + ':hide', function(context, message) {
				if (!container)
					return;
				if (message)
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
			pathIsString = typeof path === 'string',
			data = pathIsString ? context.get(path) : null,
			template = args[1],
			ctx = new Context(data, context, pathIsString ? path : null);
		ctx.binds = ctx.binds || [];

		// if (pathIsString)
		// parent to local bind
		if (pathIsString) {
			// ctx.upwardToParent = true;
			var splitted = path.split('.');
			// // reverse bind : tell to parent when local changes
			// ctx.subscribe('*', function(value, type, p, key) {
			// 	if (this.freezed)
			// 		return;
			// 	var fullPath = path + (p === '$this' ? '' : ('.' + p));
			// 	this.freezed = true;
			// 	context.notify(type, fullPath, value, key);
			// 	this.freezed = false;
			// });
			context.subscribe(path, function(value, type, p, key) {
				if (this.freezed)
					return;
				var localPath = p.slice(splitted.length).join('.');
				switch (type) {
					case 'reset':
						ctx.reset(value);
						break;
					case 'set':
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
		}
		template.toDOM(node, ctx, container);
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
			freeze,
			val;

		if (value.__interpolable__) {
			val = value.output(context);
			var handler = function(event) {
				var newVal = utils.castNodeValueTo(event.target, castTo);
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
						node.addEventListener(eventName, handler);
					else
						node.removeEventListener(eventName, handler);
					node.setAttribute('contenteditable', !!value);
				});
			}
			if (flagValue) {
				node.addEventListener(eventName, handler);
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
		console.log(args[0] ||  '');
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

},{"../../context":7,"../../template":21,"../../utils":22,"./container":11,"./each":12,"./switcher":14}],14:[function(require,module,exports){
/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * Switcher : inner class that hold bunch of templates associated with a value.
 * DOM only.
 * It allows to switch between templates (rendered and mounted as Container) somewhere in DOM.
 */

var utils = require('../../utils'),
	interpolable = require('../../interpolable').interpolable;

var Switcher = function(context, node, parentContainer, items, defaultTemplate) {
	this.witness = document.createComment('switcher');
	node.appendChild(this.witness); // dummy dom position marker
	this.node = node;
	this.context = context;
	this.items = items;
	this.defaultTemplate = defaultTemplate;
};

Switcher.prototype = {
	expression: function(expression) {
		expression = interpolable(expression);
		if (expression.__interpolable__) {
			var self = this;
			expression.subscribeTo(this.context, function(value) {
				self.switch(value);
			});
			this.switch(expression.output(this.context));
		} else if (typeof expression === 'function')
			this.switch(expression(this.context));
		else
			this.switch(expression);
	},
	switch: function(value) {
		var self = this;
		var ok = this.items.some(function(item) {
			if (item.value == value) {
				if (!item.container)
					item.container = item.template.toContainer(self.context);
				self._mount(item.container);
				return true;
			}
		});
		if (!ok) {
			if (this.defaultTemplate) {
				if (!this.defaultContainer)
					this.defaultContainer = this.defaultTemplate.toContainer(this.context);
				self._mount(this.defaultContainer);
			} else
				self._unmountCurrent();
		}
	},
	_unmountCurrent: function() {
		if (this.currentContainer) {
			if (this.node.__yContainer__)
				this.node.removeChild(this.currentContainer);
			else
				this.currentContainer.unmount();
			this.currentContainer = null;
		}
	},
	_mount: function(container) {
		if (this.currentContainer === container)
			return;
		this._unmountCurrent();
		this.currentContainer = container;

		if (this.node.__yContainer__ && !this.node.parentNode) { // node is not mounted
			utils.array.insertAfter(this.node.childNodes, this.witness, container);
			return;
		}
		var nextSibling = this.witness.nextSibling;
		if (nextSibling)
			container.insertBeforeNode(nextSibling);
		else
			container.appendTo(this.witness.parentNode);
	}
};

module.exports = Switcher;

},{"../../interpolable":10,"../../utils":22}],15:[function(require,module,exports){
var elenpi = require('elenpi'),
	r = elenpi.r,
	Parser = elenpi.Parser,
	Template = require('../template');

var rules = {

	emmet: r()
		.regExp(/^([\w-_]+)\s*/, false, function(templ, cap) {
			templ.tagName = cap[1];
		})
		.zeroOrMore('attrs',
			r().oneOf(['class', 'yam', 'id', 'text', 'attr'])
		),

	class: r()
		.regExp(/^\./, false, function(templ, cap) {
			templ.isClass = true
			templ.xpr = [];
		})
		.rule('interpolable')
		.rule('endExpression'),

	id: r()
		.regExp(/^#/, false, function(templ, cap) {
			templ.isID = true;
			templ.xpr = [];
		})
		.rule('interpolable'),

	attr: r()
		.regExp(/^[\w-]+/, false, function(templ, cap) {
			templ.isAttr = true
			templ.name = cap[0];
			templ.xpr = [];
		})
		.rule('endExpression'),

	endExpression: r()
		.zeroOrOne(null,
			r().regExp(/^\s*\(\s*([^\)]*)\s*\)\s*/, false, function(templ, cap) {
				templ.xpr.push(cap[1]);
			})
		),

	interpolable: r()
		.regExp(/^\{{1,2}[^\}]+\}{1,2}|[\w-_]+/, false, function(templ, cap) {
			templ.xpr.push(cap[0]);
		})
		.space(),

	text: r()
		.regExp(/^~([^~]*)$/, false, function(templ, cap) {
			templ.isText = true;
			templ.text = cap[1];
		}),

	yam: r()
		.regExp(/^y:([\w-_]+)/, false, function(templ, cap) {
			templ.isYam = true;
			templ.name = cap[1];
			templ.xpr = [];
		})
		.rule('endExpression')
};

var parser = new Parser(rules, 'emmet');
parser.toTemplate = function(xpr, template, tagArguments) {
	var parsed = this.parse(xpr);
	if (!parsed)
		throw new Error('emmet style badly formatted : ' + xpr);
	// console.log('emmet parsed : ', parsed);
	var innerTempl = new Template();
	for (var i = 0, len = parsed.attrs.length; i < len; ++i) {
		var attr = parsed.attrs[i];
		if (attr.isClass)
			innerTempl.cl(attr.xpr[0], attr.xpr[1]);
		else if (attr.isID)
			innerTempl.id(attr.xpr[0]);
		else if (attr.isText)
			innerTempl.text(attr.text)
		else if (attr.isYam) {
			if (!innerTempl[attr.name])
				throw new Error('emmet parsing : no template method found with : ', attr.name);
			innerTempl[attr.name].apply(innerTempl, attr.xpr);
		} else
			innerTempl.attr(attr.name, attr.xpr[0]);
	}
	tagArguments = [parsed.tagName, innerTempl].concat(tagArguments || []);
	template = template || new Template();
	return template.tag.apply(template, tagArguments);
}

Template.prototype.emmet = function(xpr) {
	parser.toTemplate(xpr, this, [].slice.call(arguments, 1));
	return this;
};

module.exports = parser;

},{"../template":21,"elenpi":1}],16:[function(require,module,exports){
/** 
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * for parsing html5 to yamvish template.
 */

var elenpi = require('elenpi'),
	r = elenpi.r,
	Parser = elenpi.Parser,
	Template = require('../template'),
	expression = require('./string-to-template'), // for data-template attribute parsing
	api = require('../api'),
	attributeExpr = /^([\w-_]+)\s*(?:=\s*("([^"]*)"|[\w-_]+|\{\{[^\}]+\}\}|\{[^\}]+\}))?\s*/,
	yamTagWithPath = /if|each|with|mountIf/,
	yamTagWithoutPath = /client|server|view|container/,
	yamAPITag = /[\w\.\$_-]+\:[\w\.\$_-]+/,
	yamTags = new RegExp('^<(' + yamTagWithPath.source + '|' + yamTagWithoutPath.source + '|' + yamAPITag.source + ')\\s*'),
	openTags = require('./open-tags'), // html5 unstrict self closing tags 
	rawContentTags = /^(?:script|style|code|templ)/;

// raw inner content of tag
function rawContent(tagName, string, templ, innerTemplate) {
	var index = string.indexOf('</' + tagName + '>'),
		raw;
	if (index === -1)
		throw new Error(tagName + ' tag badly closed.');
	if (index) { // more than 0
		raw = string.substring(0, index);
		if (tagName === 'templ') // produce local api-like handler
		{
			innerTemplate.templFunc = new Function(raw);
		} else
			innerTemplate.raw(raw);
	}
	return string.substring(index + tagName.length + 3);
}

var rules = {

	document: r()
		.zeroOrMore(null, r().space().rule('comment'))
		.regExp(/^\s*<!DOCTYPE[^>]*>\s*/i, true)
		.rule('children')
		.space(),

	comment: r().regExp(/^<!--(?:.|\s)*?(?=-->)-->/, false, function() {}),

	tagEnd: r()
		// closing tag
		.regExp(/^\s*<\/([\w:-_]+)\s*>/, false, function(templ, cap) {
			if (templ.tagName !== cap[1])
				throw new Error('tag badly closed : ' + cap[1] + ' - (at opening : ' + templ.tagName + ')');
		}),

	// tag children
	children: r()
		.zeroOrMore(null,
			r().oneOf([
				r().space().rule('comment'),
				r().space().rule('yamTag'),
				r().space().rule('tag'),
				r().rule('text')
			])
		),

	text: r()
		// .regExp(/^\s+/, true, function(templ) {
		// 	templ.text(' ');
		// })
		.regExp(/^[^<]+/, false, function(templ, cap) {
			templ.text(cap[0]);
		}),

	// normal tag (including raw tags and so also special yamvish templ tag)
	tag: r()
		.regExp(/^<([\w-_]+)\s*/, false, function(templ, cap) {
			templ.tagName = cap[1];
		})
		.done(function(string, templ) {
			templ._innerTemplate = new Template();
			return this.exec(string, templ._innerTemplate, this.rules.attributes);
		})
		.oneOf([
			r().char('>')
			.done(function(string, templ) {
				// check html5 unstrict self-closing tags
				if (openTags.test(templ.tagName))
					return string; // no children

				if (rawContentTags.test(templ.tagName)) // get raw content
					return rawContent(templ.tagName, string, templ, templ._innerTemplate);

				// get inner tag content
				var ok = this.exec(string, templ._innerTemplate, this.rules.children);
				if (ok === false)
					return false;
				// close tag
				return this.exec(ok, templ, this.rules.tagEnd);
			}),
			// strict self closed tag
			r().regExp(/^\/>/)
		])
		.done(function(string, templ) {
			if (templ.tagName === 'yield')
				templ.tagName = '__yield';
			if (templ.tagName !== 'templ')
				templ.tag(templ.tagName, templ._innerTemplate);
			else
				templ.use(templ._innerTemplate.templFunc);

			templ._innerTemplate = null;
			templ.tagName = null;
			return string;
		}),

	// yamvish special tags path arguments
	yamTagPath: r().regExp(/^([\w-_$]+|\{{1,2}[^\}]*\}{1,2})/, false, function(templ, cap) {
		templ.path = cap[1];
	}),

	yamTag: r() // yamvish special tags
		.regExp(yamTags, false, function(templ, cap) {
			templ.tagName = cap[1];
		})
		.done(function(string, templ) {
			var attrMap = {};
			templ.attrMap = attrMap;
			if (templ.tagName.match(yamTagWithPath))
				return this.exec(string, attrMap, this.rules.yamTagPath);
			else if (templ.tagName.match(yamTagWithoutPath))
				return string;
			// api tag : catch normal attr
			return this.exec(string, attrMap, this.rules.attributesMap);
		})
		.space()
		.oneOf([
			r().char('>')
			.done(function(string, templ) {
				// get inner tag content
				var t = templ._innerTemplate = new Template(),
					ok = this.exec(string, t, this.rules.children);
				if (ok === false)
					return false;
				// close tag
				return this.exec(ok, templ, this.rules.tagEnd);
			}),
			// strict self closed tag
			r().regExp(/^\/>/)
		])
		.done(function(string, templ) {
			var tagName = templ.tagName,
				attrMap = templ.attrMap,
				_yield = templ._innerTemplate;

			switch (tagName) {
				case 'if':
				case 'each':
				case 'with':
				case 'mountIf':
					templ[tagName](attrMap.path, _yield);
					break;
				case 'client':
				case 'server':
				case 'view':
				case 'container':
					templ[tagName](_yield);
					break;
				default: // api tag
					templ.use(tagName, attrMap, _yield);
			}
			templ._innerTemplate = null;
			templ.attrMap = null;
			templ.tagName = null;
			return string;
		}),

	attributesMap: r() // attributes to attrMap for api tags
		.zeroOrMore(null,
			r().regExp(attributeExpr, false, function(descriptor, cap) {
				descriptor[cap[1]] = (cap[3] !== undefined) ? cap[3] : ((cap[2] !== undefined) ? cap[2] : '');
			})
			.space()
		),

	attributes: r() // attributes to template for normal tags
		.zeroOrMore(null,
			// attrName | attrName="... ..." | attrName=something | attrName={{ .. }} | attrName={ .. }
			// with an optional space (\s*) after equal sign (if any).
			r().regExp(attributeExpr, false, function(templ, cap) {
				var attrName = cap[1],
					value = (cap[3] !== undefined) ? cap[3] : ((cap[2] !== undefined) ? cap[2] : '');

				switch (attrName) {
					case 'class':
						if (!value)
							break;
						value.split(/\s+/).forEach(function(cl) {
							if (cl)
								templ.cl(cl);
						});
						break;
					case 'data-template':
						if (!value)
							break;
						var template = expression.parseTemplate(value);
						if (template !== false)
							templ._queue = templ._queue.concat(template._queue);
						else
							throw new Error('data-template attribute parsing failed : ' + value);
						break;
					default:
						templ.attr(attrName, value);
						break;
				}
			})
		)
};

var parser = new Parser(rules, 'children');

parser.createDescriptor = function() {
	return new Template();
};

module.exports = parser;


/*

var html = `
<div id="e2">
<templ>this.p("zeClick")</templ>
<if {{ foo }}>hello world</if>
<each items><span>{{ $this }}</span></each>
</div>


<test:hello id={{ bar }}>
  <test:hello id="e3" />
  hello api world
</test:hello>
`;
var templ, res = '';

y.api.test = {
  hello:function(attrMap, _yield){
    return this.section(attrMap, _yield);
  }
};

templ = y.html.parse(html);


var ctx = new y.Context({ bar:"dynID", foo:true, items:['ho', 'yeah'], zeClick:function(){ console.log('zeeee clickkkk!!'); } });

if(templ)
  res = templ.toHTMLString(ctx);

res


//templ




 */

},{"../api":5,"../template":21,"./open-tags":18,"./string-to-template":20,"elenpi":1}],17:[function(require,module,exports){
/** 
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * for parsing listener attribute : e.g. .click('foo(bar, 12)')
 */

var elenpi = require('elenpi'),
	r = elenpi.r,
	Parser = elenpi.Parser,
	primitiveArguments = require('./primitive-argument-rules');

var rules = {
	path: r()
		.oneOrMore(null, r().regExp(/^[\w-_\$]+/, false, function(descriptor, cap) {
			(descriptor.path = descriptor.path ||  []).push(cap[0]);
		}), r().regExp(/^\./)),

	call: r()
		.rule('path')
		.done(function(string, descriptor) {
			descriptor.method = descriptor.path;
			descriptor.path = null;
			descriptor.arguments = [];
			return string;
		})
		.zeroOrOne(null,
			r()
			.regExp(/^\s*\(\s*/)
			.zeroOrMore(null,
				r().oneOf(['integer', 'float', 'bool', 'singlestring', 'doublestring', r().rule('path')
					.done(function(string, descriptor) {
						descriptor.arguments.push(descriptor.path);
						descriptor.path = null;
						return string;
					})
				]),
				r().regExp(/^\s*,\s*/)
			)
			.regExp(/^\s*\)/)
		)
};

for (var i in primitiveArguments)
	rules[i] = primitiveArguments[i];

var parser = new Parser(rules, 'call');

parser.parseListener = function(string) {
	var parsed = this.parse(string);
	if (!parsed.method)
		throw new Error('yamvish listener badly formatted : ' + string);
	return function(e) {
		var handler = this.get(parsed.method);
		if (!handler)
			throw new Error('yamvish listener not found : ' + string);
		if (!parsed.arguments)
			return handler.call(this, e);
		var args = [e];
		for (var i = 0, len = parsed.arguments.length; i < len; ++i) {
			var arg = parsed.arguments[i];
			args.push(arg.forEach ? this.get(arg) : arg);
		}
		return handler.apply(this, args);
	};
};

module.exports = parser;

},{"./primitive-argument-rules":19,"elenpi":1}],18:[function(require,module,exports){
/**
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * all tags that could be used without closing sequence (as <br>)
 */
module.exports = /(br|input|img|area|base|col|command|embed|hr|img|input|keygen|link|meta|param|source|track|wbr)/;

},{}],19:[function(require,module,exports){
/**
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * elenpi rules for primitives function's arguments. aka : "double", 'single', 1.12, 14, true, false
 */
var r = require('elenpi').r;

var rules = {
	doublestring: r().regExp(/^"([^"]*)"/, false, function(descriptor, cap) {
		descriptor.arguments.push(cap[1]);
	}),
	singlestring: r().regExp(/^'([^']*)'/, false, function(descriptor, cap) {
		descriptor.arguments.push(cap[1]);
	}),
	'float': r().regExp(/^[0-9]*\.[0-9]+/, false, function(descriptor, cap) {
		descriptor.arguments.push(parseFloat(cap[0], 10));
	}),
	integer: r().regExp(/^[0-9]+/, false, function(descriptor, cap) {
		descriptor.arguments.push(parseInt(cap[0], 10));
	}),
	bool: r().regExp(/^(true|false)/, false, function(descriptor, cap) {
		descriptor.arguments.push((cap[1] === 'true') ? true : false);
	})
};

module.exports = rules;

},{"elenpi":1}],20:[function(require,module,exports){
/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * for parsing data-template attributes as :
 * text('hello').div('bloupi').click('showAll(myVar)')
 */

var elenpi = require('elenpi'),
	r = elenpi.r,
	Parser = elenpi.Parser,
	Template = require('../template'),
	primitiveArguments = require('./primitive-argument-rules');

var rules = {
	//_____________________________________
	// click('addUser').div(p().h(1,'hello'))
	templates: r()
		.space()
		.zeroOrMore('calls',
			r().rule('template'),
			r().regExp(/^\s*\.\s*/)
		)
		.done(function(string, descriptor) {
			var t;
			if (descriptor.calls)
				t = compile(descriptor.calls);
			if (t && descriptor.arguments) {
				descriptor.arguments.push(t);
				delete descriptor.calls;
			} else
				descriptor.calls = t;
			return string;
		}),

	template: r()
		.regExp(/^[\w-_]+/, false, function(descriptor, cap) {
			descriptor.method = cap[0];
			descriptor.arguments = [];
		})
		.zeroOrOne(null,
			r()
			.regExp(/^\s*\(\s*/)
			.zeroOrMore(null,
				r().oneOf(['integer', 'float', 'bool', 'singlestring', 'doublestring', 'templates']),
				r().regExp(/^\s*,\s*/)
			)
			.regExp(/^\s*\)/)
		)
};

for (var i in primitiveArguments)
	rules[i] = primitiveArguments[i];

var parser = new Parser(rules, 'templates');

function compile(calls) {
	var ch = new Template();
	for (var i = 0, len = calls.length; i < len; ++i) {
		var call = calls[i];
		if (!ch[call.method])
			throw new Error('no handler found in Template as : ' + call.method);
		ch[call.method].apply(ch, call.arguments);
	}
	return ch;
}

var templateCache = {};

parser.parseTemplate = function(string) {
	if (templateCache[string] !== undefined)
		return templateCache[string].calls;
	var result = templateCache[string] = parser.parse(string);
	if (result === false)
		return false;
	return result.calls;
};

module.exports = parser;

/*
console.log(y.expression.parseTemplate("click ( '12', 14, true, p(2, 4, span( false).p())). div(12345)"));
 */

},{"../template":21,"./primitive-argument-rules":19,"elenpi":1}],21:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
"use strict";

var utils = require('./utils'),
	interpolable = require('./interpolable').interpolable,
	Context = require('./context').Context,
	api = require('./api'),
	listenerParser = require('./parsers/listener-call');

function argToArr(arg, start) {
	return Array.prototype.slice.call(arg, start);
}

function parseMap(map, methodName) {
	var t = y();
	for (var i in map)
		t[methodName](i, map[i]);
	return t;
}

function parseAttrMap(attrMap) {
	var t = y(),
		keys = Object.keys(attrMap);
	for (var i = 0, l = keys.length; i < l; i++) {
		var prop = keys[i],
			value = attrMap[prop];
		switch (prop) {
			case 'style':
				t.use(parseMap(value, 'css'));
				break;
			case 'classes':
				t.use(parseMap(value, 'cl'));
				break;
			case 'value':
				t.val(value);
				break;
			case 'disabled':
				t.disabled(value);
				break;
			case 'visible':
				t.visible(value);
				break;
			default: // attr
				t.attr(prop, value);
		}
	}
	return t;
};
utils.parseAttrMap = parseAttrMap;

function execEngineBlock(templ, block, args, suspendAfter) {
	if (suspendAfter)
		templ._queue.push({
			engineBlock: block,
			args: args,
			suspendAfter: true
		});
	else
		templ._queue.push({
			engineBlock: block,
			args: args
		});
	return templ;
}

function Template(t) {
	this.__yTemplate__ = true;
	if (t) {
		if (t.forEach)
			this._queue = t;
		else
			this._queue = t._queue.slice();
	} else
		this._queue = [];
}

function y() {
	return new Template();
}

function enqueue(templ, type, handler, args, suspendAfter) {
	if (suspendAfter)
		templ._queue.push({
			type: type,
			handler: handler,
			args: args,
			suspendAfter: suspendAfter
		});
	else
		templ._queue.push({
			type: type,
			handler: handler,
			args: args
		});
	return templ;
}

Template.prototype = {
	//___________________________________________ EXECUTIONS HANDLERS
	dom: function(func, args, suspendAfter) {
		return enqueue(this, 'dom', func, args, suspendAfter);
	},
	string: function(func, args, suspendAfter) {
		return enqueue(this, 'string', func, args, suspendAfter);
	},
	context: function(func, args, suspendAfter) {
		return enqueue(this, 'context', func, args, suspendAfter);
	},
	// normally you should never call this one (only for internal usage)
	exec: function(name, args, suspendAfter) {
		if (typeof name === 'object')
			return enqueue(this, 'custom', name, args, suspendAfter);
		return enqueue(this, '*', name, args, suspendAfter);
	},
	// normally you should never call this one (only for internal context tricks)
	firstPass: function(func, args, suspendAfter) {
		return enqueue(this, 'firstPass', func, args, suspendAfter);
	},
	// normally you should never call this one (only for internal context tricks)
	secondPass: function(func, args, suspendAfter) {
		return enqueue(this, 'secondPass', func, args, suspendAfter);
	},
	//________________________________ Container
	container: function(options, template) {
		if (options.__yTemplate__) {
			template = options;
			options = {};
		}
		this._queue.push({
			type: '*',
			handler: 'container',
			args: [options, template],
			asContainer: true
		});
		return this;
	},
	/**  
	 * View means something special in yamvish. there is no view instance as you could find in other MV* lib.
	 * View here is just a __Template__ that will always produce a container that will be mounted in parent node.
	 * (in dom output case of course, but it's transparent for string or twopass output)
	 * 
	 * Additionnaly, it will produce and hold its own context in produced container.
	 * 
	 * Exactly as what a classic view's instance would encapsulate (some nodes and a local context).
	 *
	 * But here finally, we just have simple nodes that could be mounted/unmounted and that refer to a local context. And nothing more.
	 *
	 * In place of View's class instanciation, you have View's template execution. 
	 *
	 * All that sounds much more complex than when you use it... less is more... ;)
	 */
	view: function(options, template) {
		if (options.__yTemplate__) {
			template = options;
			options = {};
		}
		// let opt & defaultOpt and yields to be managed by parser
		return this.container(
			y().newContext(options.data, options.parent, options.path)
			.use(template)
		);
	},
	lateMount: function(handler, template) {
		if (typeof template === 'string')
			template = y().use(template);
		// let opt & defaultOpt and yields to be managed by parser
		return this.exec('lateMount', [handler, template]);
	},
	agoraView: function(channel, template) {
		if (typeof template === 'string')
			template = y().use(template);
		// let opt & defaultOpt and yields to be managed by parser
		return this.exec('agoraView', [channel, template]);
	},
	//________________________________ CONTEXT and Assignation
	set: function(path, value) {
		var argsLength = arguments.length;
		return this.context(function(context) {
			if (argsLength === 2)
				context.set(path, value);
			else
				context.set(path);
		});
	},
	setAsync: function(path, value) {
		return this.context(function(context) {
			context.setAsync(path, value);
		});
	},
	dependent: function(path, args, func) {
		return this.context(function(context) {
			context.dependent(path, args, func);
		});
	},
	push: function(path, value) {
		return this.context(function(context) {
			context.push(path, value);
		});
	},
	pushAsync: function(path, value) {
		return this.context(function(context) {
			context.pushAsync(path, value);
		});
	},
	toggle: function(path) {
		return this.context(function(context) {
			context.toggle(path);
		});
	},
	toggleInArray: function(path) {
		return this.context(function(context) {
			context.toggleInArray(path);
		});
	},
	del: function(path) {
		return this.context(function(context) {
			context.del(path);
		});
	},
	newContext: function(data, parent) {
		return this.exec('newContext', [data, parent]);
	},
	with: function(path, template) {
		return this.exec('with', [path, template]);
	},
	subscribe: function(path, handler, upstream) {
		return this.context(function(context) {
			context.subscribe(path, handler, upstream);
		});
	},
	unsubscribe: function(path, handler, upstream) {
		return this.context(function(context) {
			context.unsubscribe(path, handler, upstream);
		});
	},
	//__________________________________ Agora
	onAgora: function(name, handler) {
		return this.context(function(context) {
			context.onAgora(name, handler);
		});
	},
	offAgora: function(name, handler) {
		return this.context(function(context) {
			context.offAgora(name, handler);
		});
	},
	toAgora: function(name, msg) {
		return this.context(function(context) {
			context.toAgora(name, msg);
		});
	},
	//__________________________________ Attributes
	attr: function(name, value) {
		return this.exec('attr', [name, typeof value !== 'undefined' ? interpolable(value) : undefined]);
	},
	prop: function(name, value) {
		return this.exec('prop', [name, typeof value !== 'undefined' ? interpolable(value) : undefined]);
	},
	id: function(value) {
		return this.attr('id', value);
	},
	disabled: function(xpr) {
		return this.exec('prop', ['disabled', interpolable(xpr)]);
	},
	val: function(value) {
		var varPath;
		if (typeof value === 'string') {
			value = interpolable(value);
			if (value.__interpolable__) {
				if (value.dependenciesCount > 1)
					throw new Error("template.val could only depend to one variable.");
				varPath = value.parts[1].dep[0];
			}
		}
		return this.exec('val', [varPath, value]);
	},
	html: function(content) {
		content = interpolable(content);
		return this.dom(function(context, node) {
				var val = content,
					elems = [];
				var update = function(newContent) {
					var div = document.createElement('div'),
						wrapped;
					if (newContent[0] !== '<') { // to avoid bug of text node that disapear
						newContent = '<p>' + newContent + '</p>';
						wrapped = true;
					}
					div.innerHTML = newContent;
					elems.forEach(function(el) {
						if (el.parentNode)
							el.parentNode.removeChild(el);
					});
					elems = [];
					var parent = wrapped ? div.firstChild : div,
						childNodes = [].slice.call(parent.childNodes);
					for (var i = 0, len = childNodes.length; i < len; ++i) {
						var el = childNodes[i];
						elems.push(el)
						node.appendChild(el);
					}
				}
				if (content.__interpolable__) {
					val = content.output(context);
					content.subscribeTo(context, function(value) {
						update(value);
					});
				}
				update(val);
			})
			.string(function(context, descriptor) {
				var html = content.__interpolable__ ? content.output(context) : content;
				if (html[0] !== '<') // to be consistant with node approach
					html = '<p>' + html + '</p>';
				descriptor.children += html;
			});
	},
	contentEditable: function(value, flag, type, eventName) {
		var varPath, flag;
		if (flag) flag = interpolable(flag);
		if (typeof value === 'string') {
			value = interpolable(value);
			if (value.__interpolable__) {
				if (value.dependenciesCount > 1)
					throw new Error("template.contentEditable could only depend to one variable. : " + value.original);
				varPath = value.parts[1].dep[0];
			}
		}
		return this.exec('contentEditable', [varPath, value, flag, type || 'text', eventName || 'input']);
	},
	setClass: function(name, flag) {
		if (typeof flag === 'undefined')
			flag = true;
		else
			flag = interpolable(flag);
		return this.exec('setClass', [interpolable(name), flag]);
	},
	css: function(prop, value) {
		return this.exec('css', [prop, interpolable(value)]);
	},
	visible: function(flag) {
		return this.exec('visible', [interpolable(flag)]);
	},
	//_______________________________________ HTML TAGS

	text: function(value) {
		return this.exec('text', [interpolable(value)]);
	},
	tag: function(name, attrMap) { // arguments : name, ?(attrMap|template1), ?t2, ...
		var t,
			hasAttrMap = (attrMap && typeof attrMap === 'object' && !attrMap.__yTemplate__) ? true : false;
		if (hasAttrMap)
			t = parseAttrMap(attrMap);
		else
			t = y();
		for (var i = (hasAttrMap ? 2 : 1), len = arguments.length; i < len; ++i) {
			if (!arguments[i])
				continue;
			if (!arguments[i].__yTemplate__)
				t.text(arguments[i]);
			else
				t.use(arguments[i]);
		}
		return this.exec('tag', [name, t]);
	},
	raw: function(raw) {
		return this.exec('raw', [raw]);
	},
	br: function() {
		return this.exec('br');
	},
	a: function(href) {
		var args = argToArr(arguments, 1);
		args.unshift('a', typeof href === 'string' ? y().attr('href', href) : href);
		return this.tag.apply(this, args);
	},
	img: function(src) {
		var args = argToArr(arguments, 1);
		args.unshift('img', typeof src === 'string' ? y().attr('src', src) : src);
		return this.tag.apply(this, args);
	},
	/**
	 * add input tag.    .input(type, value, t1, t2, ...)   or .input(attrMap, t1, t2, ...)
	 * @param  {String} type  'text' or 'password' or ...
	 * @param  {*} value the value to pass to .val(...). Could be a string, an interpolable string, or a direct value (aka an int, a bool, ...)
	 * @return {Template}     current template handler
	 */
	input: function(type, value) {
		var args;
		if (typeof type === 'string') {
			args = argToArr(arguments, 2);
			var template = y().attr('type', type);
			if (value)
				template.val(value);
			args.unshift('input', template);
		} else
			args = argToArr(arguments);
		return this.tag.apply(this, args);
	},
	textarea: function(opt, value, templ) {
		return this.tag('textarea', opt, y().val(value).text(value).use(templ));
	},
	h: function(level) {
		var args = argToArr(arguments, 1);
		args.unshift('h' + level);
		return this.tag.apply(this, args);
	},
	space: function() {
		return this.exec('text', [' ']);
	},
	nbsp: function() {
		return this.exec('text', ['\u00A0']);
	},
	select: function(value, options, templ) {
		var varPath;
		if (typeof value === 'string') {
			value = interpolable(value);
			if (value.__interpolable__) {
				if (value.dependenciesCount > 1)
					throw new Error("template.val could only depend to one variable.");
				varPath = value.parts[1].dep[0];
			}
		}
		return this.tag('select',
			y()
			.attr('name', varPath)
			.each(options,
				y().option('{{ label || val }}',
					y().val('{{  val }}')
					.prop('selected', '{{ val === $parent.' + varPath + ' }}')
				)
			)
			.if(value.__interpolable__,
				y().on('change', function(e) {
					var select = e.target,
						value = select.options[select.selectedIndex].value;
					if (this.get(varPath) !== value)
						this.set(varPath, value);
				})
			),
			templ
		);
	},
	//___________________________________ EVENTS LISTENER
	on: function(name, handler) {
		if (typeof handler === 'string')
			handler = listenerParser.parseListener(handler);
		return this.exec('on', [name, handler]);
	},
	once: function(name, handler) {
		if (typeof handler === 'string')
			handler = listenerParser.parseListener(handler);
		return this.exec('once', [name, handler]);
	},
	off: function(name, handler) {
		if (typeof handler === 'string')
			handler = listenerParser.parseListener(handler);
		return this.exec('off', [name, handler]);
	},
	//___________________________________________ Collection iterator
	each: function(path, templ, emptyTempl) {
		if (!templ)
			throw new Error('yamvish each methods needs a template. (path : ' + path + ')');
		templ = (typeof templ === 'string') ? y().use(templ) : templ;
		if (emptyTempl)
			emptyTempl = (typeof emptyTempl === 'string') ? y().use(emptyTempl) : emptyTempl;
		return this.exec('each', [path, templ, emptyTempl]);
	},
	//___________________________________________ Templates Collection iterator
	eachTemplates: function(templates, handler) {
		return this.exec('eachTemplates', [templates, handler]);
	},
	//_____________________________ Conditional immediate execution (no bind)
	if: function(condition, successTempl, failTempl) {
		successTempl = (typeof successTempl === 'string') ? y().use(successTempl) : successTempl;
		if (failTempl)
			failTempl = (typeof failTempl === 'string') ? y().use(failTempl) : failTempl;
		return this.exec('if', [interpolable(condition), successTempl, failTempl]);
	},
	//_____________________________ Conditional node rendering/mounting (binded)
	mountIf: function(condition, successTempl, failTempl) {
		successTempl = (typeof successTempl === 'string') ? y().use(successTempl) : successTempl;
		if (failTempl)
			failTempl = (typeof failTempl === 'string') ? y().use(failTempl) : failTempl;
		return this.exec('mountIf', [interpolable(condition), successTempl, failTempl]);
	},
	switch: function(xpr, map) {
		for (var i in map)
			if (typeof map[i] === 'string')
				map[i] = y().use(map[i]);
		return this.exec('switch', [interpolable(xpr), map]);
	},
	//____________________________________________ API mngt
	use: function(name) {
		if (!name)
			return this;
		var args = argToArr(arguments);
		args.shift();
		if (typeof name === 'string')
			name = name.split(':');
		var method = (name.forEach ? utils.getApiMethod(api, name) : name);
		if (method.__yTemplate__)
			this._queue = this._queue.concat(method._queue);
		else
			method.apply(this, args);
		return this;
	},
	// add all methods from given api to current template instance (will only affect current chain)
	addApi: function(name) {
		var Api = (typeof name === 'string') ? api[name] : name;
		if (!Api)
			throw new Error('no template api found with : ' + name);
		for (var i in Api)
			this[i] = Api[i];
		return this;
	},
	// mount template as container here
	mountHere: function(templ) {
		return this.exec('mountHere', [templ]);
	},
	// conditionnal client/server template execution
	client: function(templ) {
		templ = (!templ.__yTemplate__) ? y().use(templ) : templ;
		return this.exec('client', [templ]);
	},
	server: function(templ) {
		templ = (!templ.__yTemplate__) ? y().use(templ) : templ;
		return this.exec('server', [templ]);
	},
	// suspend render until xpr could be evaluated to true
	suspendUntil: function(xpr) {
		return this.exec('suspendUntil', [interpolable(xpr), this._queue.length + 1, this], true);
	},
	//______ DOM ONLY
	// add container witness
	addWitness: function(title) {
		return this.dom(function(context, node, args, container) {
			node.addWitness(title);
		});
	},
	log: function(message) {
		return this.exec('log', [message]);
	}
};

Template.addAPI = function(api) {
	for (var i in api)
		Template.prototype[i] = api[i];
	return Template;
};

Template.prototype.cl = Template.prototype.setClass;

// HTML5 tag list
['div', 'span', 'ul', 'li', 'button', 'p', 'form', 'table', 'tr', 'td', 'th', 'section', 'code', 'pre', 'q', 'blockquote', 'style', 'nav', 'article', 'header', 'footer', 'aside', 'label', 'option']
.forEach(function(tag) {
	Template.prototype[tag] = function() {
		var args = argToArr(arguments);
		args.unshift(tag);
		return this.tag.apply(this, args);
	};
});

// Dom Events list
['click', 'blur', 'focus', 'submit', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'touchcancel', 'touchleave', 'touchmove']
.forEach(function(eventName, preventDefault) {
	Template.prototype[eventName] = function(handler, useCapture) {
		if (typeof handler === 'string')
			handler = listenerParser.parseListener(handler);
		return this.dom(function(context, node, args, container) {
			node.addEventListener(eventName, function(e) {
				if (preventDefault)
					e.preventDefault();
				e.targetContainer = container;
				e.context = context;
				handler.call(context, e);
			}, useCapture);
		});
	};
});

Template.prototype.clickToAgora = function() {
	var argus = arguments;
	return this.dom(function(context, node, args, container) {
		node.addEventListener('click', function(e) {
			if (node.tagName === 'A')
				e.preventDefault();
			e.targetContainer = container;
			e.context = context;
			context.toAgora.apply(context, argus);
		});
	});
}

module.exports = Template;

},{"./api":5,"./context":7,"./interpolable":10,"./parsers/listener-call":17,"./utils":22}],22:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var utils = module.exports = {
	destroyChildren: function(node, removeFromParent) {
		if (!node.childNodes)
			return;
		var childNodes = node.childNodes;
		if (removeFromParent)
			childNodes = [].slice.call(childNodes);
		for (var i = 0; i < childNodes.length; i++)
			utils.destroyElement(childNodes[i], removeFromParent);
	},
	destroyElement: function(node, removeFromParent) {
		if (node.context) {
			node.context.destroy();
			node.context = null;
		}

		if (node.__yContainer__) {
			if (node.childNodes)
				utils.destroyChildren(node, removeFromParent);
		} else {
			if (removeFromParent && node.parentNode)
				node.parentNode.removeChild(node);
			if (node.nodeType !== 3)
				utils.destroyChildren(node);
		}
		if (node.binds) {
			for (var i = 0, len = node.binds.length; i < len; i++)
				node.binds[i]();
			node.binds = null;
		}
	},
	emptyNode: function(node) {
		if (!node.childNodes || !node.childNodes.length)
			return;
		for (var i = 0, len = node.childNodes.length; i < len; ++i) {
			var child = node.childNodes[i];
			if (child.parent)
				child.parent.removeChild(child);
		}
	},
	hide: function(node) {
		if (node.__yContainer__)
			return node.hide();
		if (node.style)
			node.style.display = 'none';
		return node;
	},
	show: function(node) {
		if (node.__yContainer__)
			return node.show();
		if (node.style)
			node.style.display = '';
		return node;
	},
	insertBefore: function(parent, node, ref) {
		if (node.__yContainer__) {
			if (node.childNodes)
				for (var i = 0, len = node.childNodes.length; i < len; ++i)
					utils.insertBefore(parent, node.childNodes[i], ref);
		} else
			parent.insertBefore(node, ref);
	},
	/**
	 * parse api method reference as "apiname:mywidget"
	 * @param  {[type]} env  [description]
	 * @param  {[type]} path [description]
	 * @return {[type]}      [description]
	 */
	getApiMethod: function(api, path) {
		if (!path.forEach)
			path = path.split(':');
		if (path.length !== 2)
			throw new Error('yamvish method call badly formatted : ' + path.join(':'));
		if (!api[path[0]])
			throw new Error('no api found with "' + path.join(':') + '"');
		var output = api[path[0]][path[1]];
		if (!output)
			throw new Error('no template/container found with "' + path.join(':') + '"');
		return output;
	},
	toBinds: function(node, func) {
		node.binds = nodes.binds || [];
		node.binds.push(func);
	},
	castNodeValueTo: function(node, type) {
		switch (type) {
			case 'text':
				return node.textContent;
			case 'integer':
				return parseInt(node.textContent, 10);
			case 'html':
				return node.innerHTML;
			default:
				throw new Error('content editable casting fail : unrecognised rule : ', type);
		}
	}
};

var objectUtils = require('nomocas-utils/lib/object-utils');
for (var i in objectUtils)
	utils[i] = objectUtils[i];

},{"nomocas-utils/lib/object-utils":3}]},{},[4])(4)
});