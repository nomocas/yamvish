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
// core
var y = function(t) {
	return new y.Template(t);
};

y.env = require('./lib/env');
y.utils = require('./lib/utils');
y.Context = require('./lib/context');
y.Template = require('./lib/template');
y.PureNode = require('./lib/pure-node');
y.Container = require('./lib/container');
y.Filter = require('./lib/filter');
y.AsyncManager = require('./lib/async');
var interpolable = require('./lib/interpolable');
y.interpolable = interpolable.interpolable;
y.Interpolable = interpolable.Interpolable;
y.addCustomTag = require('./lib/custom-tags');
y.listenerParser = require('./lib/parsers/listener-call');
y.elenpi = require('elenpi');
y.api = require('./lib/api');
require('./lib/output-engine/dom');

y.View = require('./lib/view');
y.view = function(data, parent, path) {
	return new y.View(data, parent, path);
};
y.html = require('./lib/parsers/html-string-to-template');

module.exports = y;


/*
	Polyfills for IE9: 

	es6-promise or promis
	history API if router 

 */

},{"./lib/api":3,"./lib/async":4,"./lib/container":5,"./lib/context":6,"./lib/custom-tags":7,"./lib/env":9,"./lib/filter":10,"./lib/interpolable":11,"./lib/output-engine/dom":12,"./lib/parsers/html-string-to-template":13,"./lib/parsers/listener-call":14,"./lib/pure-node":18,"./lib/template":19,"./lib/utils":20,"./lib/view":21,"elenpi":1}],3:[function(require,module,exports){
// simple global object where store apis
module.exports = {};

},{}],4:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var Emitter = require('./emitter'),
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
		list[j](args);
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
		if (this.parent && this.parent.waiting)
			this.parent.waiting(promise);
		return promise.then(function(s) {
			remove(self);
			return s;
		}, function(e) {
			if (self.env && self.env.data.debug)
				console.error('async waiting error : ', e);
			self._async.errors.push(e);
			remove(self);
			throw e;
		});
	},
	delay: function(func, ms) {
		this._async.count++;
		if (this.parent && this.parent.delay)
			this.parent.delay(null, ms);
		return setTimeout(delayEnd, ms, func, this);
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

},{"./emitter":8,"./utils":20}],5:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var utils = require('./utils'),
	PureNode = require('./pure-node'),
	Emitter = require('./emitter');

/**
 * Container Container
 */
function Container(parent) {
	PureNode.call(this);
	this.__yContainer__ = true;
	this.childNodes = [];
	if (parent)
		this.parent = parent;
};

Container.prototype  = {
	/**
	 * mount container in selector
	 * @param  {[type]} selector [description]
	 * @param  {[type]} mode     could be : null, appendTo, insertBefore
	 * @return {[type]}          [description]
	 */
	mount: function(selector, mode) {
		if (this.destroyed)
			throw new Error('yamvish container has been destroyed. could not mount anymore.');
		if (selector && (selector === this.mountPoint || selector === this.mountSelector))
			return this;
		var node = selector;
		if (typeof node === 'string') {
			this.mountSelector = selector;
			node = utils.domQuery(selector);
		}
		if (!node)
			throw new Error('yamvish : mount point not found : ' + selector);

		if (mode === 'insertBefore') {
			this.mountPoint = node.parentNode;
			if (!this.mountPoint)
				throw new Error('container mount fail : no parent found for insertBefore');
			this.mountSelector = null;
			utils.mountChildren(this, this.mountPoint, node);
		} else {
			this.mountPoint = node;
			// console.log('Container.mount : ', this, selector);
			if (!mode && node.childNodes && node.childNodes.length) // mount as innerHTML : empty node before appending
				utils.emptyNode(node);

			utils.mountChildren(this, node);
		}

		return this.emit('mounted', this);
	},
	mountBefore: function(nextSiblingSelector) {
		return this.mount(nextSiblingSelector, 'insertBefore');
	},
	appendTo: function(selector) {
		return this.mount(selector, 'append');
	},
	unmount: function() {
		if (!this.mountPoint)
			return this;
		for (var i = 0; i < this.childNodes.length; i++)
			this.mountPoint.removeChild(this.childNodes[i]);
		this.mountPoint = null;
		this.mountSelector = null;
		return this.emit('unmounted', this);
	},
	destroyer: function() {
		var self = this;
		return function() {
			self.destroy();
		};
	},
	destroy: function() {
		// console.log('Container destroy :', this);
		if (this.destroyed)
			throw new Error('yamvish container has been destroyed. could not mount anymore.');
		this.emit('destroy', this);
		if (this.binds) {
			for (var i = 0, len = this.binds.length; i < len; i++)
				this.binds[i]();
			this.binds = null;
		}
		this.destroyed = true;
		if (this.childNodes)
			for (var i = 0; i < this.childNodes.length; i++)
				utils.destroyElement(this.childNodes[i], true);
		this.childNodes = null;
		this.context = null;
		this.mountPoint = null;
		this.mountSelector = null;
	},
	hide: function() {
		if (this.destroyed)
			return this;
		this.childNodes.forEach(function(child) {
			if (!child.style)
				child.style = {};
			child.style.display = 'none';
		});
	},
	show: function() {
		if (this.destroyed)
			return this;
		this.childNodes.forEach(function(child) {
			if (child.style)
				child.style.display = '';
		});
	}
};

