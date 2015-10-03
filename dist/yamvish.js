(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.y = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
	TODO : 
		parsing 
			from DOM
				still data-*
			from String 				OK

		if('!initialised', ..., ...)

		integrate filters and expressions

		request and c3po

		model validation + .disabled

		route

		views pool

		.client( t1, t2, ...)
		.server(t1, t2, ...)

		promise management : catch end render / load
		
		mount/umount event 						OK

		EAch : children  : place els in Virtual Node (could be many)
			==> is natural : no need... each node has it's own dom element    	OK
		//______________________
		y.dependent('bloupi', 'foo', function(bloupi, foo){});
		
		==> a dependent function should only be a value in context.data
			that is registred to dependencies (as a Interpolable)

		y.applyToDOM(node | selector, template)		==> apply template on dom element (select it if selector)

		eventListeners : click(addUser(user)) : should retrieve user before feeding addUser 

*/

//____________________________________________________ YAMVISH

var utils = require('./lib/utils');

var y = function(t) {
	return new y.Template(t);
};
y.isServer = utils.isServer;
y.utils = utils;
y.Context = require('./lib/context');
y.Template = require('./lib/template');
y.PureNode = require('./lib/pure-node');
y.Virtual = require('./lib/virtual');
y.Container = require('./lib/container');
y.View = require('./lib/view');
y.rql = require('./plugins/rql-array');
require('./plugins/rql');

var interpolable = require('./lib/interpolable');
y.interpolable = interpolable.interpolable;
y.Interpolable = interpolable.Interpolable;

// parsers
/*y.dom = require('./lib/parsers/dom-to-template');
y.html = require('./lib/parsers/html-to-template');
y.expression = require('./lib/parsers/expression');
y.elenpi = require('elenpi');*/

//________________________________________________ END VIEW

y.mainContext = null;
y.components = {};
y.addComponent = function(name, template /* or view instance */ ) {
	y.components[name] = template;
};

module.exports = y;

},{"./lib/container":2,"./lib/context":3,"./lib/interpolable":5,"./lib/pure-node":7,"./lib/template":8,"./lib/utils":9,"./lib/view":10,"./lib/virtual":11,"./plugins/rql":13,"./plugins/rql-array":12}],2:[function(require,module,exports){
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
			throw new Error('yamvish : mount point not found : ' + selector)
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
		this.childNodes = undefined;
		this.context = undefined;
		this.mountPoint = undefined;
		this.mountSelector = undefined;
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

},{"./emitter":4,"./pure-node":7,"./utils":9}],3:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var utils = require('./utils');
//_______________________________________________________ DATA BIND CONTEXT

function Context(opt /*data, handlers, parent, path*/ ) {
	opt = opt || {};
	this.data = (opt.data !== undefined) ? opt.data : {};
	this.parent = opt.parent;
	this.handlers = opt.handlers || {};
	this.map = {};
	this.path = opt.path;
	var self = this;
	this._binds = [];
	if (opt.path && this.parent)
		this._binds.push(this.parent.subscribe(opt.path, function(type, path, value) {
			self.reset(value);
		}));
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
		this.handlers = null;
		this.map = null;
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
		if (path[0] === '$this')
			return this.data;
		if (path[0] == '$parent') {
			if (this.parent)
				return this.parent.get(path.slice(1));
			throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
		}
		return utils.getProp(this.data, path);
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
			for (var i = 0, len = space._listeners.length; i < len; ++i)
				space._listeners[i](type, path, value, index);
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
				notifyUpstreams(star, type, path, value, index);
			if (!(space = space[path[i]]))
				break;
			if (space._upstreams)
				notifyUpstreams(space, type, path, value, index);
		}
		if (star)
			this.notifyAll(type, path, star, value, index);
		if (space)
			this.notifyAll(type, path, space, value, index);
		return this;
	}

	/*
		// TODO
		rqlView: function(path, expr, viewName) {
			// filter array and produce array.view
		},
		ressource: function(resourceMap, done, fail, $this) {
			
				in template :

					// should do .set('loading', true) automatically
					.load(
						'users', 
						'users::?bloupi={{ route.flappy}}', 
						y().set('loading', false),  // should do this by default
						y().set('loading', false).text('Error while loading') // should do this by default
					)
	} */
};


