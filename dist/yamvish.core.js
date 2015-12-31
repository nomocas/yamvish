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
var interpolable = require('./lib/interpolable');
y.interpolable = interpolable.interpolable;
y.Interpolable = interpolable.Interpolable;
y.Virtual = require('./lib/virtual');
y.addCustomTag = require('./lib/custom-tags');

require('./lib/output-engine/dom');
require('./lib/output-engine/string');


module.exports = y;


/*
	Polyfills for IE8/9: 

	es6-promise or promis

 */

},{"./lib/container":4,"./lib/context":5,"./lib/custom-tags":6,"./lib/env":8,"./lib/filter":9,"./lib/interpolable":10,"./lib/output-engine/dom":11,"./lib/output-engine/string":12,"./lib/pure-node":16,"./lib/template":17,"./lib/utils":18,"./lib/virtual":19}],3:[function(require,module,exports){
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
	done: function() {
		var self = this;
		if (this._async.count === 0)
			return Promise.resolve(this);
		return new Promise(function(resolve, reject) {
			self._async.successes.push(resolve);
			self._async.fails.push(reject);
		});
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

},{"./emitter":7,"./utils":18}],4:[function(require,module,exports){
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
	mount: function(selector, mode, querier) {
		if (this.destroyed)
			throw new Error('yamvish container has been destroyed. could not mount anymore.');
		if (selector && (selector === this.mountPoint || selector === this.mountSelector))
			return this;
		var node = selector;
		if (typeof node === 'string') {
			this.mountSelector = selector;
			node = (querier || utils.domQuery)(selector);
		}
		if (!node)
			throw new Error('yamvish : mount point not found : ' + selector);
		this.mountPoint = node;
		// console.log('Container.mount : ', this, selector);
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
		// console.log('Container destroy :', this);
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
		if (this._route) {
			if (this._route.unbind)
				this._route.unbind();
			this._route = null;
		}
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

},{"./emitter":7,"./pure-node":16,"./utils":18}],5:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var utils = require('./utils'),
	AsyncManager = require('./async');
//_______________________________________________________ DATA BIND CONTEXT

function Context(data, parent, path) {
	// opt = opt || {};
	this.__yContext__ = true;
	this.data = (data !== undefined) ? data : {};
	if (parent)
		this.parent = parent;
	this.map = {};
	if (path)
		this.path = path;
	var self = this;
	this._binds = [];
	if (path && this.parent)
		this._binds.push(this.parent.subscribe(path, function(type, path, value) {
			self.reset(value);
		}));
	AsyncManager.call(this);
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
	get: function(path) {
		// console.log('context.get : ', path);
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
	dependent: function(path, dependencies, func) {
		var argsOutput = [],
			willFire,
			self = this;
		dependencies.forEach(function(dependency) {
			// subscribe to arguments[i]
			self._binds.push(self.subscribe(dependency, function(type, p, value, key) {
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
			argsOutput.push(self.get(dependency));
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
		if (path[0] === '$this')
			return this.reset(value);
		if (path[0] === '$parent') {
			if (this.parent)
				return this.parent.set(path.slice(1), value);
			throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
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
		var path2 = path.slice();
		var key = path2.pop(),
			parent = path2.length ? utils.getProp(this.data, path2) : this.data;
		if (parent)
			if (parent.forEach) {
				var index = parseInt(key, 10);

				this.notify('removeAt', path2, parent.splice(index, 1), index);
			} else {
				var val = parent[key];
				delete parent[key];
				this.notify('delete', path, val, key);
			}
		return this;
	},
	subscribe: function(path, fn, upstream) {
		// console.log('context subscribe : ', path, fn, upstream);
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
		return this;
		// return function() {
		// 	self.unsubscribe(path, fn, upstream);
		// };

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
				var listener = space._listeners[i];
				if (!listener) {
					// maybe it's because listeners length has change so update it
					len = space._listeners.length;
					continue;
				}
				var r = listener.call(this, type, path, value, index);
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
	}
};

utils.mergeProto(AsyncManager.prototype, Context.prototype);

function notifyUpstreams(space, type, path, value, index) {
	for (var i = 0, len = space._upstreams.length; i < len; ++i) {
		var upstream = space._upstreams[i];
		if (!upstream) {
			// maybe it's because upstreams length has change so update it
			len = space._upstreams.length;
			continue;
		}
		var r = upstream.call(this, type, path, value, index);
		if (r && r.then)
			this.waiting(r);
	}
}

module.exports = Context;

},{"./async":3,"./utils":18}],6:[function(require,module,exports){
var Template = require('./template'),
	Context = require('./context'),
	env = require('./env');

/**
 * use current customTag content
 * @return {[type]} [description]
 */
Template.prototype.__yield = function() {
	return this.exec(function(context, container) {
		var templ = context.data.opts && context.data.opts.__yield;
		if (!templ)
			return;
		return templ.call(this, context, container);
	}, function(context, descriptor) {
		var templ = context.data.opts && context.data.opts.__yield;
		if (!templ)
			return;
		descriptor.children += templ.toHTMLString(context);
	});
};

/**
 * style to do : work on bindable opts
 * @param {[type]} apiName        [description]
 * @param {[type]} tagName        [description]
 * @param {[type]} defaultAttrMap [description]
 * @param {[type]} templ          [description]
 */
module.exports = function addCustomTag(apiName, tagName, defaultAttrMap, templ) {
	var api = env.api,
		space = api[apiName] = api[apiName] || {};
	space[tagName] = function(attrMap, __yield) {
		// copy default to attrMap
		for (var i in defaultAttrMap)
			if (typeof attrMap[i] === 'undefined')
				attrMap[i] = defaultAttrMap[i];
		attrMap.__yield = __yield;
		return this.exec(function(context, container) {
			var ctx = new Context({
				opts: attrMap
			}, context);
			var ctr = templ.toContainer(ctx, container).appendTo(this);
			ctr.context = ctx;
			return ctr.promise;
		}, function(context, descriptor) {
			var ctx = new Context({
				opts: attrMap
			}, context);
			descriptor.children += templ.toHTMLString(ctx);
		});
	}
	return this;
};

},{"./context":5,"./env":8,"./template":17}],7:[function(require,module,exports){
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
		event = (typeof event === 'object' ? event.type : event);
		this._events = this._events || {};
		(this._events[event] = this._events[event] || []).push(fct);
		return this;
	},
	removeEventListener: function(event, fct) {
		event = (typeof event === 'object' ? event.type : event);
		if (!this._events || (event in this._events === false))
			return this;
		this._events[event].splice(this._events[event].indexOf(fct), 1);
		return this;
	},
	dispatchEvent: function(event /* , args... */ ) {
		event = (typeof event === 'object' ? event.type : event);
		if (!this._events || (event in this._events === false))
			return this;
		for (var i = 0; i < this._events[event].length; i++)
			this._events[event][i].apply(this, Array.prototype.slice.call(arguments, 1));
		return this;
	}
};
module.exports = Emitter;

},{}],8:[function(require,module,exports){
(function (global){
var isServer = (typeof window === 'undefined') && (typeof document === 'undefined');

var env = {
	isServer: isServer,
	debug: false,
	api: {},
	expressionsGlobal: isServer ? global : window,
	factory: isServer ? null : document
};

module.exports = env;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var env = require('./env'),
	Filter = require('./filter'),
	replacementRegExp = /true|false|null|\$\.(?:[a-zA-Z]\w*(?:\.\w*)*)|\$this(?:\.\$?\w*)*|\$parent(?:\.\$?\w*)+|\$(?:[a-zA-Z]\w*(?:\.\w*)*)|"[^"]*"|'[^']*'|[a-zA-Z_]\w*(?:\.\w*)*/g;

function tryExpr(func, context) {
	if (!context)
		throw new Error('context is undefined')
	try {
		return func.call(context.data, context, env.expressionsGlobal);
	} catch (e) {
		console.error(e, env.debug ? e.stack : '');
		return '';
	}
}

var cache = {};

// analyse and produce xpr func
function compileExpression(expr, filter, dependencies) {
	// console.log('xpr parse : ', expr);
	var total = expr + filter;
	if (cache[total]) {
		dependencies.push.apply(dependencies, cache[total].dependencies);
		return cache[total].func;
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
				else {
					dep.push(whole);
					return '__context.get(["' + whole.split('.').join('","') + '"])';
				}
			default:
				dep.push(whole);
				return '__context.get(["' + whole.split('.').join('","') + '"])';
		}
	});
	// console.log('xpr parsing res : ', expr);
	dependencies.push.apply(dependencies, dep);

	var func = new Function("__context", "__global", "return " + expr + ";");
	if (!filter) {
		cache[total] = {
			func: func,
			dependencies: dep
		};
		return func;
	}
	// produce filter 
	var fltr = new Function('Filter', 'return new Filter().' + filter)(Filter);
	// wrap expr func with filter
	var f = cache[total] = function(context, global) {
		return fltr.call(this, func.call(this, context, global));
	};
	cache[total] = {
		func: f,
		dependencies: dep
	};
	return f;
}

// produce context's subscibtion event handler
function handler(instance, context, func, index, callback) {
	return function(type, path, newValue) {
		instance.results[index] = tryExpr(func, context);
		if (instance.dependenciesCount === 1) {
			callback(type, path, instance.output(context));
		} else if (!instance.willFire)
			instance.willFire = context.delay(function() { // allow small time to manage other dependencies update without multiple rerender
				if (instance.willFire) {
					instance.willFire = null;
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
	this.results = [];
	this.willFire = null;
	this.parts = interpolable.parts;
	this.dependenciesCount = interpolable.dependenciesCount;
	this.directOutput = interpolable.directOutput;
	this._strict = interpolable._strict;
};

// produce interpolable output
Instance.prototype.output = function(context) {
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
	if (!this.outputed)
		this.outputed = true;
	return out;
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
				context.subscribe(dep[j], h)
		}
		// return function() {
		// 	// unbind all
		// 	instance.willFire = null;
		// 	for (var i = 0; i < instance.binds.length; i++)
		// 		instance.binds[i]();
		// };
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

var cache2 = {};

module.exports = {
	// check if a string is interpolable. if so : return new Interpolable. else return original string.
	interpolable: function(string, strict) {
		if (typeof string !== 'string')
			return string;
		if (cache2[string])
			return cache2[string];
		var splitted = string.split(splitRegEx);
		if (splitted.length == 1)
			return string; // string is not interpolable
		return cache2[string] = new Interpolable(splitted, strict);
	},
	Interpolable: Interpolable
};

},{"./env":8,"./filter":9}],11:[function(require,module,exports){
var utils = require('../utils'),
	env = require('../env'),
	PureNode = require('../pure-node'),
	Container = require('../container'),
	Context = require('../context'),
	Template = require('../template');

function eachPush(value, context, container, template, promises) {
	var ctx = new Context(value, context),
		child = new PureNode();
	child.context = ctx;
	container.appendChild(child);
	var p = template.call(child, ctx, container);
	if (p && p.then)
		promises.push(p);
	return child;
}

var engine = {
	//_________________________________ local context management
	context: function(context, args) {
		var value = args[0],
			parentPath = args[1];
		this.context = new Context(parentPath ? null : value, context, parentPath ? parentPath : null)
	},
	with: function(context, args) {
		var path = args[0],
			template = args[1],
			ctx = new Context(typeof path === 'string' ? context.get(path) : path, context, path);
		template.call(this, ctx, container);
	},
	//_________________________________ conditional rendering
	rendered: function(context, args) {
		var condition = args[0],
			ok = args[0],
			self = this;
		var exec = function(type, path, ok) {
			if (ok)
				return trueCallback.call(self, self.context || context);
			else if (falseCallback)
				return falseCallback.call(self, self.context || context);
		};
		if (condition && condition.__interpolable__) {
			ok = condition.output(context);
			(this._binds = this._binds || []).push(condition.subscribeTo(context, exec));
		} else if (type === 'function')
			ok = condition.call(this, context);
		return exec('set', null, ok);
	},
	//_______________________________________ TAGS
	tag: function(context, originalArgs) {
		var name = originalArgs[0],
			template = originalArgs[1],
			node = env.factory.createElement(name);
		// utils.hide(node);
		this.appendChild(node);
		template.call(node, context);
		// utils.show(node);
	},
	text: function(context, args) {
		var value = args[0],
			node;
		if (value.__interpolable__) {
			node = env.factory.createTextNode(value.output(context));
			value.subscribeTo(context, function(type, path, newValue) {
				node.nodeValue = newValue;
			});
		} else
			node = env.factory.createTextNode(value);
		this.appendChild(node);
	},
	br: function(context) {
		this.appendChild(env.factory.createElement('br'));
	},
	// __________________________ ATTRIBUTES
	attr: function(context, args) {
		var self = this,
			name = args[0],
			value = args[1],
			val = args[1];
		if (value.__interpolable__) {
			val = value.output(context);
			var attributeUpdate = function(type, path, newValue) {
				self.setAttribute(name, newValue);
			};
			value.subscribeTo(context, attributeUpdate);
		}
		this.setAttribute(name, val);
	},
	disabled: function(context, args) {
		var self = this,
			value = args[0];
		var disable = function(type, path, newValue) {
			if (invert)
				newValue = !newValue;
			if (newValue)
				self.setAttribute('disabled');
			else
				self.removeAttribute('disabled');
		};
		if (typeof value === 'string') {
			context.subscribe(value, disable);
			disable('set', null, context.get(value));
		} else
			disable('set', null, (value !== undefined) ? value : true);
	},
	val: function(context, args) {
		var self = this,
			varPath = args[0],
			value = args[1];
		if (value.__interpolable__) {
			if (!env.isServer)
				this.addEventListener('input', function(event) {
					context.set(varPath, event.target.value);
				});
			value.subscribeTo(context, function(type, path, newValue) {
				self.setAttribute('value', newValue);
			});
			this.setAttribute('value', value.output(context));
		} else
			this.setAttribute('value', value);
	},
	setClass: function(context, args) {
		var self = this,
			name = args[0],
			flag = args[1],
			classValue = name,
			flagValue = flag;
		var flagUpdate = function(type, path, newValue) {
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
			name.subscribeTo(context, nameUpdate);
			classValue = name.output(context);
		}
		if (flag.__interpolable__) {
			flag.subscribeTo(context, flagUpdate);
			flagUpdate('set', null, flag.output(context));
		} else
			flagUpdate('set', null, flag);
	},
	css: function(context, args) {
		var prop = args[0],
			value = args[1],
			val = value,
			self = this;
		if (value.__interpolable__) {
			val = value.output(context);
			value.subscribeTo(context, function(type, path, newValue) {
				self.style[prop] = newValue;
			});
		}
		if (!this.style)
			this.style = {};
		this.style[prop] = val;
	},
	visible: function(context, args) {
		var flag = args[0],
			val = flag,
			self = this,
			initial = (this.style ? this.style.display : '') || '';
		if (!this.style)
			this.style = {};
		if (flag.__interpolable__) {
			val = flag.output(context);
			flag.subscribeTo(context, function(type, path, newValue) {
				if (self.__yContainer__)
					newValue ? self.show() : self.hide();
				else
					self.style.display = newValue ? initial : 'none';
			});
		}
		if (this.__yContainer__)
			val ? this.show() : this.hide();
		else
			this.style.display = val ? initial : 'none';
	},
	//______________________________________________ EVENTS
	on: function(context, args) {
		var name = args[0],
			handler = args[1];
		this.addEventListener(name, function(evt) {
			return handler.call(context, evt);
		});
	},
	off: function(context, args) {
		var name = args[0],
			handler = args[1];
		this.removeEventListener(name, handler);
	},
	//______________________________________________ CLIENT/SERVER
	client: function(context, args) {
		if (env.isServer)
			return;
		return args[0].call(this, context);
	},
	server: function(context, args) {
		if (!env.isServer)
			return;
		return args[0].call(this, context);
	},
	//______________________________________________ EACH
	each: function(context, args) {
		var path = args[0],
			template = utils.getEachTemplate(this, args[1]),
			self = this,
			container = new PureNode();
		container.childNodes = [];
		if (this.__yPureNode__)
			this.appendChild(container);
		else
			(this._yamvish_containers = this._yamvish_containers || []).push(container);

		var render = function(type, path, value, index) {
			// console.log('render : ', type, path, value.length, index);
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
					// }
					var mountPoint = fragment || self.mountPoint || self;
					nextSibling = fragment ? null : nextSibling;
					for (var len = value.length; j < len; ++j) // reset existing or create new node 
						if (container.childNodes[j]) // reset existing
							container.childNodes[j].context.reset(value[j]);
						else { // create new node
							var child = eachPush(value[j], context, container, template, promises);
							if ((!self.__yPureNode__ || self.mountPoint) && child.childNodes)
								utils.mountChildren(child, mountPoint, nextSibling);
						}
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
						child = eachPush(value, context, container, template, promises);
					if ((!self.__yPureNode__ || self.mountPoint) && child.childNodes)
						utils.mountChildren(child, self.mountPoint || self, nextSibling);
					if (promises.length)
						return promises[0];
					break;
			}
		};
		var data = path;
		if (typeof path === 'string') {
			this._binds = this._binds || [];
			this._binds.push(context.subscribe(path, render));
			this._binds.push(context.subscribe(path + '.*', function(type, path, value, key) {
				var node = container.childNodes[key];
				if (node)
					return node.context.reset(value);
			}));
			data = context.get(path);
		}
		if (data)
			return render('set', path, data);
	},
	//________________________________________________ MISC
	contentSwitch: function(context, args) {
		var current,
			xpr = args[0],
			map = args[1],
			dico = utils.shallowCopy(map),
			self = this;
		var valueUpdate = function(type, path, value) {
			if (!value) {
				if (current)
					current.unmount();
				current = null;
				return;
			}
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
		xpr.subscribeTo(context, valueUpdate);
		return valueUpdate('set', null, xpr.output(context));
	}
};

function execQueue(callee, queue, context) {
	var handler = queue[0],
		nextIndex = 0,
		promises = [],
		r;
	while (handler) {
		nextIndex++;
		var f = handler.func || engine[handler.name];
		r = f.call(callee, callee.context || context, handler.args);
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

Template.prototype.call = function(caller, context) {
	return execQueue(caller, this._queue, context);
};

Template.prototype.toContainer = function(context) {
	var container = new Container();
	execQueue(container, this._queue, context);
	return container;
};




/**
 * With : peut etre juste placer un context dans le context parent sous le path du with
 * ==> comme ca pour retrouver quand string output c'est facile
 *
 *
 * ==> implique que lorsque qu'on fait context.get(...) ==> et qu'on chope ou passe par un context : il faut déréférencer
 *
 * ==> peut poser probleme pour binding
 *
 *
 * ==< peut etre stocker dans context les fils sous deux formes : 
 *
 *	array de childs pour les anonyme (aka .newContext() accroché à un noeud)
 *	espace de nom pour les .with et les .each 
 *
 * 
 * ==> seul les string output ont besoin de sortir d'abord les context puis les retrouver
 *
 *
 * ==> faut préparer les deuxième temps à la première passe pour les .string output
 */

},{"../container":4,"../context":5,"../env":8,"../pure-node":16,"../template":17,"../utils":18}],12:[function(require,module,exports){
var utils = require('../utils'),
	env = require('../env'),
	openTags = require('../parsers/open-tags'),
	strictTags = /span|script|meta/,
	Context = require('../context'),
	Template = require('../template');

// String Output Descriptor
function SOD() {
	this.attributes = '';
	this.classes = '';
	this.children = '';
	this.style = '';
}

function tagOutput(descriptor, innerDescriptor, name) {
	var out = '<' + name + innerDescriptor.attributes;
	if (innerDescriptor.style)
		out += ' style="' + innerDescriptor.style + '"';
	if (innerDescriptor.classes)
		out += ' class="' + innerDescriptor.classes + '"';
	if (innerDescriptor.children)
		descriptor.children += out + '>' + innerDescriptor.children + '</' + name + '>';
	else if (openTags.test(name))
		descriptor.children += out + '>';
	else if (strictTags.test(name))
		descriptor.children += out + '></' + name + '>';
	else
		descriptor.children += out + '/>';
}
utils.tagOutput = tagOutput;

var methods = {
	SOD: SOD,
	//_________________________________ local context management
	context: function(context, descriptor, args) {
		var value = args[0],
			parentPath = args[1];
		descriptor.context = new Context(parentPath ? null : value, context, parentPath ? parentPath : null)
	},
	//_________________________________________ EACH
	each: function(context, descriptor, args) {
		var path = args[0],
			values = (typeof path === 'string') ? context.get(path) : path;
		if (values) {
			var template = args[1],
				nd = new SOD();
			for (var i = 0, len = values.length; i < len; ++i)
				template.toHTMLString(new Context(values[i], context), nd);
			descriptor.children += nd.children;
		}
	},
	// ____________________________________ WITH
	with: function(context, descriptor, args) {
		var path = args[0],
			template = args[1];
		var ctx = new Context(typeof path === 'string' ? context.get(path) : path, context, path),
			newDescriptor = new SOD();
		template.toHTMLString(ctx, newDescriptor, container);
		descriptor.attributes += newDescriptor.attributes;
		if (newDescriptor.style)
			descriptor.style += newDescriptor.style;
		if (newDescriptor.classes)
			descriptor.classes += newDescriptor.classes;
		if (newDescriptor.children)
			descriptor.children += newDescriptor.children;
	},
	//______________________________________________
	rendered: function(context, descriptor, args) {
		var ok, condition = args[0];
		if (condition && condition.__interpolable__)
			ok = condition.output(context);
		else if (type === 'function')
			ok = condition.call(this, context);
		if (ok)
		; // render to string
	},
	//________________________________ TAGS
	tag: function(context, descriptor, originalArgs) {
		var name = originalArgs[0],
			template = originalArgs[1];
		var newDescriptor = new SOD();
		template.toHTMLString(context, newDescriptor);
		tagOutput(descriptor, newDescriptor, name);
	},
	text: function(context, descriptor, args) {
		var value = args[0];
		descriptor.children += value.__interpolable__ ? value.output(context) : value;
	},
	br: function(context, descriptor) {
		descriptor.children += '<br>';
	},
	//______________________________________________ ATTRIBUTES
	attr: function(context, descriptor, args) {
		var name = args[0],
			value = args[1];
		descriptor.attributes += ' ' + name;
		if (value)
			descriptor.attributes += '="' + (value.__interpolable__ ? value.output(context) : value) + '"';
	},
	disabled: function(context, descriptor, args) {
		var value = args[0];
		if (value === undefined || context.get(value))
			descriptor.attributes += ' disabled';
	},
	val: function(context, descriptor, args) {
		var path = args[0],
			value = args[1];
		descriptor.attributes += ' value="' + (value.__interpolable__ ? value.output(context) : value) + '"';
	},
	setClass: function(context, descriptor, args) {
		var name = args[0],
			flag = args[1];
		if (flag.__interpolable__ && flag.output(context) || flag)
			descriptor.classes += ' ' + (name.__interpolable__ ? name.output(context) : name);
	},
	css: function(context, descriptor, args) {
		var prop = args[0],
			value = args[1];
		descriptor.style += prop + ':' + (value.__interpolable__ ? value.output(context) : value);
	},
	visible: function(context, descriptor, args) {
		var flag = args[0],
			val = flag.__interpolable__ ? flag.output(context) : flag;
		if (!val)
			descriptor.style += 'display:none;';
	},
	//_________________________________ EVENTS
	on: function() {},
	off: function() {},
	//_________________________________ CLIENT/SERVER
	client: function(context, descriptor, args) {
		if (env.isServer)
			return;
		args[0].toHTMLString(context, descriptor);
	},
	server: function(context, descriptor, args) {
		if (!env.isServer)
			return;
		args[0].toHTMLString(context, descriptor);
	}
};

Template.prototype.toHTMLString = function(context, descriptor) {
	descriptor = descriptor ||  new SOD();
	var handler = this._queue[0],
		nextIndex = 0;
	while (handler) {
		var f = handler.func || methods[handler.name];
		f(descriptor.context || context, descriptor, handler.args);
		handler = this._queue[++nextIndex];
	}
	return descriptor.children;
};

module.exports = methods;

},{"../context":5,"../env":8,"../parsers/open-tags":14,"../template":17,"../utils":18}],13:[function(require,module,exports){
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

},{"./primitive-argument-rules":15,"elenpi":1}],14:[function(require,module,exports){
module.exports = /(br|input|img|area|base|col|command|embed|hr|img|input|keygen|link|meta|param|source|track|wbr)/;

},{}],15:[function(require,module,exports){
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

},{"elenpi":1}],16:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
/**
 * Pure Virtual Node
 */
function PureNode() {
	this.__yPureNode__ = true;
};

PureNode.prototype  = {
	insertBefore: function(toInsert, o) {
		if (!this.childNodes)
			return false;
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

},{}],17:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

"use strict";

var utils = require('./utils'),
	env = require('./env'),
	interpolable = require('./interpolable').interpolable,
	Context = require('./context'),
	listenerParser = require('./parsers/listener-call');

//_______________________________________________________ TEMPLATE

function Template(t) {
	this.__yTemplate__ = true;
	if (t) {
		this._queue = t._queue.slice();
		this._hasEach = t._hasEach;
	} else
		this._queue = [];
}

// local shortcut
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
	exec: function(name, args, firstPass) {
		var isFunc = typeof name === 'function';
		this._queue.push({
			func: isFunc ? name : null,
			name: isFunc ? null : name,
			args: args,
			firstPass: firstPass
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
	context: function(value) {
		var parentPath;
		if (typeof value === 'string')
			parentPath = value;
		return this.exec('context', [value, parentPath], true);
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
	//_____________________________ Conditional node rendering
	rendered: function(condition) {
		var type = typeof condition;
		if (type === 'string')
			condition = interpolable(condition);
		return this.exec('rendered', [condition]);
	},
	//__________________________________ Attributes
	attr: function(name, value) {
		return this.exec('attr', [name, interpolable(value)]);
	},
	disabled: function(value) {
		return this.exec('disabled', [interpolable(value)]);
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
		if (flag)
			flag = interpolable(flag);
		name = interpolable(name);
		flag = !arguments[1] ? true : flag;
		return this.exec('setClass', [name, flag]);
	},
	css: function(prop, value) {
		if (typeof value === 'string')
			value = interpolable(value);
		return this.exec('css', [prop, value]);
	},
	visible: function(flag) {
		return this.exec('visible', [interpolable(flag)]);
	},
	//_______________________________________ HTML TAGS

	text: function(value) {
		return this.exec('text', [interpolable(value)]);
	},
	tag: function(name, attrMap) { // arguments : name, template1, t2, ...
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
				t._queue = t._queue.concat(arguments[i]._queue);
		}
		// console.log('tag : ', hasAttrMap, t);
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
	// subscribeNode: function(path, handler, upstream) {
	// 	return this.exec(function(context) {
	// 		var self = this;
	// 		context.subscribe(path, function(type, path, value, index) {
	// 			handler.call(self, type, path, value, index);
	// 		}, upstream);
	// 	});
	// },
	// unsubscribeNode: function(path, handler, upstream) {
	// 	return this.exec(function(context) {
	// 		var self = this;
	// 		context.subscribe(path, function(type, path, value, index) {
	// 			handler.call(self, type, path, value, index);
	// 		}, upstream);
	// 	});
	// },
	//___________________________________________ Collection
	each: function(path, templ, emptyTempl) {
		this._hasEach = true;
		return this.exec('each', [path, templ, emptyTempl]);
	},
	//____________________________________________ MISC
	use: function(name) {
		var args = argToArr(arguments);
		args.shift();
		if (typeof name === 'string')
			name = name.split(':');
		var method = (name.forEach ? utils.getApiMethod(env, name) : name);
		if (method.__yTemplate__)
			this._queue = this._queue.concat(method._queue);
		else
			method.apply(this, args);
		return this;
	},
	client: function(templ) {
		return this.exec('client', [templ]);
	},
	server: function(templ) {
		return this.exec('server', [templ]);
	},
	api: function(name) {
		var Api = (typeof name === 'string') ? env.api[name] : name;
		if (!Api)
			throw new Error('no template api found with : ' + name);
		for (var i in Api) {
			if (!Api.hasOwnProperty(i))
				continue;
			this[i] = Api[i];
		}
		return this;
	},
	contentSwitch: function(xpr, map) {
		return this.exec('contentSwitch', [interpolable(xpr), map]);
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
		if (env.isServer)
			return;
		return this.on(eventName, handler);
	};
});

Template.render = 0;

module.exports = Template;

},{"./context":5,"./env":8,"./interpolable":10,"./parsers/listener-call":13,"./utils":18}],18:[function(require,module,exports){
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
	if (node._route) {
		if (node._route.unbind)
			node._route.unbind();
		node._route = null;
	}
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
	},
	getEachTemplate: function(parent, templ) {
		templ = templ || parent._eachTemplate;
		if (!templ)
			throw produceError('no template for .each template handler', parent);
		return templ;
	},
	getApiMethod: function(env, path) {
		if (!path.forEach)
			path = path.split(':');
		if (path.length !== 2)
			throw new Error('yamvish method call badly formatted : ' + path.join(':'));
		var output = env.api[path[0]][path[1]];
		if (!output)
			throw new Error('no template/container found with "' + path.join(':') + '"');
		return output;
	},
	getFunctionArgs: function(func) {
		return (func + '').replace(/\s+/g, '')
			.replace(/[\/][*][^\/*]*[*][\/]/g, '') // strip simple comments  
			.split('){', 1)[0].replace(/^[^(]*[(]/, '') // extract the parameters  
			.replace(/=[^,]+/g, '') // strip any ES6 defaults  
			.split(',')
			.filter(Boolean); // split & filter [""]  
	}
}

},{}],19:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var utils = require('./utils'),
	Emitter = require('./emitter'),
	PureNode = require('./pure-node'),
	openTags = require('./parsers/open-tags');

//_______________________________________________________ VIRTUAL NODE

/**
 * Virtual Node
 *
 * A minimal mock of DOMElement. It gathers PureNode and Emitter API and add attributes management (add and remove).
 * 
 * @param {Object} option (optional) option object : { ?tagName:String, ?nodeValue:String } + options from PureNode
 */
function Virtual(tagName, nodeValue) {
	// opt = opt || {};
	PureNode.call(this);
	this.__yVirtual__ = true;
	this.tagName = tagName;
	if (nodeValue)
		this.nodeValue = nodeValue;
};

Virtual.prototype  = {
	setAttribute: function(name, value) {
		(this.attributes = this.attributes || {})[name] = value;
	},
	removeAttribute: function(name, value) {
		if (!this.attributes)
			return;
		delete this.attributes[name];
	}
};

// apply inheritance
utils.mergeProto(PureNode.prototype, Virtual.prototype);
utils.mergeProto(Emitter.prototype, Virtual.prototype);

/**
 * Virtual to String output
 * @return {String} the String representation of Virtual node
 */
Virtual.prototype.toString = function() {
	if (this.tagName === 'textnode')
		return this.nodeValue;
	var node = '<' + this.tagName;
	if (this.id)
		node += ' id="' + this.id + '"';
	for (var a in this.attributes)
		node += ' ' + a + '="' + this.attributes[a] + '"';
	if (this.classes) {
		var classes = Object.keys(this.classes);
		if (classes.length)
			node += ' class="' + classes.join(' ') + '"';
	}
	if (this.childNodes && this.childNodes.length) {
		node += '>';
		for (var j = 0, len = this.childNodes.length; j < len; ++j)
			node += this.childNodes[j].toString();
		node += '</' + this.tagName + '>';
	} else if (this.scriptContent)
		node += '>' + this.scriptContent + '</script>';
	else if (openTags.test(this.tagName))
		node += '>';
	else
		node += ' />';
	return node;
};


// Virtual Factory : mimic document.createElement but return a virtual node
Virtual.createElement = function(tagName) {
	return new Virtual(tagName);
};

// Virtual Factory : mimic document.createTextNode but return a virtual node
Virtual.createTextNode = function(value) {
	return new Virtual('textnode', value);
};

module.exports = Virtual;

},{"./emitter":7,"./parsers/open-tags":14,"./pure-node":16,"./utils":18}]},{},[2])(2)
});