utils.shallowMerge(PureNode.prototype, Container.prototype);
utils.shallowMerge(Emitter.prototype, Container.prototype);

Container.prototype.appendChild = function(child, nextSibling) {
	PureNode.prototype.appendChild.call(this, child);
	if (this.mountPoint) {
		nextSibling = nextSibling || utils.findNextSibling(this);
		if (child.__yPureNode__ && !child.__yVirtual__)
			utils.mountChildren(child, this.mountPoint, nextSibling);
		else if (nextSibling)
			this.mountPoint.insertBefore(child, nextSibling);
		else
			this.mountPoint.appendChild(child);
	}
	return child;
};
Container.prototype.removeChild = function(child) {
	if (!this.childNodes)
		return false;
	PureNode.prototype.removeChild.call(this, child);
	if (this.mountPoint)
		utils.removeChild(this.mountPoint, child);
	return child;
};
Container.prototype.insertBefore = function(child, ref) {
	if (!this.childNodes)
		return false;
	PureNode.prototype.insertBefore.call(this, child, ref);
	if (this.mountPoint)
		utils.insertBefore(this.mountPoint, child, ref);
	return child;
};

module.exports = Container;

},{"./emitter":8,"./pure-node":18,"./utils":20}],6:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

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
			}, false, this.binds)
		}
	} else
		this.env = env ? new Context(env) : Context.env;
}

function unsub(context, path, fn, upstream) {
	return function() {
		if (!context.destroyed)
			context.unsubscribe(path, fn, upstream);
	};
}

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
	dependent: function(path, dependencies, func) {
		var argsOutput = [],
			willFire,
			self = this,
			count = 0;
		this.binds = this.binds ||  [];
		dependencies.forEach(function(dependency) {
			argsOutput.push(self.get(dependency));
			// subscribe to arguments[i]
			var index = count++; // localise var in scope for local func closure below
			self.subscribe(dependency, function(value, type, p, key) {
				argsOutput[index] = value;
				if (!willFire)
					willFire = self.delay(function() {
						if (willFire) {
							willFire = null;
							self.set(path, func.apply(self, argsOutput));
						}
					}, 0);
			}, false, this.binds);
		});
		this.set(path, func.apply(this, argsOutput));
		return this;
	},
	reset: function(data) {
		if (data === this.data || (this.data instanceof Date && data instanceof Date && this.data.valueOf() === data.valueOf()))
			return this;
		this.data = data || {};
		this.notifyAll('reset', null, this.map, data, '*');
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
	set: function(path, value) {
		if (!path.forEach)
			path = path.split('.');
		switch (path[0]) {
			case '$this':
				if (path.length === 1)
					return this.reset(value);
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
			if (old instanceof Date && value instanceof Date && old.valueOf() === value.valueOf())
				return this;
			this.notify('set', path, value, path[path.length - 1]);
		}
		return this;
	},
	push: function(path, value) {
		if (!path.forEach)
			path = path.split('.');

		if (path[0] == '$parent') {
			if (this.parent)
				return this.parent.push(path.slice(1), value) && this;
			throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
		} else if (path[0] === '$env')
			return this.env.push(path.slice(1), value) && this;
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
				return this.parent.del(path.slice(1)) && this;
			throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
		} else if (path[0] == '$env')
			return this.env.del(path.slice(1)) && this;
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
		// console.log('context subscribe : ', path, fn, upstream);
		if (!path.forEach)
			path = path.split('.');
		var space;
		if (path[0] === '$this')
			space = this.map;
		else if (path[0] === '$env')
			return this.env.subscribe(path.slice(1), fn, upstream);
		else if (path[0] === '$parent') {
			if (!this.parent)
				throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
			return this.parent.subscribe(path.slice(1), fn, upstream);
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
		if (binds)
			binds.push(unsub(this, path, fn, upstream));
		return this;
	},
	unsubscribe: function(path, fn, upstream) {
		if (this.distroyed)
			return this;
		if (!path.forEach)
			path = path.split('.');
		var space;
		if (path[0] === '$this')
			space = this.map;
		else if (path[0] === '$parent')
			return this.env.unsubscribe(path.slice(1), fn, upstream) && this;
		else if (path[0] === '$parent') {
			if (this.parent)
				return this.parent.unsubscribe(path.slice(1), fn, upstream) && this;
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
				this.notifyAll(type, path, space[j], value ? value[j] : undefined, index);
			}
		return this;
	},
	notify: function(type, path, value, index) {
		if (!path.forEach)
			path = path.split('.');
		if (path[0] === '$this')
			path = path.slice(1);
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
		var func = function() {
			handler.apply(self, arguments);
		};
		agora.on(messageName, func);
		(this.binds = this.binds ||  []).push(function() {
			agora.off(messageName, func);
		});
		return this;
	},
	toAgora: function(name) {
		var args = [name].concat([].slice.call(arguments, 1))
		this.env.data.agora.emit.apply(this.env.data.agora, args);
		return this;
	}
};

Context.env = new Context(env);
delete Context.env.env;