function notifyUpstreams(space, type, path, value, index) {
	for (var i = 0, len = space._upstreams.length; i < len; ++i)
		space._upstreams[i](type, path, value, index);
}

module.exports = Context;

},{"./utils":9}],4:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

/**
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

},{}],5:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

// var expression = require('./parsers/expression');

//_______________________________________________________ INTERPOLABLE

var Interpolable = function(splitted) {
	this.__interpolable__ = true;
	if (splitted.length === 3 && splitted[0] === "" && splitted[2] === "") {
		// single expression with nothing around
		this.directOutput = splitted[1];
		this.dependencies = [splitted[1]];
	} else {
		// interpolable string
		this.splitted = splitted;
		this.dependencies = []; // catch expression dependencies
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
		return function() { // unbind all
			for (var i = 0; i < binds.length; i++)
				binds[i]();
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

var splitRegEx = /\{\{\s*([^\}\s]+)\s*\}\}/;

function interpolable(string) {
	var splitted = string.split(splitRegEx);
	if (splitted.length == 1)
		return string; // string is not interpolable
	return new Interpolable(splitted);
};

module.exports = {
	interpolable: interpolable,
	Interpolable: Interpolable
};

},{}],6:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

//_______________________________________________________ DOM PARSING

/**
 * DOM element.childNodes parsing to y.Template
 * @param  {[type]} element [description]
 * @param  {[type]} template   [description]
 * @return {[type]}         [description]
 */
function elementChildrenToTemplate(element, template) {
	var t = template || new this.Template();
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
			var childTemplate = new this.Template();
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

module.exports = {
	elementChildrenToTemplate: elementChildrenToTemplate,
	elementToTemplate: elementToTemplate
};

},{}],7:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var utils = require('./utils');

/**
 * Pure Virtual Node
 */
function PureNode() {
	this.__yPureNode__ = true;
};

PureNode.prototype  = {
	insertBefore: function(toInsert, o) {
		var inserted = false;
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

},{"./utils":9}],8:[function(require,module,exports){
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

},{"./container":2,"./context":3,"./interpolable":5,"./parsers/dom-to-template":6,"./pure-node":7,"./utils":9,"./virtual":11}],9:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

//__________________________________________________________ UTILS