utils.shallowMerge(AsyncManager.prototype, Context.prototype);

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

module.exports = Context;

},{"./async":4,"./env":9,"./utils":20}],7:[function(require,module,exports){
var Template = require('./template'),
	api = require('./api'),
	Context = require('./context');
/**
 * use current customTag content
 * @return {[type]} [description]
 */
Template.prototype.__yield = function() {
	return this.exec({
		dom: function(context) {
			var templ = context.data.opts && context.data.opts.__yield;
			if (!templ)
				return;
			return templ.call(this, context);
		},
		string: function(context, descriptor) {
			var templ = context.data.opts && context.data.opts.__yield;
			if (!templ)
				return;
			descriptor.children += templ.toHTMLString(context);
		}
	});
};

var customTagEngine = {
	dom: function(context, args) {
		var ctx = new Context({
			opts: args[0]
		}, context);
		var ctr = args[1].toContainer(ctx).appendTo(this);
		ctr.context = ctx;
	},
	string: function(context, descriptor, args) {
		descriptor.children += args[1].toHTMLString(new Context({
			opts: args[0]
		}, context));
	},
	twopass: {
		first: function(context, args) {
			(context.children = context.children || []).push(new Context({
				opts: args[0]
			}, context));
		},
		second: function(context, descriptor, args) {
			descriptor.children += args[1].toHTMLString(context.children.shift());
		}
	}
};

/**
 * addCustomTag in specified api.
 * @param {[type]} apiName        [description]
 * @param {[type]} tagName        [description]
 * @param {[type]} defaultAttrMap [description]
 * @param {[type]} templ          [description]
 */
module.exports = function(apiName, tagName, defaultAttrMap, templ) {
	var space = api[apiName] = api[apiName] || {};
	space[tagName] = function(attrMap, __yield) {
		// copy default to attrMap
		for (var i in defaultAttrMap)
			if (typeof attrMap[i] === 'undefined')
				attrMap[i] = defaultAttrMap[i];
		attrMap.__yield = __yield;
		return this.exec(customTagEngine, [attrMap, templ]);
	}
	return this;
};

},{"./api":3,"./context":6,"./template":19}],8:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

/**
 * Event Emitter
 * 
 * Directly inspired from : https://github.com/jeromeetienne/microevent.js
 * Just remove mixins + add .once()
 */

var Emitter = function() {}
Emitter.prototype = {
	on: function(event, fct) {
		event = (typeof event === 'object' ? event.type : event);
		this._events = this._events || {};
		(this._events[event] = this._events[event] || []).push(fct);
		return this;
	},
	off: function(event, fct) {
		event = (typeof event === 'object' ? event.type : event);
		if (!this._events || (event in this._events === false))
			return this;
		this._events[event].splice(this._events[event].indexOf(fct), 1);
		return this;
	},
	once: function(event, func) {
		var self = this;
		this._events = this._events || {};
		(this._events[event] = this._events[event] || []).push(function(evt) {
			self.off(event, func);
			func.call(this, evt);
		});
		return this;
	},
	emit: function(event /* , args... */ ) {
		event = (typeof event === 'object' ? event.type : event);
		if (!this._events || (event in this._events === false))
			return this;
		for (var i = 0; i < this._events[event].length; i++)
			this._events[event][i].apply(this, [].slice.call(arguments, 1));
		return this;
	}
};
module.exports = Emitter;

},{}],9:[function(require,module,exports){
(function (global){
var isServer = (typeof window === 'undefined') && (typeof document === 'undefined'),
	Emitter = require('./emitter');
var env = {
	isServer: isServer,
	debug: true,
	expressionsGlobal: isServer ? global : window,
	factory: isServer ? null : document,
	agora: new Emitter(),
	clone: function(newAgora) {
		var cloned = {};
		for (var i in this) {
			if (i === agora && newAgora) {
				cloned.agora = new Emitter();
				continue;
			}
			cloned[i] = this[i];
		}
	}
};

module.exports = env;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./emitter":8}],10:[function(require,module,exports){
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

},{}],11:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var Filter = require('./filter'),
	replacementRegExp = /true|false|null|\$\.(?:[a-zA-Z]\w*(?:\.\w*)*)|\$(?:[a-zA-Z]\w*(?:\.\w*)*)\(?|"[^"]*"|'[^']*'|[a-zA-Z_]\w*(?:\.\w*)*\(?/g,
	splitRegEx = /\{\{\s*(.+?)((?:(?:\s\|\s)(.+?))?)\s*\}\}/,
	cacheFull = {},
	cacheXpr = {};

function tryExpr(func, context) {
	try {
		return func.call(context.data, context, context.env.data.expressionsGlobal);
	} catch (e) {
		console.error(e);
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
	var dep = [];
	expr = expr.replace(replacementRegExp, function(whole) {
		if (whole == 'true' || whole == 'false' ||  whole == 'null')
			return whole;
		switch (whole[0]) {
			case '"':
			case "'":
				return whole;
			case '$':
				if (whole[1] === '.')
					return '__global' + whole.substring(1);
				// else do default case
			default:
				if (whole[whole.length - 1] === '(') {
					var wholePath = whole.substring(0, whole.length - 1);
					dep.push(wholePath);
					var splitted = wholePath.split('.'),
						last;
					if (splitted.length > 1)
						last = splitted.pop();
					return '__context.get(["' + splitted.join('","') + '"])' + (last ? ('.' + last) : '') + '(';
				} else {
					dep.push(whole);
					return '__context.get(["' + whole.split('.').join('","') + '"])';
				}
		}
	});
	// console.log('xpr parsing res : ', expr);
	dependencies.push.apply(dependencies, dep);

	var func = new Function("__context", "__global", "return " + expr + ";");
	if (!filter) {
		cacheXpr[total] = {
			func: func,
			dependencies: dep
		};
		return func;
	}
	// produce filter 
	var fltr = new Function('Filter', 'return new Filter().' + filter)(Filter);
	// wrap expr func with filter
	var f = cacheXpr[total] = function(context, global) {
		return fltr.call(this, func.call(this, context, global));
	};
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
			instance.willFire = context.delay(function() { // allow small time to manage other dependencies update without multiple rerender
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
var Interpolable = function(splitted, strict) {
	// console.log('Interpolabe : splitted : ', splitted);
	this.__interpolable__ = true;
	this._strict = strict || false;
	var dp;
	if (splitted.length === 5 && splitted[0] === "" && splitted[4] === "")
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
			func: compileExpression(splitted[i], splitted[i + 2], dp),
			dep: dp
		});
		i += 2;
		this.dependenciesCount += dp.length;
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
		var count = 0;
		for (var i = 1, len = this.parts.length; i < len; i = i + 2) {
			var h = handler(instance, context, this.parts[i].func, count, callback),
				dep = this.parts[i].dep;
			count++;
			for (var j = 0, lenJ = dep.length; j < lenJ; j++)
				context.subscribe(dep[j], h, false, instance.binds)
		}
		if (binds)
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
		return cacheFull[string] = new Interpolable(splitted, strict);
	},
	Interpolable: Interpolable
};

},{"./filter":10}],12:[function(require,module,exports){
var utils = require('../utils'),
	PureNode = require('../pure-node'),
	Container = require('../container'),
	Context = require('../context'),
	Template = require('../template'),
	View = require('../view');

function eachPush(value, context, container, template) {
	var ctx = new Context(value, context),
		child = new PureNode();
	child.context = ctx;
	container.appendChild(child);
	template.call(child, ctx, container);
	return child;
}

var engine = {
	//_________________________________ local context management
	context: function(context, node, args) {
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
		if (value.__interpolable__) {
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
				utils.setClass(node, classValue);
			else
				utils.removeClass(node, classValue);
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
	//_________________________________ conditional rendering
	if: function(context, node, args) {
		var condition = args[0],
			successTempl = args[1],
			failTempl = args[2],
			fakeNode = utils.hide(context.env.data.factory.createElement('div')),
			successContainer,
			failContainer,
			current,
			ok;
		node.binds = node.binds || [];
		var exec = function(ok, type, path) {
			var nextSibling = null; // for browser compliance we need to force null  https://bugzilla.mozilla.org/show_bug.cgi?id=119489
			if (current) {
				nextSibling = utils.findNextSibling(current);
				if (current.unmount)
					current.unmount();
				else
					node.removeChild(current);
			}
			if (ok) {
				current = successContainer;
				if (!current) {
					current = successContainer = successTempl.toContainer(node.context || context);
					node.binds.push(current.destroyer());
				}
			} else if (failTempl) {
				current = failContainer;
				if (!current) {
					current = failContainer = failTempl.toContainer(node.context || context);
					node.binds.push(current.destroyer());
				};
			} else
				current = fakeNode;

			if (!current.__yContainer__)
				node.insertBefore(current, nextSibling);
			else if (nextSibling)
				current.mountBefore(nextSibling);
			else
				current.appendTo(node);
		};
		if (condition && condition.__interpolable__) {
			ok = condition.output(context);
			node.binds = node.binds || [];
			condition.subscribeTo(context, exec, node.binds);
		} else if (typeof condition === 'function')
			ok = condition.call(node, context);
		exec(ok, 'set');
	},
	//______________________________________________ EACH
	each: function(context, node, args) {
		var path = args[0],
			template = args[1],
			emptyTempl = args[2],
			container = new PureNode(),
			emptyContainer,
			current,
			fakeNode = context.env.data.factory.createElement('div'),
			isPureNode = node.__yPureNode__ && !node.__yVirtual;
		container.childNodes = [];
		utils.hide(fakeNode);
		node.appendChild(fakeNode);
		current = fakeNode;
		node.binds = node.binds || []; //.push(container.destroyer());

		var setEmpty = function(nextSibling) {
			if (current === container)
				node.removeChild(container);
			if (emptyTempl) {
				if (current === emptyContainer)
					return;
				current = emptyContainer;
				if (!current) {
					current = emptyContainer = emptyTempl.toContainer(node.context ||  context);
					node.binds.push(current.destroyer());
				}
				if (nextSibling)
					emptyContainer.mountBefore(nextSibling);
				else
					emptyContainer.appendTo(node);
			} else if (current !== fakeNode)
				current = node.insertBefore(fakeNode, nextSibling);
		};

		var setFilled = function(nextSibling) {
			if (current !== container) {
				if (current === emptyContainer)
					emptyContainer.unmount();
				else if (current === fakeNode)
					node.removeChild(fakeNode);
				current = container;
				node.insertBefore(container, nextSibling);
			}
		};

		var update = function(value, type, path, index) {
			switch (type) {

				case 'reset':
				case 'set':
					if (!node.__yPureNode__ || node.mountPoint)
						utils.hide(node.mountPoint || node);

					var nextSibling = utils.findNextSibling(current);
					if (!value.length)
						setEmpty(nextSibling);
					else
						setFilled(nextSibling);

					var j = 0;
					for (var len = value.length; j < len; ++j) // reset existing or create new node 
						if (container.childNodes[j]) // reset existing
							container.childNodes[j].context.reset(value[j]);
						else { // create new node
							var child = eachPush(value[j], node.context || context, container, template);
							if (!isPureNode || node.mountPoint)
								utils.mountChildren(child, node.mountPoint || node, nextSibling);
						}
						// delete additional nodes that is not used any more
					if (j < container.childNodes.length) {
						var lenJ = container.childNodes.length;
						while (container.childNodes[j])
							utils.destroyElement(container.childNodes[j], true);
					}
					if (!node.__yPureNode__ || node.mountPoint)
						utils.show(node.mountPoint || node);
					break;

				case 'removeAt':
					var nextSibling = utils.findNextSibling(current);
					utils.destroyElement(container.childNodes[index], true);
					if (!container.childNodes.length)
						setEmpty(nextSibling);
					break;

				case 'push':
					var nextSibling = utils.findNextSibling(current),
						child = eachPush(value, node.context || context, container, template);
					setFilled(nextSibling);
					if (!isPureNode || node.mountPoint)
						utils.mountChildren(child, node.mountPoint || node, nextSibling);
					break;
			}
		};
		var data = path;
		if (typeof path === 'string') {
			context.subscribe(path, update, false, node.binds);
			context.subscribe(path + '.*', function(value, type, path, key) {
				var node = container.childNodes[key];
				if (node)
					return node.context.reset(value);
			}, false, node.binds);
			data = context.get(path);
		}
		if (data)
			update(data, 'set');
	},
	//________________________________________________ MISC
	switch: function(context, node, args) {
		var current,
			xpr = args[0],
			dico = utils.shallowCopy(args[1]);
		if (!dico['default'])
			dico['default'] = utils.hide(context.env.data.factory.createElement('div'));
		node.binds = node.binds || [];
		var valueUpdate = function(value, type, path) {
			var templ = dico[String(value)],
				nextSibling = utils.findNextSibling(current);
			if (!templ) {
				templ = dico['default'];
				value = 'default';
			}
			if (current) {
				if (current.unmount)
					current.unmount();
				else
					node.removeChild(current);
			}
			current = templ;
			if (current.__yTemplate__) {
				current = dico[value] = templ.toContainer(context).mountBefore(nextSibling);
				node.binds.push(current.destroyer());
			}
			if (!current.__yContainer__)
				node.insertBefore(current, nextSibling);
			else if (nextSibling)
				current.mountBefore(nextSibling);
			else
				current.appendTo(node);
		};
		xpr.subscribeTo(context, valueUpdate, node.binds);
		valueUpdate(xpr.output(context), 'set');
	},
	mountHere: function(context, node, args) {
		(node.binds = node.binds || []).push(args[0].toContainer(context).mount(node).destroyer());
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
		nextIndex = 0,
		f;
	while (handler) {
		if (handler.engineBlock)
			f = handler.engineBlock.dom;
		else
			f = handler.func || engine[handler.name];
		f(node.context || context, node, handler.args);
		if (handler.suspendAfter)
			break;
		handler = queue[++nextIndex];
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
	this.toContainer(context).mount(node);
};

module.exports = engine;

},{"../container":5,"../context":6,"../pure-node":18,"../template":19,"../utils":20,"../view":21}],13:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var elenpi = require('elenpi'),
	r = elenpi.r,
	Parser = elenpi.Parser,
	Template = require('../template'),
	expression = require('./string-to-template');

var rules = {
	// HTML 5 common rules
	// html5 unstrict self closing tags : 
	openTags: require('./open-tags'),

	document: r()
		.zeroOrMore(null, r().space().rule('comment'))
		.regExp(/^\s*<!DOCTYPE[^>]*>\s*/i, true)
		.rule('children')
		.space(),

	comment: r().regExp(/^<!--(?:.|\n|\r)*?(?=-->)-->/),

	tagEnd: r()
		// closing tag
		.regExp(/^\s*<\/([\w-_]+)\s*>/, false, function(descriptor, cap) {
			if (descriptor.tagName !== cap[1].toLowerCase())
				throw new Error('tag badly closed : ' + cap[1] + ' - (at opening : ' + descriptor.tagName + ')');
		}),

	innerScript: r()
		.done(function(string, descriptor) {
			var index = string.indexOf('</script>');
			if (index === -1)
				throw new Error('script tag badly closed.');
			if (index)
				descriptor.scriptContent = string.substring(0, index);
			return string.substring(index + 9);
		}),
	// END common rules

	// tag children
	children: r()
		.zeroOrMore(null,
			r().oneOf([
				r().space().rule('comment').skip(),
				r().space().rule('tag'),
				r().rule('text')
			])
		),

	text: r().regExp(/^[^<]+/, false, function(descriptor, cap) {
		descriptor.text(cap[0]);
	}),

	tag: r()
		// 
		.regExp(/^<([\w-_]+)\s*/, false, function(descriptor, cap) {
			descriptor.tagName = cap[1].toLowerCase();
		})
		// 	.done(function(string, descriptor) {
		// 		switch (descriptor.tagName) {
		// 			case 'if': // <if {{  }}>  attr:   {{ xpr }}
		// 				break;
		// 			case 'each':
		// 				break;
		// 			case 'with':
		// 				break;
		// 			case 'client':
		// 				break;
		// 			case 'server':
		// 				break;
		// 			default:
		// 				// test custom tags

	// 				// else : normal tag
	// 		}
	// 	}),

	// normalTag: r()
		.done(function(string, descriptor) {
			descriptor._attributesTemplate = new Template();
			return this.exec(string, descriptor._attributesTemplate, this.rules.attributes);
		})
		.oneOf([
			r().char('>')
			.done(function(string, descriptor) {
				// check html5 unstrict self-closing tags
				if (this.rules.openTags.test(descriptor.tagName))
					return string; // no children

				if (descriptor.tagName === 'script') // get script content
					return this.exec(string, descriptor, this.rules.innerScript);

				// get inner tag content
				descriptor._innerTemplate = new Template();
				var ok = this.exec(string, descriptor._innerTemplate, this.rules.children);
				if (ok === false)
					return false;
				// close tag
				return this.exec(ok, descriptor, this.rules.tagEnd);
			}),
			// strict self closed tag
			r().regExp(/^\/>/)
		])
		.done(function(string, descriptor) {
			var innerTemplate = descriptor._innerTemplate,
				attributesTemplate = descriptor._attributesTemplate;
			if (innerTemplate)
				attributesTemplate._queue = attributesTemplate._queue.concat(innerTemplate._queue);
			descriptor.tag(descriptor.tagName, attributesTemplate);
			descriptor._attributesTemplate = null;
			descriptor._innerTemplate = null;
			descriptor.tagName = null;
			return string;
		}),

	attributes: r().zeroOrMore(null,
		// attrName | attrName="... ..." | attrName=something
		r().regExp(/^([\w-_]+)\s*(?:=(?:"([^"]*)"|([\w-_]+)))?\s*/, false, function(descriptor, cap) {
			var attrName = cap[1],
				value = (cap[2] !== undefined) ? cap[2] : ((cap[3] !== undefined) ? cap[3] : '');

			switch (attrName) {
				case 'class':
					if (!value)
						break;
					value.split(/\s+/).forEach(function(cl) {
						descriptor.setClass(cl);
					});
					break;
				case 'data-template':
					if (!value)
						break;
					var template = expression.parseTemplate(value);
					if (template !== false)
						descriptor._queue = descriptor._queue.concat(template._queue);
					else
						throw new Error('data-template attribute parsing failed : ' + value);
					break;
					// case 'style':
				default:
					descriptor.attr(attrName, value);
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

},{"../template":19,"./open-tags":15,"./string-to-template":17,"elenpi":1}],14:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

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

},{"./primitive-argument-rules":16,"elenpi":1}],15:[function(require,module,exports){
module.exports = /(br|input|img|area|base|col|command|embed|hr|img|input|keygen|link|meta|param|source|track|wbr)/;

},{}],16:[function(require,module,exports){
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

},{"elenpi":1}],17:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

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

},{"../template":19,"./primitive-argument-rules":16,"elenpi":1}],18:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
/**
 * Pure Virtual Node
 */
function PureNode() {
	this.__yPureNode__ = true;
}

PureNode.prototype  = {
	insertBefore: function(toInsert, o) {
		if (!o) {
			(this.childNodes = this.childNodes || []).push(toInsert);
			return toInsert;
		}
		if (!this.childNodes)
			throw new Error('node was not found : ' + o.toString());
		var index = this.childNodes.indexOf(o);
		if (index == -1)
			throw new Error('node was not found : ' + o.toString());
		if (index == 0)
			this.childNodes.unshift(toInsert);
		else
			this.childNodes.splice(index, 0, toInsert);
		return toInsert;
	},
	appendChild: function(child) {
		this.childNodes = this.childNodes || [];
		this.childNodes.push(child);
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

},{}],19:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
"use strict";

var utils = require('./utils'),
	interpolable = require('./interpolable').interpolable,
	Context = require('./context'),
	api = require('./api'),
	listenerParser = require('./parsers/listener-call');

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
	var t = y();
	for (var i in attrMap) {
		switch (i) {
			case 'style':
				t.use(parseMap(attrMap[i], 'css'));
				break;
			case 'classes':
				t.use(parseMap(attrMap[i], 'cl'));
				break;
			case 'value':
				t.val(attrMap[i]);
				break;
			case 'disabled':
				t.disabled(attrMap[i]);
				break;
			case 'visible':
				t.visible(attrMap[i]);
				break;
			default: // attr
				t.attr(i, attrMap[i]);
		}
	}
	return t;
};
utils.parseAttrMap = parseAttrMap;
Template.prototype = {
	exec: function(name, args, firstPass, suspendAfter) {
		var type = typeof name;
		this._queue.push({
			func: (type === 'function') ? name : null,
			engineBlock: (type === 'object') ? name : null,
			name: (type === 'string') ? name : null,
			args: args,
			firstPass: firstPass,
			suspendAfter: suspendAfter
		});
		return this;
	},
	//________________________________ CONTEXT and Assignation
	set: function(path, value) {
		return this.exec(function(context) {
			context.set(path, value);
		}, null, true);
	},
	setAsync: function(path, value) {
		return this.exec(function(context) {
			context.setAsync(path, value);
		}, null, true);
	},
	dependent: function(path, args, func) {
		return this.exec(function(context) {
			context.dependent(path, args, func);
		}, null, true);
	},
	push: function(path, value) {
		return this.exec(function(context) {
			context.push(path, value);
		}, null, true);
	},
	pushAsync: function(path, value) {
		return this.exec(function(context) {
			context.pushAsync(path, value);
		}, null, true);
	},
	toggle: function(path) {
		return this.exec(function(context) {
			context.toggle(path);
		}, null, true);
	},
	toggleInArray: function(path) {
		return this.exec(function(context) {
			context.toggleInArray(path);
		}, null, true);
	},
	del: function(path) {
		return this.exec(function(context) {
			context.del(path);
		}, null, true);
	},
	context: function(data, parent, path) {
		var path;
		if (typeof data === 'string') {
			path = data;
			data = null;
		}
		return this.exec('context', [path ? undefined : data, parent, path], true);
	},
	with: function(path, template) {
		return this.exec('with', [path, template], true);
	},
	subscribe: function(path, handler, upstream) {
		return this.exec(function(context) {
			context.subscribe(path, handler, upstream);
		}, null, true);
	},
	unsubscribe: function(path, handler, upstream) {
		return this.exec(function(context) {
			context.unsubscribe(path, handler, upstream);
		}, null, true);
	},
	//__________________________________ Agora
	onAgora: function(name, handler) {
		return this.exec(function(context) {
			context.onAgora(name, handler);
		}, null, true);
	},
	offAgora: function(name, handler) {
		return this.exec(function(context) {
			context.offAgora(name, handler);
		}, null, true);
	},
	toAgora: function(name, msg) {
		return this.exec(function(context) {
			context.toAgora(name, msg);
		}, null, true);
	},
	//__________________________________ Attributes
	attr: function(name, value) {
		return this.exec('attr', [name, interpolable(value)]);
	},
	disabled: function(xpr) {
		return this.exec('disabled', [interpolable(xpr)]);
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
		return this.exec('val', [varPath, value]);
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
			hasAttrMap = (attrMap && typeof attrMap === 'object' && !attrMap.__yTemplate__) ? attrMap : null;
		if (hasAttrMap)
			t = parseAttrMap(attrMap);
		else
			t = y();
		// still to convert string arguments to .text(...)
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
	br: function() {
		return this.exec('br');
	},
	a: function(href) {
		var args = argToArr(arguments, 1);
		args.unshift('a', typeof href === 'string' ? y().attr('href', href) : href);
		return this.tag.apply(this, args);
	},
	img: function(href) {
		var args = argToArr(arguments, 1);
		args.unshift('img', typeof href === 'string' ? y().attr('src', href) : href);
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
	//___________________________________ EVENTS LISTENER
	on: function(name, handler) {
		if (typeof handler === 'string')
			handler = listenerParser.parseListener(handler);
		return this.exec('on', [name, handler]);
	},
	off: function(name, handler) {
		return this.exec('off', [name, handler]);
	},
	//___________________________________________ Collection
	each: function(path, templ, emptyTempl) {
		return this.exec('each', [path, templ, emptyTempl]);
	},
	//_____________________________ Conditional node rendering
	if: function(condition, successTempl, failTempl) {
		return this.exec('if', [interpolable(condition), successTempl, failTempl]);
	},
	switch: function(xpr, map) {
		for (var i in map)
			if (typeof map[i] === 'string')
				map[i] = y().text(map[i]);
		return this.exec('contentSwitch', [interpolable(xpr), map]);
	},
	//____________________________________________ MISC
	use: function(name) {
		var args = argToArr(arguments);
		args.shift();
		if (typeof name === 'string')
			name = name.split(':');
		var method = (name.forEach ? utils.getApiMethod(api, name) : name);
		if (method.__yView__)
			return this.exec('mountHere', [method]);
		else if (method.__yTemplate__)
			this._queue = this._queue.concat(method._queue);
		else
			method.apply(this, args);
		return this;
	},
	addApi: function(name) {
		var Api = (typeof name === 'string') ? api[name] : name;
		if (!Api)
			throw new Error('no template api found with : ' + name);
		for (var i in Api) {
			if (!Api.hasOwnProperty(i))
				continue;
			this[i] = Api[i];
		}
		return this;
	},
	mountHere: function(template) {
		return this.exec('mountHere', [template]);
	},
	client: function(templ) {
		return this.exec('client', [templ]);
	},
	server: function(templ) {
		return this.exec('server', [templ]);
	},
	suspendUntil: function(xpr) {
		return this.exec('suspendUntil', [interpolable(xpr), this._queue.length + 1, this], false, true);
	}
};

Template.addAPI = function(api) {
	for (var i in api)
		Template.prototype[i] = api[i];
	return Template;
};

Template.prototype.cl = Template.prototype.setClass;

// Complete tag list
['div', 'span', 'ul', 'li', 'button', 'p', 'form', 'table', 'tr', 'td', 'th', 'section', 'code', 'pre', 'q', 'blockquote', 'style', 'nav', 'article', 'header', 'footer', 'aside']
.forEach(function(tag) {
	Template.prototype[tag] = function() {
		var args = argToArr(arguments);
		args.unshift(tag);
		return this.tag.apply(this, args);
	};
});
// Complete events list
['click', 'blur', 'focus', 'submit']
.forEach(function(eventName) {
	Template.prototype[eventName] = function(handler) {
		return this.on(eventName, handler);
	};
});

module.exports = Template;

},{"./api":3,"./context":6,"./interpolable":11,"./parsers/listener-call":14,"./utils":20}],20:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
//__________________________________________________________ UTILS

function produceError(msg, report) {
	var e = new Error(msg);
	e.report = report;
	return e;
}

//_____________________________ MERGE PROTO



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
	if (node.context)
		node.context.destroy();

	if (removeFromParent && node.parentNode) {
		node.parentNode.removeChild(node);
		node.parentNode = null;
	}

	if (node.__yPureNode__) {
		if (node.__yVirtual__) {
			node.attributes = null;
			node.listeners = null;
			node.classes = null;
			node.style = null;
		}
		if (node.childNodes && node.childNodes.length)
			destroyChildren(node, removeFromParent);
	} else if (node.childNodes && node.childNodes.length)
		destroyChildren(node);

	if (node.binds) {
		for (var i = 0, len = node.binds.length; i < len; i++)
			node.binds[i]();
		node.binds = null;
	}
}

function destroyChildren(node, removeFromParent) {
	if (!node.childNodes)
		return;
	for (var i = 0; i < node.childNodes.length; i++)
		destroyElement(node.childNodes[i], removeFromParent);
}



// DOM/Virtual utils
function mountChildren(node, parent, nextSibling) {
	if (!node.childNodes || !node.__yPureNode__)
		return;
	if (nextSibling) {
		for (var k = 0, len = node.childNodes.length; k < len; ++k) {
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
	return tmp.nextSibling || null;
}

function unmountPureNode(purenode) {
	for (var i = 0, len = purenode.childNodes.length; i < len; ++i) {
		var child = purenode.childNodes[i];
		if (child.__yPureNode__)
			unmountPureNode(child);
		else if (child.parentNode !== purenode)
			child.parentNode.removeChild(child);
	}
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

var utils = module.exports = {
	produceError: produceError,
	destroyElement: destroyElement,
	destroyChildren: destroyChildren,
	setProp: setProp,
	deleteProp: deleteProp,
	getProp: getProp,
	emptyNode: emptyNode,
	unmountPureNode: unmountPureNode,
	mountChildren: mountChildren,
	setClass: setClass,
	removeClass: removeClass,
	findNextSibling: findNextSibling,
	removeChild: function(parent, node) {
		if (node.__yPureNode__ && !node.__yVirtual__) {
			if (node.childNodes)
				for (var i = 0, len = node.childNodes.length; i < len; ++i)
					utils.removeChild(parent, node.childNodes[i]);
		} else if (node.parentNode)
			node.parentNode.removeChild(node);
	},
	insertBefore: function(parent, node, ref) {
		if (node.__yPureNode__ && !node.__yVirtual__) {
			if (node.childNodes)
				for (var i = 0, len = node.childNodes.length; i < len; ++i)
					utils.insertBefore(parent, node.childNodes[i], ref);
		} else
			parent.insertBefore(node, ref);
	},
	hide: function(node) {
		if (node.__yContainer__)
			return node.hide();
		if (!node.style)
			node.style = {};
		node.style.display = 'none';
		return node;
	},
	show: function(node) {
		if (node.__yContainer__)
			return node.show();
		if (!node.style)
			node.style = {};
		node.style.display = '';
		return node;
	},
	domQuery: function(selector) {
		if (selector[0] === '#')
			return document.getElementById(selector.substring(1));
		else
			return document.querySelector(selector);
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
		var output = api[path[0]][path[1]];
		if (!output)
			throw new Error('no template/container found with "' + path.join(':') + '"');
		return output;
	}
};

},{}],21:[function(require,module,exports){
var Template = require('./template');

function View(data, parent, path) {
	this.__yView__ = true;
	Template.call(this);
	this.context(data, parent, path)
		.exec(function(context) {
			context.viewData = {};
		}, null, true)
		.exec(function(context, container) {
			context.viewData.container = container;
		});
};

View.prototype = new Template();

// kill all attributes related metods
['attr', 'css', 'setClass', 'cl', 'visible', 'disabled', 'val']
.forEach(function(method) {
	View.prototype[method] = null;
});

module.exports = View;

},{"./template":19}]},{},[2])(2)
});