function produceError(msg, report) {
	var e = new Error(msg);
	e.report = report;
	return e;
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

//________________________________ Properties management with dot syntax

function getProp(from, path) {
	if (path[0] === '$this')
		return from;
	var tmp = from;
	for (var i = 0, len = path.length; i < len; ++i)
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

//_____________________________ QUEUE EXECUTION (to be specilaise for filters)

function execHandler(callee, fn, context) {
	try {
		return fn.call(callee, callee.context || context);
	} catch (e) {
		return e;
	}
}

function execQueue(callee, queue, context, error) {
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
			r = execHandler(callee, handler.fn, context, error);
			error = null;
		} else {
			if (handler.type === 'catch') {
				handler = queue[nextIndex];
				continue;
			}
			r = execHandler(callee, handler.fn, context);
			if (r && r.then) {
				var rest = queue.slice(nextIndex);
				return r.then(function(s) {
					return execQueue(callee, rest, context);
				}, function(e) {
					return execQueue(callee, rest, context, e);
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



//_______________________________________ EXPORTS

module.exports = {
	isServer: (typeof window === 'undefined') && (typeof document === 'undefined'),
	mountChildren: mountChildren,
	execHandler: execHandler,
	execQueue: execQueue,
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
	}
}

},{}],10:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var utils = require('./utils'),
	Template = require('./template'),
	Virtual = require('./virtual'),
	Container = require('./container'),
	Context = require('./context');
//____________________________________________________ VIEW
var View = function View(opt) {
	opt = opt || {};
	if (opt.componentName)
		addComponent(opt.componentName, this);
	this.factory = opt.factory;
	Context.call(this, opt);
	Container.call(this, opt);
}
utils.mergeProto(Template.prototype, View.prototype);
utils.mergeProto(Context.prototype, View.prototype);
utils.mergeProto(Container.prototype, View.prototype);
View.prototype.done = function(fn) {
	fn.call(this, this, this.factory || (utils.isServer ? Virtual : document)); // apply directly toElement handler on this
	return this;
};
View.prototype.destroy = function() {
	Container.prototype.destroy.call(this);
	Context.prototype.destroy.call(this);
};
delete View.prototype['catch'];
delete View.prototype.call;
delete View.prototype.toElement;
delete View.prototype.id;
delete View.prototype.attr;
delete View.prototype.setClass;
delete View.prototype.visible;
delete View.prototype.css;
delete View.prototype.val;
delete View.prototype.contentEditable;

module.exports = View;

},{"./container":2,"./context":3,"./template":8,"./utils":9,"./virtual":11}],11:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var utils = require('./utils'),
	Emitter = require('./emitter'),
	PureNode = require('./pure-node'),
	openTags = /(br|input|img|area|base|col|command|embed|hr|img|input|keygen|link|meta|param|source|track|wbr)/;

//_______________________________________________________ VIRTUAL NODE

/**
 * Virtual Node
 * @param {String} tagName the tagName of the virtual node
 */
function Virtual(opt /*tagName, context*/ ) {
	opt = opt || {};
	this.__yVirtual__ = true;
	if (opt.tagName)
		this.tagName = opt.tagName;
	if (opt.nodeValue)
		this.nodeValue = opt.nodeValue;
	PureNode.call(this, opt);
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

utils.mergeProto(PureNode.prototype, Virtual.prototype);
utils.mergeProto(Emitter.prototype, Virtual.prototype);

/**
 * Virtual to String output
 * @return {String} the String représentation of Virtual node
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

Virtual.createElement = function(tagName) {
	return new Virtual({
		tagName: tagName
	});
};

Virtual.createTextNode = function(value) {
	return new Virtual({
		tagName: 'textnode',
		nodeValue: value
	})
};

module.exports = Virtual;

},{"./emitter":4,"./pure-node":7,"./utils":9}],12:[function(require,module,exports){
/**
 * A reimplmentation RQL for JavaScript arrays based on rql/js-array from Kris Zyp (https://github.com/persvr/rql).
 * No more eval or new Function.
 * It handle also dotted notation for properties path.
 * @example
 * rql([{a:{b:3}},{a:3}], "a.b=3") -> [{a:{b:3}]
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 */
(function() {
	"use strict";
	var parser = require('rql/parser');

	function inArray(what, inArr) {
		if (!inArr || !inArr.forEach)
			return false;
		if (what.forEach) {
			var test = {};
			inArr.forEach(function(e) {
				test[e] = true;
			});
			var okCount = 0;
			what.forEach(function(e) {
				if (test[e])
					okCount++;
			});
			if (okCount == what.length)
				return true;
			return false;
		}
		return inArr.some(function(e) {
			return what === e;
		});
	};


	var rqlParser = parser.parseQuery;

	var queryCache = {};

	var rql = function(array, query) {
		if (query[0] == "?")
			query = query.substring(1);
		if (queryCache[query])
			return queryCache[query].call(array);
		return rql.compile(query).call(array);
	};

	rql.parse = function(input) {
		try {
			var r = rqlParser(input);
			r.toString = function() {
				return input;
			};
			return r;
		} catch (e) {
			return null;
		}
	};

	rql.compile = function(query) {
		var parsed = rql.parse(query);
		var func = rqlNodeToFunc(parsed);
		queryCache[query] = func;
		return func;
	};

	rql.ops = {
		isPresent: function(path, items) {
			var res = [];
			var len = items.length;
			for (var i = 0; i < len; ++i)
				if (retrieve(items[i], path))
					res.push(items[i]);
			return res;
		},
		sort: function() {
			var terms = [];
			for (var i = 0; i < arguments.length; i++) {
				var sortAttribute = arguments[i];
				var firstChar = sortAttribute.charAt(0);
				var term = {
					attribute: sortAttribute,
					ascending: true
				};
				if (firstChar == "-" || firstChar == "+") {
					if (firstChar == "-")
						term.ascending = false;
					term.attribute = term.attribute.substring(1);
				}
				terms.push(term);
			}
			this.sort(function(a, b) {
				for (var term, i = 0; term = terms[i]; i++) {
					var ar = retrieve(a, term.attribute);
					var br = retrieve(b, term.attribute);
					if (ar != br)
						return term.ascending == ar > br ? 1 : -1;
				}
				return 0;
			});
			return this;
		},
		match: filter(function(value, regex) {
			return new RegExp(regex).test(value);
		}),
		"in": filter(function(value, values) {
			var ok = false;
			var count = 0;
			while (!ok && count < values.length)
				if (values[count++] == value)
					ok = true;
			return ok;
		}),
		out: filter(function(value, values) {
			var ok = true;
			var count = 0;
			while (ok && count < values.length)
				if (values[count++] == value)
					ok = false;
			return ok;
		}),
		contains: filter(function(array, value) {
			return inArray(value, array);
		}),
		excludes: filter(function(array, value) {
			return !inArray(value, array);
		}),
		or: function() {
			var items = [];
			//TODO: remove duplicates and use condition property
			for (var i = 0; i < arguments.length; ++i) {
				var a = arguments[i];
				if (typeof a == 'function')
					items = items.concat(a.call(this));
				else
					items = items.concat(rql.ops.isPresent(a, items));
			}
			return items;
		},
		and: function() {
			var items = this;
			for (var i = 0; i < arguments.length; ++i) {
				var a = arguments[i];
				if (typeof a == 'function')
					items = a.call(items);
				else
					items = rql.ops.isPresent(a, items);
			}
			return items;
		},
		select: function() {
			var args = arguments;
			var argc = arguments.length;
			var res = this.map(function(object) {
				var selected = {};
				for (var i = 0; i < argc; i++) {
					var propertyName = args[i];
					var value = evaluateProperty(object, propertyName);
					if (typeof value != "undefined")
						selected[propertyName] = value;
				}
				return selected;
			});
			return res;
		},
		/* _______________________________________________ WARNING : NOT IMPLEMENTED WITH PREFIX*/
		unselect: function() {
			var args = arguments;
			var argc = arguments.length;
			return this.map(function(object) {
				var selected = {};
				for (var i in object)
					if (object.hasOwnProperty(i))
						selected[i] = object[i];
				for (var i = 0; i < argc; i++)
					delete selected[args[i]];
				return selected;
			});
		},
		values: function(first) {
			if (arguments.length == 1)
				return this.map(function(object) {
					return retrieve(object, first);
				});
			var args = arguments;
			var argc = arguments.length;
			return this.map(function(object) {
				var realObject = retrieve(object);
				var selected = [];
				if (argc === 0) {
					for (var i in realObject)
						if (realObject.hasOwnProperty(i))
							selected.push(realObject[i]);
				} else
					for (var i = 0; i < argc; i++) {
						var propertyName = args[i];
						selected.push(realObject[propertyName]);
					}
				return selected;
			});
		},
		limit: function(limit, start, maxCount) {
			var totalCount = this.length;
			start = start || 0;
			var sliced = this.slice(start, start + limit);
			if (maxCount) {
				sliced.start = start;
				sliced.end = start + sliced.length - 1;
				sliced.totalCount = Math.min(totalCount, typeof maxCount === "number" ? maxCount : Infinity);
			}
			return sliced;
		},
		distinct: function() {
			var primitives = {};
			var needCleaning = [];
			var newResults = this.filter(function(value) {
				value = retrieve(value);
				if (value && typeof value == "object") {
					if (!value.__found__) {
						value.__found__ = function() {}; // get ignored by JSON serialization
						needCleaning.push(value);
						return true;
					}
					return false;
				}
				if (!primitives[value]) {
					primitives[value] = true;
					return true;
				}
				return false;
			});
			needCleaning.forEach(function(object) {
				delete object.__found__;
			});
			return newResults;
		},
		recurse: function(property) {
			// TODO: this needs to use lazy-array
			var newResults = [];

			function recurse(value) {
				if (value.forEach)
					value.forEach(recurse);
				else {
					newResults.push(value);
					if (property) {
						value = value[property];
						if (value && typeof value == "object")
							recurse(value);
					} else
						for (var i in value)
							if (value[i] && typeof value[i] == "object")
								recurse(value[i]);
				}
			}
			recurse(retrieve(this));
			return newResults;
		},
		aggregate: function() {
			var distinctives = [];
			var aggregates = [];
			for (var i = 0; i < arguments.length; i++) {
				var arg = arguments[i];
				if (typeof arg === "function")
					aggregates.push(arg);
				else
					distinctives.push(arg);
			}
			var distinctObjects = {};
			var dl = distinctives.length;
			this.forEach(function(object) {
				object = retrieve(object);
				var key = "";
				for (var i = 0; i < dl; i++)
					key += '/' + object[distinctives[i]];
				var arrayForKey = distinctObjects[key];
				if (!arrayForKey)
					arrayForKey = distinctObjects[key] = [];
				arrayForKey.push(object);
			});
			var al = aggregates.length;
			var newResults = [];
			for (var key in distinctObjects) {
				var arrayForKey = distinctObjects[key];
				var newObject = {};
				for (var i = 0; i < dl; i++) {
					var property = distinctives[i];
					newObject[property] = arrayForKey[0][property];
				}
				for (var i = 0; i < al; i++) {
					var aggregate = aggregates[i];
					newObject[i] = aggregate.call(arrayForKey);
				}
				newResults.push(newObject);
			}
			return newResults;
		},
		between: filter(function(value, range) {
			value = retrieve(value);
			return value >= range[0] && value < range[1];
		}),
		sum: reducer(function(a, b) {
			a = retrieve(a);
			b = retrieve(b);
			return a + b;
		}),
		mean: function(property) {
			return rql.ops.sum.call(this, property) / this.length;
		},
		max: reducer(function(a, b) {
			a = retrieve(a);
			b = retrieve(b);
			return Math.max(a, b);
		}),
		min: reducer(function(a, b) {
			a = retrieve(a);
			b = retrieve(b);
			return Math.min(a, b);
		}),
		count: function() {
			return this.length;
		},
		first: function() {
			return this[0];
		},
		last: function() {
			return this[this.length - 1];
		},
		random: function() {
			return this[Math.round(Math.random() * (this.length - 1))];
		},
		one: function() {
			if (this.length > 1)
				throw new Error("RQLError : More than one object found");
			return this[0];
		}
	};

	function rqlNodeToFunc(node) {
		if (typeof node === 'object') {
			var name = node.name;
			var args = node.args;
			if (node.forEach)
				return node.map(rqlNodeToFunc);
			else {
				var b = args[0],
					path = null;
				if (args.length == 2) {
					path = b;
					b = args[1];
				}
				var func = null;
				var isFilter = false;
				switch (name) {
					case "eq":
						isFilter = true;
						func = function eq(a) {
							return (retrieve(a, path) || undefined) === b;
						};
						break;
					case "ne":
						isFilter = true;
						func = function ne(a) {
							return (retrieve(a, path) || undefined) !== b;
						};
						break;
					case "le":
						isFilter = true;
						func = function le(a) {
							return (retrieve(a, path) || undefined) <= b;
						};
						break;
					case "ge":
						isFilter = true;
						func = function ge(a) {
							return (retrieve(a, path) || undefined) >= b;
						};
						break;
					case "lt":
						isFilter = true;
						func = function lt(a) {
							return (retrieve(a, path) || undefined) < b;
						};
						break;
					case "gt":
						isFilter = true;
						func = function gt(a) {
							return (retrieve(a, path) || undefined) > b;
						};
						break;
					default:
						var ops = rql.ops[name];
						if (!ops)
							throw new Error("RQLError : no operator found in rql with : " + name);
						if (args && args.length > 0) {
							args = args.map(rqlNodeToFunc);
							func = function() {
								return ops.apply(this, args);
							};
						} else
							func = function() {
								return ops.call(this);
							};
				}
				if (isFilter)
					return function() {
						var r = this.filter(func);
						return r;
					};
				else
					return func;
			}
		} else
			return node;
	}

	function retrieve(obj, path) {
		if (!path) {
			return obj;
		}
		var splitted = path.split(".");
		var tmp = obj;
		if (!tmp)
			return tmp;
		var len = splitted.length,
			needtype = false;
		if (len < 5) {
			var res;
			switch (len) {
				case 1:
					res = tmp[splitted[0]];
					break;
				case 2:
					res = tmp[splitted[0]] && tmp[splitted[0]][splitted[1]];
					break;
				case 3:
					res = tmp[splitted[0]] && tmp[splitted[0]][splitted[1]] && tmp[splitted[0]][splitted[1]][splitted[2]];
					break;
				case 4:
					res = tmp[splitted[0]] && tmp[splitted[0]][splitted[1]] && tmp[splitted[0]][splitted[1]][splitted[2]] && tmp[splitted[0]][splitted[1]][splitted[2]][splitted[3]];
					break;
			}
			return res;
		}
		tmp = tmp[splitted[0]] && tmp[splitted[0]][splitted[1]] && tmp[splitted[0]][splitted[1]][splitted[2]] && tmp[splitted[0]][splitted[1]][splitted[2]][splitted[3]];
		if (typeof tmp === 'undefined')
			return undefined;
		var count = 4,
			part = splitted[count];
		while (part && tmp[part]) {
			tmp = tmp[part];
			part = splitted[++count];
		}
		if (count === len) {
			return tmp;
		}
		return undefined;
	}

	function filter(condition, not) {
		var filtr = function(property, second) {
			if (typeof second == "undefined") {
				second = property;
				property = undefined;
			}
			var args = arguments;
			var filtered = [];
			for (var i = 0, length = this.length; i < length; i++) {
				var item = this[i];
				if (condition(evaluateProperty(item, property), second))
					filtered.push(item);
			}
			return filtered;
		};
		filtr.condition = condition;
		return filtr;
	}

	function reducer(func) {
		return function(property) {
			if (property)
				return this.map(function(object) {
					return retrieve(object, property);
				}).reduce(func);
			else
				return this.reduce(func);
		};
	}

	function evaluateProperty(object, property) {
		if (property && property.forEach)
			return retrieve(object, decodeURIComponent(property));
		if (typeof property === 'undefined')
			return retrieve(object);
		return retrieve(object, decodeURIComponent(property));
	}
	module.exports = rql;
})();

},{"rql/parser":14}],13:[function(require,module,exports){
(function() {
	'use strict';
	var rql = require('./rql-array'),
		Context = require('../lib/context'),
		View = require('../lib/view'),
		Template = require('../lib/template'),
		interpolable = require('../lib/interpolable');

	Template.prototype.rqlView = function(path, expr, name) {
		return this.done(function(context) {
			context.rqlView(path, expr, name);
		}, true);
	};
	View.prototype.rqlView = Context.prototype.rqlView = function(path, name, expr) {
		expr = interpolable.interpolable(expr);
		this.data[name] = [];
		var self = this;
		this.subscribe(path, function(type, p, value, key) {
			value = (type === 'push' || type === 'removeAt') ? self.get(path) : value;
			var r = rql(value, expr.__interpolable__ ? expr.output(self) : expr);
			self.set(name, r);
		});
		this.set(name, rql(this.get(path), expr.__interpolable__ ? expr.output(self) : expr));
		if (expr.__interpolable__)
			expr.subscribeTo(this, function(type, p, xpr) {
				self.set(name, rql(self.get(path), xpr));
			});
		return this;
	};
})();

},{"../lib/context":3,"../lib/interpolable":5,"../lib/template":8,"../lib/view":10,"./rql-array":12}],14:[function(require,module,exports){
/**
 * This module provides RQL parsing. For example:
 * var parsed = require("./parser").parse("b=3&le(c,5)");
 */
({define:typeof define!="undefined"?define:function(deps, factory){module.exports = factory(exports, require("./util/contains"));}}).
define(["exports", "./util/contains"], function(exports, contains){

var operatorMap = {
	"=": "eq",
	"==": "eq",
	">": "gt",
	">=": "ge",
	"<": "lt",
	"<=": "le",
	"!=": "ne"
};


exports.primaryKeyName = 'id';
exports.lastSeen = ['sort', 'select', 'values', 'limit'];
exports.jsonQueryCompatible = true;

function parse(/*String|Object*/query, parameters){
	if (typeof query === "undefined" || query === null)
		query = '';
	var term = new exports.Query();
	var topTerm = term;
	topTerm.cache = {}; // room for lastSeen params
	if(typeof query === "object"){
		if(query instanceof exports.Query){
			return query;
		}
		for(var i in query){
			var term = new exports.Query();
			topTerm.args.push(term);
			term.name = "eq";
			term.args = [i, query[i]];
		}
		return topTerm;
	}
	if(query.charAt(0) == "?"){
		throw new URIError("Query must not start with ?");
	}
	if(exports.jsonQueryCompatible){
		query = query.replace(/%3C=/g,"=le=").replace(/%3E=/g,"=ge=").replace(/%3C/g,"=lt=").replace(/%3E/g,"=gt=");
	}
	if(query.indexOf("/") > -1){ // performance guard
		// convert slash delimited text to arrays
		query = query.replace(/[\+\*\$\-:\w%\._]*\/[\+\*\$\-:\w%\._\/]*/g, function(slashed){
			return "(" + slashed.replace(/\//g, ",") + ")";
		});
	}
	// convert FIQL to normalized call syntax form
	query = query.replace(/(\([\+\*\$\-:\w%\._,]+\)|[\+\*\$\-:\w%\._]*|)([<>!]?=(?:[\w]*=)?|>|<)(\([\+\*\$\-:\w%\._,]+\)|[\+\*\$\-:\w%\._]*|)/g,
	                     //<---------       property        -----------><------  operator -----><----------------   value ------------------>
			function(t, property, operator, value){
		if(operator.length < 3){
			if(!operatorMap[operator]){
				throw new URIError("Illegal operator " + operator);
			}
			operator = operatorMap[operator];
		}
		else{
			operator = operator.substring(1, operator.length - 1);
		}
		return operator + '(' + property + "," + value + ")";
	});
	if(query.charAt(0)=="?"){
		query = query.substring(1);
	}
	var leftoverCharacters = query.replace(/(\))|([&\|,])?([\+\*\$\-:\w%\._]*)(\(?)/g,
	                       //    <-closedParan->|<-delim-- propertyOrValue -----(> |
		function(t, closedParan, delim, propertyOrValue, openParan){
			if(delim){
				if(delim === "&"){
					setConjunction("and");
				}
				if(delim === "|"){
					setConjunction("or");
				}
			}
			if(openParan){
				var newTerm = new exports.Query();
				newTerm.name = propertyOrValue;
				newTerm.parent = term;
				call(newTerm);
			}
			else if(closedParan){
				var isArray = !term.name;
				term = term.parent;
				if(!term){
					throw new URIError("Closing paranthesis without an opening paranthesis");
				}
				if(isArray){
					term.args.push(term.args.pop().args);
				}
			}
			else if(propertyOrValue || delim === ','){
				term.args.push(stringToValue(propertyOrValue, parameters));

				// cache the last seen sort(), select(), values() and limit()
				if (contains(exports.lastSeen, term.name)) {
					topTerm.cache[term.name] = term.args;
				}
				// cache the last seen id equality
				if (term.name === 'eq' && term.args[0] === exports.primaryKeyName) {
					var id = term.args[1];
					if (id && !(id instanceof RegExp)) id = id.toString();
					topTerm.cache[exports.primaryKeyName] = id;
				}
			}
			return "";
		});
	if(term.parent){
		throw new URIError("Opening paranthesis without a closing paranthesis");
	}
	if(leftoverCharacters){
		// any extra characters left over from the replace indicates invalid syntax
		throw new URIError("Illegal character in query string encountered " + leftoverCharacters);
	}

	function call(newTerm){
		term.args.push(newTerm);
		term = newTerm;
		// cache the last seen sort(), select(), values() and limit()
		if (contains(exports.lastSeen, term.name)) {
			topTerm.cache[term.name] = term.args;
		}
	}
	function setConjunction(operator){
		if(!term.name){
			term.name = operator;
		}
		else if(term.name !== operator){
			throw new Error("Can not mix conjunctions within a group, use paranthesis around each set of same conjuctions (& and |)");
		}
	}
    function removeParentProperty(obj) {
    	if(obj && obj.args){
	    	delete obj.parent;
	    	var args = obj.args;
			for(var i = 0, l = args.length; i < l; i++){
		    	removeParentProperty(args[i]);
		    }
    	}
        return obj;
    };
    removeParentProperty(topTerm);
    return topTerm;
};

exports.parse = exports.parseQuery = parse;

/* dumps undesirable exceptions to Query().error */
exports.parseGently = function(){
	var terms;
	try {
		terms = parse.apply(this, arguments);
	} catch(err) {
		terms = new exports.Query();
		terms.error = err.message;
	}
	return terms;
}

exports.commonOperatorMap = {
	"and" : "&",
	"or" : "|",
	"eq" : "=",
	"ne" : "!=",
	"le" : "<=",
	"ge" : ">=",
	"lt" : "<",
	"gt" : ">"
}
function stringToValue(string, parameters){
	var converter = exports.converters['default'];
	if(string.charAt(0) === "$"){
		var param_index = parseInt(string.substring(1)) - 1;
		return param_index >= 0 && parameters ? parameters[param_index] : undefined;
	}
	if(string.indexOf(":") > -1){
		var parts = string.split(":",2);
		converter = exports.converters[parts[0]];
		if(!converter){
			throw new URIError("Unknown converter " + parts[0]);
		}
		string = parts[1];
	}
	return converter(string);
};

var autoConverted = exports.autoConverted = {
	"true": true,
	"false": false,
	"null": null,
	"undefined": undefined,
	"Infinity": Infinity,
	"-Infinity": -Infinity
};

exports.converters = {
	auto: function(string){
		if(autoConverted.hasOwnProperty(string)){
			return autoConverted[string];
		}
		var number = +string;
		if(isNaN(number) || number.toString() !== string){
/*			var isoDate = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(date);
			if (isoDate) {
				return new Date(Date.UTC(+isoDate[1], +isoDate[2] - 1, +isoDate[3], +isoDate[4], +isoDate[5], +isoDate[6]));
			}*/
			string = decodeURIComponent(string);
			if(exports.jsonQueryCompatible){
				if(string.charAt(0) == "'" && string.charAt(string.length-1) == "'"){
					return JSON.parse('"' + string.substring(1,string.length-1) + '"');
				}
			}
			return string;
		}
		return number;
	},
	number: function(x){
		var number = +x;
		if(isNaN(number)){
			throw new URIError("Invalid number " + number);
		}
		return number;
	},
	epoch: function(x){
		var date = new Date(+x);
		if (isNaN(date.getTime())) {
			throw new URIError("Invalid date " + x);
		}
		return date;
	},
	isodate: function(x){
		// four-digit year
		var date = '0000'.substr(0,4-x.length)+x;
		// pattern for partial dates
		date += '0000-01-01T00:00:00Z'.substring(date.length);
		return exports.converters.date(date);
	},
	date: function(x){
		var isoDate = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(x);
		if (isoDate) {
			date = new Date(Date.UTC(+isoDate[1], +isoDate[2] - 1, +isoDate[3], +isoDate[4], +isoDate[5], +isoDate[6]));
		}else{
			date = new Date(x);
		}
		if (isNaN(date.getTime())){
			throw new URIError("Invalid date " + x);
		}
		return date;

	},
	"boolean": function(x){
		return x === "true";
	},
	string: function(string){
		return decodeURIComponent(string);
	},
	re: function(x){
		return new RegExp(decodeURIComponent(x), 'i');
	},
	RE: function(x){
		return new RegExp(decodeURIComponent(x));
	},
	glob: function(x){
		var s = decodeURIComponent(x).replace(/([\\|\||\(|\)|\[|\{|\^|\$|\*|\+|\?|\.|\<|\>])/g, function(x){return '\\'+x;}).replace(/\\\*/g,'.*').replace(/\\\?/g,'.?');
		if (s.substring(0,2) !== '.*') s = '^'+s; else s = s.substring(2);
		if (s.substring(s.length-2) !== '.*') s = s+'$'; else s = s.substring(0, s.length-2);
		return new RegExp(s, 'i');
	}
};

// exports.converters["default"] can be changed to a different converter if you want
// a different default converter, for example:
// RP = require("rql/parser");
// RP.converters["default"] = RQ.converter.string;
exports.converters["default"] = exports.converters.auto;

// this can get replaced by the chainable query if query.js is loaded
exports.Query = function(){
	this.name = "and";
	this.args = [];
};
return exports;
});

},{"./util/contains":15}],15:[function(require,module,exports){
({define:typeof define!=='undefined'?define:function(deps, factory){module.exports = factory(exports);}}).
define([], function(){
return contains;

function contains(array, item){
	for(var i = 0, l = array.length; i < l; i++){
		if(array[i] === item){
			return true;
		}
	}
}
});

},{}]},{},[1])(1)
});