(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.y = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
	TODO : 
		parsing 
			from DOM
				still data-*
			from String 				OK

		 .disabled

		if('!initialised', ..., ...) 		// almost done

		integrate filters and expressions

		request and c3po-bridge 			OK

		model validation  

		route

		views pool

		collection filtering view 				OK

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




	Parser : 
		split html texts in static/interpolable atoms
		interpret with new Function() to allow complexe expression

	Should :

		rename _yamvish_binds in _binds 					OK
		rename all privates vars with _*

		for each template handler : 
		add args in queue (through done) and place inner functions outside : no more closure

	Context with * 					OK

		could register to path.*
		and receive the * as key  +  value
		then items[key].reset(value)


	Eacher : 

		hybrid structure ?												OK
			virtual that could contains real DOM node in childNodes

		associate to real DOMNode that execute 'each' the virtual node that hold children  		OK

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


		arrows everywhere

		arguments manip

		simple interpolation

		classes

		...


 */


//____________________________________________________ YAMVISH


// core
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
var interpolable = require('./lib/interpolable');
y.interpolable = interpolable.interpolable;
y.Interpolable = interpolable.Interpolable;

// parsers
y.dom = require('./lib/parsers/dom-to-template');
y.html = require('./lib/parsers/html-to-template');
y.expression = require('./lib/parsers/expression');

// Plugins 
var router = require('./plugins/router');
for (var i in router)
	y[i] = router[i];
y.c3po = require('./plugins/c3po-bridge');
y.rql = require('./plugins/rql');
y.aright = require('./plugins/validation');

//________________________________________________ END VIEW

y.mainContext = null;
y.components = {};
y.addComponent = function(name, template /* or view instance */ ) {
	y.components[name] = template;
};

module.exports = y;

},{"./lib/container":2,"./lib/context":3,"./lib/interpolable":6,"./lib/parsers/dom-to-template":7,"./lib/parsers/expression":8,"./lib/parsers/html-to-template":10,"./lib/pure-node":11,"./lib/template":12,"./lib/utils":13,"./lib/view":14,"./lib/virtual":15,"./plugins/c3po-bridge":23,"./plugins/router":24,"./plugins/rql":25,"./plugins/validation":26}],2:[function(require,module,exports){
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
	this.promises = [];
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
	},
	then: function(success, error) {
		if (this.promises.length) {
			this.promise = Promise.all(this.promises);
			this.promises = [];
			return this.promise.then(success, error);
		}
		if (this.promise)
			return this.promise.then(success, error);
		return Promise.resolve([]).then(success, error);
	},
	'catch': function(error) {
		if (this.promises.length) {
			this.promise = Promise.all(this.promises);
			this.promises = [];
			return this.promise['catch'](error);
		}
		if (this.promise)
			return this.promise['catch'](error);
		return Promise.resolve([]);
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

},{"./emitter":4,"./pure-node":11,"./utils":13}],3:[function(require,module,exports){
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
		else if (path[0] == '$parent') {
			if (!this.parent)
				throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
			return this.parent.get(path.slice(1));
		} else
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
	},
	setAsync: function(path, promise) {
		var self = this;
		return promise.then(function(s) {
			self.set(path, s);
		}, function(e) {
			console.error('error while Context.setAsync : ', e);
			throw e;
		});
	}
};


function notifyUpstreams(space, type, path, value, index) {
	for (var i = 0, len = space._upstreams.length; i < len; ++i)
		space._upstreams[i](type, path, value, index);
}

module.exports = Context;

},{"./utils":13}],4:[function(require,module,exports){
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

/**
 * addslashes
capitalize
date
default
escape
first
groupBy
join
json
last
lower
raw
replace
reverse
safe
sort
striptags
title
uniq
upper
url_encode
url_decode

Incode Filter Usage
y.filter('my value').lower().date('yy/mm/dd');
 */

var utils = require('./utils');

//_______________________________________________________ TEMPLATE

function Filter(f) {
	this._queue = f ? f._queue.slice() : [];
};

Filter.prototype = {
	//_____________________________ APPLY filter ON something
	call: function(callee, context) {
		return utils.execFilterQueue(callee, this._queue, context);
	},
	//_____________________________ BASE Filter handler (every template handler is from one of those two types (done or catch))
	done: function(callback) {
		this._queue.push({
			type: 'done',
			fn: callback
		});
		return this;
	},
	lower: function() {
		return this.done(function(input) {
			return input.toLowerCase();
		});
	},
	date: function(format) {
		// use dateFormat from http://blog.stevenlevithan.com/archives/date-time-format
		// ensure it is loaded before use
		return this.done(function(input) {
			return new Date(input).format(format);
		});
	}
};


module.exports = Filter;

},{"./utils":13}],6:[function(require,module,exports){
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
			self = this,
			willFire,
			len = this.dependencies.length;
		for (var i = 0; i < len; ++i)
			binds.push(context.subscribe(this.dependencies[i], function(type, path, newValue) {
				if (self.directOutput)
					callback(type, path, newValue);
				else if (len === 1)
					callback(type, path, self.output(context));
				else if (!willFire)
					willFire = setTimeout(function() {
						if (willFire) {
							willFire = null;
							callback(type, path, self.output(context));
						}
					}, 1);
			}));
		return function() { // unbind all
			willFire = null;
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

},{}],7:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var elenpi = require('elenpi/index'),
	r = elenpi.r,
	Parser = elenpi.Parser,
	Filter = require('../filter');

var templateCache = {};
var filterCache = {};

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
	}),

	args: r().zeroOrOne(null,
		r()
		.regExp(/^\s*\(\s*/)
		.done(function(string, descriptor) {
			descriptor.arguments = [];
			return string;
		})
		.zeroOrMore(null,
			r().oneOf(['integer', 'bool', 'singlestring', 'doublestring']),
			r().regExp(/^\s*,\s*/)
		)
		.regExp(/^\s*\)/)
	),

	//_____________________________________
	// {{ my.var | filter().filter2(...) }}
	// {{ my.func(arg, ...) }}
	expression: r()
		.done(function(string, descriptor) {
			descriptor.keys = [];
			return string;
		})
		.space()
		.oneOrMore(null,
			r().regExp(/^[\w-_]+/, false, function(descriptor, cap) {
				descriptor.keys.push(cap[0]);
			}),
			r().regExp(/^\s*\.\s*/)
		)
		.rule('args')
		.zeroOrOne(null, r().regExp(/^\s*\|\s*/).rule('filters'))
		.space(),

	//_____________________________________
	// filter().filter2(...).filter3.filter4(...)
	filters: r()
		.space()
		.zeroOrMore('filters',
			r().rule('filter'),
			r().regExp(/^\s*\.\s*/)
		)
		.done(function(string, descriptor) {
			if (descriptor.filters)
				descriptor.filters = compile(descriptor.filters, Filter);
			return string;
		}),

	filter: r()
		.regExp(/^[\w-_]+/, false, 'method') // method name
		.rule('args'),

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
				t = compile(descriptor.calls, this.Template);
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
				r().oneOf(['integer', 'bool', 'singlestring', 'doublestring', 'templates']),
				r().regExp(/^\s*,\s*/)
			)
			.regExp(/^\s*\)/)
		)
};

var parser = new Parser(rules, 'expression');

function compile(calls, Chainable) {
	var ch = new Chainable();
	for (var i = 0, len = calls.length; i < len; ++i) {
		var call = calls[i];
		ch[call.method].apply(ch, call.arguments);
	}
	return ch;
}

parser.parseTemplate = function(string) {
	if (templateCache[string] !== undefined)
		return templateCache[string].calls;
	var result = templateCache[string] = parser.parse(string, 'templates');
	if (result === false)
		return false;
	return result.calls;
};

parser.parseFilter = function(string) {
	if (filterCache[string] !== undefined)
		return filterCache[string].filters;
	var result = filterCache[string] = parser.parse(string, 'filters');
	if (result === false)
		return false;
	return result.filters;
};

module.exports = parser;

/*
console.log(y.expression.parse("user.name(12, 'hello') | date('dd-mm-yy').lower", 'expression'));
console.log(y.expression.parse("user.name(12, 'hello') | date.lower", 'expression'));
console.log(y.expression.parse("user.name | date('dd-mm-yy').lower"));
console.log(y.expression.parse("user.name(12, 'hello') | lower", 'expression'));
console.log(y.expression.parse("date('dd-mm-yy').lower", 'filters'));
console.log(y.html.parse('<div class="bloupi"></div>'));
console.log(y.expression.parseTemplate("click ( '12', 14, true, p(2, 4, span( false).p())). div(12345)"));
 */

},{"../filter":5,"elenpi/index":18}],9:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

/**
 * Common HTML5 elenpi rules use din both html-to-template and html-to-virtual parsers
 * @type {[type]}
 */
var r = require('elenpi').r; // elenpi new rule shortcut

var rules = {
	// html5 unstrict self closing tags : 
	openTags: /(br|input|img|area|base|col|command|embed|hr|img|input|keygen|link|meta|param|source|track|wbr)/,

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
			if (index == -1)
				throw new Error('script tag badly closed.');
			if (index)
				descriptor.scriptContent = string.substring(0, index);
			return string.substring(index + 9);
		})
};

module.exports = rules;

},{"elenpi":18}],10:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var elenpi = require('elenpi'),
	r = elenpi.r,
	Parser = elenpi.Parser,
	utils = require('../utils.js'),
	Template = require('../template.js'),
	expression = require('./expression'),
	htmlRules = require('./html-common-rules');

var rules = {
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
		.regExp(/^<([\w-_]+)\s*/, false, function(descriptor, cap) {
			descriptor.tagName = cap[1].toLowerCase();
		})
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
				descriptor._eachTemplate = new Template();
				var ok = this.exec(string, descriptor._eachTemplate, this.rules.children); // to _eachTemplate
				if (ok === false)
					return false;
				// close tag
				return this.exec(ok, descriptor, this.rules.tagEnd);
			}),
			// strict self closed tag
			r().regExp(/^\/>/)
		])
		.done(function(string, descriptor) {
			var eachTemplate = descriptor._eachTemplate,
				attributesTemplate = descriptor._attributesTemplate;
			if (eachTemplate)
				if (!attributesTemplate._hasEach)
					attributesTemplate._queue = attributesTemplate._queue.concat(eachTemplate._queue);
				else
					attributesTemplate._queue.unshift({
						// small hack to define _eachTemplate in virtual or DOM element before 'each' execution
						type: 'done',
						fn: function(string) {
							this._eachTemplate = eachTemplate;
							return string;
						}
					});
			descriptor.tag(descriptor.tagName, attributesTemplate);
			delete descriptor._attributesTemplate;
			delete descriptor._eachTemplate;
			delete descriptor.tagName;
			return string;
		}),

	attributes: r().zeroOrMore(null,
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
					if (template !== false) {
						descriptor._queue = descriptor._queue.concat(template._queue);
						descriptor._hasEach = descriptor._hasEach || template._hasEach;
					} else
						throw new Error('data-template attribute parsing failed : ' + value);
					break;
				case 'id':
					if (!value)
						break;
					descriptor.id(value);
					break;
				default:
					descriptor.attr(attrName, value);
					break;
			}
		})
	)
};

rules = utils.merge(htmlRules, rules);

var parser = new Parser(rules, 'children');

parser.createDescriptor = function() {
	return new Template();
};

module.exports = parser;

},{"../template.js":12,"../utils.js":13,"./expression":8,"./html-common-rules":9,"elenpi":18}],11:[function(require,module,exports){
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

},{"./utils":13}],12:[function(require,module,exports){
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

	function execHandler(callee, fn, context, factory, promises, error) {
		try {
			fn.call(callee, context, factory, promises, error);
		} catch (e) {
			return e;
		}
	}

	function execQueue(callee, queue, context, factory, promises, error) {
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
				execHandler(callee, handler.toElement, context, factory, promises, error);
				return;
			} else {
				if (handler.type === 'catch' || !handler.toElement) {
					handler = queue[nextIndex];
					continue;
				}
				r = execHandler(callee, handler.toElement, context, factory, promises);
			}
			if (r)
				error = r;
			handler = queue[nextIndex];
		}
		if (error)
			throw error;
	}

	Template.prototype = {
		call: function(caller, context, factory, promises) {
			execQueue(caller, this._queue, context, factory || (utils.isServer ? Virtual : document), promises);
		},
		toElement: function(context, factory, promises) {
			promises = promises || [];
			var caller = new Container({
				factory: factory
			});
			execQueue(caller, this._queue, context, factory || (utils.isServer ? Virtual : document), promises);
			if (promises.length)
				caller.promises = promises;
			return caller;
		},
		toString: function(context, descriptor, promises) {
			descriptor = descriptor ||  new StringOutputDescriptor();
			for (var i = 0, len = this._queue.length; i < len; ++i)
				if (this._queue[i].toString)
					this._queue[i].toString(context, descriptor, promises);
			return descriptor.children;
		},
		//_____________________________ BASE Template handler (every template handler is from one of those two types (done or catch))
		exec: function(toElement, toString) {
			this._queue.push({
				type: 'exec',
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
			return this.exec(function(context, factory, promises) {
				var ok = condition,
					self = this;
				var exec = function(type, path, ok) {
					if (ok)
						return trueCallback.call(self, context, factory, promises);
					else if (falseCallback)
						return falseCallback.call(self, context, factory, promises);
				};
				if (condition && condition.__interpolable__) {
					ok = condition.output(context);
					(this._binds = this._binds || []).push(condition.subscribeTo(context, exec));
				} else if (type === 'function')
					ok = condition.call(this, context);
				return exec('set', ok);
			}, function(context, descriptor, promises) {
				var ok;
				if (condition && condition.__interpolable__)
					ok = condition.output(context);
				else if (type === 'function')
					ok = condition.call(this, context);
				if (ok)
					return trueCallback.toString(context, descriptor, promises);
				else if (falseCallback)
					return falseCallback.toString(context, descriptor, promises);
			});
			return this;
		},
		//________________________________ CONTEXT and Assignation
		set: function(path, value) {
			return this.exec(function(context) {
				if (!context)
					throw utils.produceError('no context avaiable to set variable in it. aborting.', this);
				context.set(path, value);
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
		setHandler: function(name, handler) {
			return this.exec(function(context) {
				(context.handlers = context.handlers || {})[name] = handler;
			});
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
			return this.exec(function(context, factory, promises) {
				// data, handlers, parent, path
				var ctx = new Context({
					data: typeof path === 'string' ? context.get(path) : path,
					parent: context,
					path: path
				})
				template.call(this, ctx, factory, promises);
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
			if (typeof value === 'string')
				value = interpolable(value);
			return this.exec(function(context) {
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
				function(context, factory, promises) {
					var node = factory.createElement(name),
						promises = [],
						p;
					for (var i = 0, len = args.length; i < len; ++i) {
						p = args[i].call(node, this.childrenContext || context, factory, promises);
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
				function(context, factory, promises) {
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
						template.call(child, ctx, factory, promises);
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

},{"./container":2,"./context":3,"./interpolable":6,"./parsers/dom-to-template":7,"./pure-node":11,"./utils":13,"./virtual":15}],13:[function(require,module,exports){
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



function execFilterQueue(callee, queue, arg) {
	var handler = queue[0],
		nextIndex = 0,
		r = arg;
	while (handler) {
		r = handler.fn.call(callee, r);
		handler = queue[++nextIndex];
	}
	return r;
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
	execFilterQueue: execFilterQueue,
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

},{}],14:[function(require,module,exports){
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
	this.promises = [];
}
utils.mergeProto(Template.prototype, View.prototype);
utils.mergeProto(Context.prototype, View.prototype);
utils.mergeProto(Container.prototype, View.prototype);
View.prototype.exec = function(fn) {
	fn.call(this, this, this.factory || (utils.isServer ? Virtual : document), this.promises); // apply directly toElement handler on this
	return this;
};
View.prototype.destroy = function() {
	Container.prototype.destroy.call(this);
	Context.prototype.destroy.call(this);
};
delete View.prototype['catch'];
delete View.prototype.call;
delete View.prototype.toElement;
delete View.prototype.context;
delete View.prototype.id;
delete View.prototype.attr;
delete View.prototype.setClass;
delete View.prototype.visible;
delete View.prototype.css;
delete View.prototype.val;
delete View.prototype.contentEditable;

module.exports = View;

},{"./container":2,"./context":3,"./template":12,"./utils":13,"./virtual":15}],15:[function(require,module,exports){
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

},{"./emitter":4,"./pure-node":11,"./utils":13}],16:[function(require,module,exports){
/**
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 *
 */
(function(global) {
	'use strict';

	var replaceShouldBeRegExp = /%s/g;

	function error(errors, rule, parent, key, path, shouldBe) {
		if (path && key)
			path += '.';
		path = key ? (path + key) : path;

		if (!path)
			path = '.';

		errors.valid = false;
		errors.map[path] = errors.map[path] || {
			value: key ? parent[key] : parent,
			errors: []
		};
		var msg = i18n(rule);
		if (!msg)
			msg = 'missing error message for ' + rule;
		if (shouldBe)
			msg = msg.replace(replaceShouldBeRegExp, shouldBe);
		errors.map[path].errors.push(msg);
		return false;
	}

	var i18n = function(rule, language) {
		var space = i18n.data[language || i18n.currentLanguage];
		return space[rule];
	};

	i18n.currentLanguage = 'en';
	i18n.data = {
		en: {
			string: "should be a string",
			object: "should be an object",
			array: "should be an array",
			'boolean': "should be a boolean",
			number: "should be a number",
			'null': "should be null",
			'enum': "enum failed (should be one of : %s)",
			equal: "equality failed (should be : %s)",
			format: "format failed",
			unmanaged: "unmanaged property",
			missing: "missing property",
			minLength: "too short (length should be at least : %s)",
			maxLength: "too long (length should be at max : %s)",
			minimum: "too small (should be at minimum : %s)",
			maximum: "too big (should be at max : %s)"
		}
	};

	var formats = {
		email: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i
	};

	function is(type) {
		return function() {
			return this.exec('this', function(input, path) {
				if (typeof input !== type)
					return error(this, type, input, null, path, type);
				return true;
			});
		};
	}

	function prop(type) {
		return function(name, rule) {
			return this.exec(name, function(input, path) {
				if (typeof input[name] === 'undefined') {
					if (!rule || rule.required !== false)
						return error(this, 'missing', input, name, path);
					return true;
				}
				if (typeof input[name] !== type)
					return error(this, type, input, name, path, type);
				if (!rule)
					return true;
				return rule.call(this, input[name], path ? (path + '.' + name) : name);
			});
		};
	}

	//_______________________________ VALIDATOR

	var Validator = function() {
		this._rules = {};
	};

	Validator.prototype = {
		validate: function(input) {
			var errors = {
				valid: true,
				map: {}
			};
			this.call(errors, input, '');
			if (errors.valid)
				return true;
			errors.value = input;
			return errors;
		},
		call: function(errors, entry, path) {
			var ok = true;

			if (this.required !== false && typeof entry === 'undefined')
				return error(errors, 'missing', entry, null, path);

			if (this._rules['this'])
				this._rules['this'].forEach(function(rule) {
					ok = ok && rule.call(errors, entry, path);
				});

			if (!ok)
				return false;

			if (typeof entry !== 'object' || entry.forEach)
				return ok;

			var keys = {},
				i;
			for (i in entry)
				keys[i] = true;

			for (i in this._rules)
				if (i === 'this')
					continue;
				else {
					var k = this._rules[i].call(errors, entry, path);
					keys[i] = false;
					ok = ok && k;
				}

			for (i in keys)
				if (keys[i])
					ok = error(errors, 'unmanaged', entry, i, path);
			return ok;
		},
		exec: function(key, rule) {
			if (typeof rule === 'string')
				rule = rules[rule];
			if (key === 'this')
				(this._rules[key] = this._rules[key] || []).push(rule);
			else
				this._rules[key] = rule;
			return this;
		},
		rule: function(key, rule) {
			if (!rule) {
				rule = key;
				key = null;
			}
			if (typeof rule === 'string')
				rule = rules[rule];
			return this.exec(key || 'this', function(input, path) {
				input = key ? input[key] : input;
				if (key)
					path = path ? (path + '.' + key) : key;
				return rule.call(this, input, path);
			});
		},
		// ___________________________________ 
		required: function(yes) {
			this.required = yes;
			return this;
		},
		minLength: function(min) {
			return this.exec('this', function(input, path) {
				if (input.length < min)
					return error(this, 'minLength', input, null, path, min);
				return true;
			});
		},
		maxLength: function(max) {
			return this.exec('this', function(input, path) {
				if (input.length > max)
					return error(this, 'maxLength', input, null, path, max);
				return true;
			});
		},
		minimum: function(min) {
			return this.exec('this', function(input, path) {
				if (input < min)
					return error(this, 'minimum', input, null, path, min);
				return true;
			});
		},
		maximum: function(max) {
			return this.exec('this', function(input, path) {
				if (input > max)
					return error(this, 'maximum', input, null, path, max);
				return true;
			});
		},
		format: function(exp) {
			if (typeof exp === 'string')
				exp = formats[exp];
			return this.exec('this', function(input, path) {
				if (!exp.test(input))
					return error(this, 'format', input, null, path);
				return true;
			});
		},
		enumerable: function(values) {
			return this.exec('this', function(input, path) {
				if (values.indexOf(input) === -1)
					return error(this, 'enum', input, null, path, values.join(', '));
				return true;
			});
		},
		item: function(rule) {
			return this.exec('this', function(input, path) {
				var self = this,
					index = 0,
					ok = true;
				input.forEach(function(item) {
					ok = ok && rule.call(self, item, path + '.' + (index++));
				});
				return ok;
			});
		},
		equal: function(value) {
			return this.exec('this', function(input, path) {
				if (input !== value)
					return error(this, 'equal', input, name, path, value);
			});
		},

		isObject: is('object'),
		object: prop('object'),
		isString: is('string'),
		string: prop('string'),
		func: prop('function'),
		bool: prop('boolean'),
		number: prop('number'),

		isArray: function() {
			return this.exec('this', function(input, path) {
				if (typeof input !== 'object' && !input.forEach)
					return error(this, 'array', input, null, path);
				return true;
			});
		},
		isNull: function() {
			return this.exec('this', function(input, path) {
				if (input !== null)
					return error(this, 'null', input, null, path);
				return true;
			});
		},
		'null': function(name) {
			return this.exec(name, function(input, path) {
				if (input[name] !== null)
					return error(this, 'null', input, name, path);
				return true;
			});
		},
		array: function(name, rule) {
			return this.exec(name, function(input, path) {
				if (typeof input[name] === 'undefined') {
					if (!rule || rule.required !== false)
						return error(this, 'missing', input, name, path);
					return true;
				}
				if (typeof input[name] !== 'object' && !input[name].forEach)
					return error(this, 'array', input, name, path);
				if (!rule)
					return true;
				return rule.call(this, input[name], path ? (path + '.' + name) : name);
			});
		}
	};

	var v = function() {
		return new Validator();
	};

	var rules = {
		email: v().isString().format('email').minLength(6)
	};

	var aright = {
		v: v,
		Validator: Validator,
		rules: rules,
		i18n: i18n,
		formats: formats
	};

	if (typeof module !== 'undefined' && module.exports)
		module.exports = aright;
	else
		global.aright = aright;
})(this);

},{}],17:[function(require,module,exports){
/**
 * c3po : Lightweight but powerful protocols manager.
 *  
 * Aimed to be used both sides (server side and/or browser side) to give real isomorphic approach when designing object that need ressources.
 * 
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * @licence MIT
 */
(function(define) {
	"use strict";
	define("c3po", [], function() {
		var parser = /^([\w-]+)(?:\.([\w-]+)(?:\(([^\)]*)\))?)?::([^$]*)/;

		function parseRequest(request, obj) {
			var match = parser.exec(request);
			if (match) {
				obj.protocol = match[1];
				obj.method = match[2] || "get";
				obj.args = match[3] ? match[3].split(",")
					.map(function(arg) {
						return arg.trim();
					}) : null;
				obj.pointer = match[4];
				obj.interpolable = c3po.interpolator ? c3po.interpolator.isInterpolable(obj.pointer) : false;
			}
		}

		var Request = function(request) {
			this.__c3po__ = true;
			this.original = request;
			if (request && request[0] === '<')
				return;
			parseRequest(request, this);
		};

		function exec(protocol, self, args) {
			if (!protocol[self.method])
				throw new Error("there is no method named " + self.method + " in protocol " + self.protocol + "!");
			return protocol[self.method].apply(protocol, args);
		}

		function getProtocol(name) {
			if (typeof name === 'string') {
				var protocol;
				// first : look in contextualised namespace if any
				if (c3po.fromGlocal)
					protocol = c3po.fromGlocal(name);
				// or look in global namespace
				if (!protocol)
					protocol = c3po.protocols[name];
				if (!protocol)
					throw new Error("no protocol found with : ", name);
				return protocol;
			}
			return name;
		}

		function initialiseProtocol(protocol) {
			return new Promise(function(resolve, reject) {
				var promise = protocol.initialising ? protocol.initialising : protocol.init();
				if (promise && typeof promise.then === 'function') {
					// promised init case
					protocol.initialising = promise.then(function() {
						protocol.initialising = null;
						protocol.initialised = true;
						resolve(protocol);
					}, reject);
				} else {
					protocol.initialised = true;
					resolve(protocol);
				}
			});
		}

		Request.prototype = {
			exec: function(options, context) {
				if (!this.protocol)
					return Promise.resolve(this.original);
				options = options || options;
				var protocol = c3po.protocol(this.protocol),
					uri = (this.interpolable && c3po.interpolator && context) ? c3po.interpolator.interpolate(this.pointer, context) : this.pointer,
					self = this,
					args = this.args ? [].concat(this.args, uri, options) : [uri, options];
				return protocol.then(function(protocol) {
					return exec(protocol, self, args);
				});
			}
		};
		var c3po = {
			Request: Request,
			requestCache: null, // simply set to {} to allow caching
			protocols: {
				dummy: { // dummy:: protocol for test and demo
					get: function(url) {
						return {
							dummy: url
						};
					}
				}
			},
			fromGlocal: null, // to use contextualised protocols namespace. 
			interpolator: null, // to allow request interpolation on get
			protocol: function(name) {
				return new Promise(function(resolve, reject) {
					var protocol = getProtocol(name);
					// manage flattener
					if (protocol._deep_flattener_ && !protocol._deep_flattened_)
						return (protocol._deep_flattening_ ? protocol._deep_flattening_ : protocol.flatten())
							.then(c3po.protocol)
							.then(resolve, reject);
					// manage ocm resolution
					if (protocol._deep_ocm_)
						protocol = protocol();
					// manage initialisation if needed
					if (protocol.init && !protocol.initialised)
						return initialiseProtocol(protocol).then(resolve, reject);
					resolve(protocol);
				});
			},
			get: function(request, options, context) {
				if (!request.__c3po__) {
					if (this.requestCache && this.requestCache[request])
						request = this.requestCache[request];
					else {
						request = new Request(request);
						if (this.requestCache)
							this.requestCache[request.original] = request;
					}
				}
				return request.exec(options, context);
			},
			getAll: function(requests, options, context) {
				return Promise.all(requests.map(function(request) {
					return c3po.get(request, options, context);
				}));
			}
		};

		// module.exports = c3po;
		return c3po;
	});
})(typeof define !== 'undefined' ? define : function(id, deps, factory) { // AMD/RequireJS format if available
	if (typeof module !== 'undefined')
		module.exports = factory(); // CommonJS environment
	else if (typeof window !== 'undefined')
		window[id] = factory(); // raw script, assign to c3po global
	else
		console.warn('"%s" has not been mounted somewhere.', id);
});

},{}],18:[function(require,module,exports){
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
        for (var i = 0, len = rules.length; i < len /*&& string*/ ; ++i) {
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
            if (ok === false || ok.length > 0)
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

},{}],19:[function(require,module,exports){
/**
 * A reimplmentation RQL for JavaScript arrays based on rql/js-array from Kris Zyp (https://github.com/persvr/rql).
 * No more eval or new Function. (it has been made for Adobe Air projects. Adobe Air does not allow eval or new Function)
 *
 * Contains could also check if an array is contained in another array.
 *
 * Could handle dotted path for properties
 * 
 * @example
 * rql([{a:{b:3}},{a:3}], "a.b=3") -> [{a:{b:3}]
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 */
(function(global) {
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
	}

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
	var nextId = 1;
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
				for (var i = 1, term = terms[0]; term; i++) {
					var ar = retrieve(a, term.attribute);
					var br = retrieve(b, term.attribute);
					if (ar != br)
						return term.ascending == ar > br ? 1 : -1;
					term = terms[i];
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
			// corrected with https://github.com/persvr/rql/commit/758ca34f91b7bcd18158bc34ffe0d42ab43747d8
			var items = [],
				idProperty = "__rqlId" + nextId++,
				i, l;
			try {
				for (i = 0; i < arguments.length; i++) {
					var group = arguments[i].call(this);
					l = group.length;
					for (var j = 0; j < l; j++) {
						var item = group[j];
						// use marker to do a union in linear time.
						if (!item[idProperty]) {
							item[idProperty] = true;
							items.push(item);
						}
					}
				}
			} finally {
				// cleanup markers
				for (i = 0, l = items.length; i < l; i++) {
					delete items[idProperty];
				}
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
		unselect: function() {
			var args = arguments;
			var argc = arguments.length;
			return this.map(function(object) {
				var selected = {};
				for (var i in object)
					if (object.hasOwnProperty(i))
						selected[i] = object[i];
				for (var j = 0; j < argc; j++)
					delete selected[args[j]];
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
					for (var j = 0; j < argc; j++) {
						var propertyName = args[j];
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
				for (var j = 0; j < dl; j++) {
					var property = distinctives[j];
					newObject[property] = arrayForKey[0][property];
				}
				for (var k = 0; k < al; k++) {
					var aggregate = aggregates[k];
					newObject[k] = aggregate.call(arrayForKey);
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
			return retrieve(a) + retrieve(b);
		}),
		mean: function(property) {
			return rql.ops.sum.call(this, property) / this.length;
		},
		max: reducer(function(a, b) {
			return Math.max(retrieve(a), retrieve(b));
		}),
		min: reducer(function(a, b) {
			return Math.min(retrieve(a), retrieve(b));
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
		if (!path)
			return obj;
		var splitted = path.split(".");
		var tmp = obj;
		if (!tmp)
			return;
		var count = 0,
			part = splitted[count];
		while (part && tmp[part]) {
			tmp = tmp[part];
			part = splitted[++count];
		}
		if (count === splitted.length)
		// manage Date as in https://github.com/persvr/rql/commit/117a7c94caf9ac99b263c01af6008af61b902f2f
			return (tmp instanceof Date) ? tmp.valueOf() : tmp;
		return;
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
	if (typeof module !== 'undefined' && module.exports)
		module.exports = rql;
	else
		global.orql = rql;
})(this);

},{"rql/parser":20}],20:[function(require,module,exports){
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

},{"./util/contains":21}],21:[function(require,module,exports){
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

},{}],22:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

(function() {
	'use strict';

	var elenpi = require('elenpi/index'),
		r = elenpi.r;

	var casting = {
		i: function(input) { // integer
			var r = parseInt(input, 10);
			return (!isNaN(r) && r !== Infinity) ? r : null;
		},
		f: function(input) { // float
			var r = parseFloat(input);
			return (!isNaN(r) && r !== Infinity) ? r : null;
		},
		b: function(input) { // bool
			if (input === 'true')
				return true;
			if (input === 'false')
				return false;
			return null;
		},
		q: function(input) { // query
			return (input[0] !== '?') ? null : input;
		},
		s: function(input) { // string
			return (input[0] == '?') ? null : input;
		}
	};

	var rules = {
		disjonction: r()
			.regExp(/^\[\s*/)
			.oneOrMore('disjonction',
				r().rule('xpr'),
				r().regExp(/^\s*,\s*/)
			)
			.regExp(/^\s*\]/),

		cast: r()
			.regExp(/^([\w-_]+):/, true, function(descriptor, cap) {
				descriptor.cast = casting[cap[1]];
				if (!descriptor.cast)
					throw new Error('routes : no cast method as : ' + cap[1]);
			}),

		end: r()
			.regExp(/^\$/, false, 'end'),

		steps: r()
			.zeroOrMore('steps',
				r().rule('xpr'),
				r().regExp(/^\//)
			),

		block: r()
			.regExp(/^\(\s*/)
			.rule('steps')
			.regExp(/^\s*\)/),

		key: r()
			.regExp(/^[0-9\w-_\.]+/, false, 'key'),

		xpr: r()
			.oneOf(null, [
				r().regExp(/^\!/, false, 'not'),
				r().regExp(/^\?/, false, 'optional')
			], true)
			.oneOf(null, [r().rule('cast').rule('key'), 'end', 'disjonction', 'block']),

		route: r()
			.regExp(/^\./, true, 'local')
			.regExp(/^\//)
			.rule('steps')
	};

	var parser = new elenpi.Parser(rules, 'route');

	var RouteStep = function(route) {};

	RouteStep.prototype.match = function(descriptor) {
		var ok = false;
		if (descriptor.route.length > descriptor.index) {
			if (this.end) {
				if (descriptor.index === descriptor.route.length)
					ok = true;
			} else if (this.steps) { // block
				ok = this.steps.every(function(step) {
					return step.match(descriptor);
				});
			} else if (this.disjonction) {
				ok = this.disjonction.some(function(step) {
					return step.match(descriptor);
				});
			} else if (this.cast) { // casted variable
				var res = this.cast(descriptor.route[descriptor.index]);
				if (res !== null) {
					descriptor.output[this.key] = res;
					descriptor.index++;
					ok = true;
				}
			} else if (descriptor.route[descriptor.index] === this.key) {
				descriptor.index++;
				ok = true;
			}
		}
		if (this.not)
			ok = !ok;
		else if (!ok && this.optional)
			return true;
		return ok;
	};

	parser.createDescriptor = function() {
		return new RouteStep();
	};

	var Route = function(route) {
		this.parsed = parser.parse(route);
		if (!this.parsed)
			throw new Error('route could not be parsed : ' + route);
	};

	Route.prototype.match = function(descriptor) {
		if (typeof descriptor === 'string') {
			var route = descriptor.split('/');
			if (route[0] === '')
				route.shift();
			if (route[route.length - 1] === '')
				route.pop();
			descriptor = {
				route: route,
				index: 0,
				output: {}
			};
		}
		if (!this.parsed.match(descriptor))
			return false;
		return descriptor;
	};

	module.exports = Route;
})();

},{"elenpi/index":18}],23:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

(function() {
	'use strict';
	var c3po = require('c3po'),
		Context = require('../lib/context'),
		View = require('../lib/view'),
		Template = require('../lib/template'),
		interpolable = require('../lib/interpolable').interpolable;

	function bindMap(map, self, context, factory, promises, before, after, fail) {
		Object.keys(map).forEach(function(i) {
			if (map[i].__interpolable__)
				map[i].subscribeTo(context, function(type, path, value) {
					if (before)
						before.call(self, context, factory, promises);
					context.setAsync(i, c3po.get(value))
						.then(function(s) {
							if (after)
								after.call(self, context, factory, promises);
						}, function(e) {
							if (fail)
								return fail.call(self, context, factory, promises, e);
							throw e;
						});
				});
		});
	};

	View.prototype.load = Template.prototype.load = function(map, arg1, arg2, arg3, arg4) {
		var path, before, after, fail;
		if (typeof map === 'string') {
			path = map;
			map = {};
			map[path] = arg1;
			before = arg2;
			after = arg3;
			fail = arg4;
		} else {
			before = arg1;
			after = arg2;
			fail = arg3;
		}
		for (var i in map)
			map[i] = interpolable(map[i]);

		return this.exec(function(context, factory, promises) {
			var self = this,
				p;
			bindMap(map, this, context, factory, promises, before, after, fail);
			if (before)
				before.call(self, context, factory, promises);
			var pr = [],
				uri;
			for (var i in map) {
				uri = map[i].__interpolable__ ? map[i].output(context) : map[i];
				pr.push(context.setAsync(i, c3po.get(uri)));
			}
			if (pr.length == 1)
				p = pr[0];
			else
				p = Promise.all(pr);
			p.then(function(s) {
				if (after)
					after.call(self, context, factory, promises);
			}, function(e) {
				if (fail)
					return fail.call(self, context, factory, promises, e);
				throw e;
			});
			promises.push(p);
		}, true);
	};


	module.exports = c3po;
})();

},{"../lib/context":3,"../lib/interpolable":6,"../lib/template":12,"../lib/view":14,"c3po":17}],24:[function(require,module,exports){
(function() {
	'use strict';
	var Route = require('routedsl'),
		utils = require('../lib/utils'),
		Context = require('../lib/context'),
		View = require('../lib/view'),
		Template = require('../lib/template'),
		interpolable = require('../lib/interpolable');

	var router = {};

	Template.prototype.route = function(route) {
		route = new Route(route);
		return this.exec(function(context) {
			context.route(route);
		}, true);
	};

	// normally browser only
	router.navigateTo = function(route, title, state) {
		if (!utils.isServer)
			window.history.pushState(state, title  || '', route);
	};

	router.Route = Route;

	Context.prototype.route = View.prototype.route = function(route, adapter) {
		if (typeof route === 'string')
			route = new Route(route);
		if (!this._routes)
			bindRouter(this, adapter);
		(this._routes = this._routes || []).push(route);
		return this;
	};

	function checkRoutes(context, url) {
		context._routes.some(function(route) {
			var descriptor = route.match(url);
			if (descriptor)
				for (var i in descriptor.output)
					context.set(i, descriptor.output[i]);
			return descriptor;
		});
	};

	function bindRouter(context, adapter) {
		if (context._routes)
			return;
		adapter = adapter || (!utils.isServer ? window : null);
		var self = context;
		context._routes = [];

		var popstate = function(e) {
			var url = window.history.location.relative;
			// console.log("* POP STATE : %s - ", url, JSON.stringify(window.history.state));
			self.set('$route', url);
			checkRoutes(self, url);
		};

		// popstate event from back/forward in browser
		adapter.addEventListener('popstate', popstate);

		// hashchange event from back/forward in browser
		// adapter.addEventListener('hashchange', function(e) {
		// 	console.log("* HASH CHANGE " + history.location.hash, " - ", JSON.stringify(history.state));
		// });

		var setstate = function(e) {
			var url = window.history.location.relative;
			// console.log("* SET STATE : %s - ", url, JSON.stringify(window.history.state));
			self.set('$route', url);
			checkRoutes(self, url);
		};

		// setstate event when pushstate or replace state
		adapter.addEventListener('setstate', setstate);

		context._binds.push(function() {
			adapter.removeEventListener('popstate', popstate);
			adapter.removeEventListener('setstate', setstate);
		});
	};

	module.exports = router;
})();

},{"../lib/context":3,"../lib/interpolable":6,"../lib/template":12,"../lib/utils":13,"../lib/view":14,"routedsl":22}],25:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
(function() {
	'use strict';
	var rql = require('orql'),
		Context = require('../lib/context'),
		View = require('../lib/view'),
		Template = require('../lib/template'),
		interpolable = require('../lib/interpolable');

	Template.prototype.rqlView = function(path, expr, name) {
		return this.exec(function(context) {
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

	module.exports = rql;
})();

},{"../lib/context":3,"../lib/interpolable":6,"../lib/template":12,"../lib/view":14,"orql":19}],26:[function(require,module,exports){
/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
(function() {
	'use strict';
	var aright = require('aright'),
		Context = require('../lib/context'),
		View = require('../lib/view'),
		Template = require('../lib/template');

	Template.prototype.validate = function(path, rule) {
		return this.exec(function(context) {
			context.validate(path, rule);
		}, true);
	};
	View.prototype.validate = Context.prototype.validate = function(path, rule) {
		// subscribe on path then use validator to produce errors (if any) and place it in context.data.$error 
		var self = this;

		var applyValidation = function(type, path, value, key) {
			var report;
			if (type === 'push') // validate whole array ?
				report = rule.validate(self.get(path));
			else if (type !== 'removeAt')
				report = rule.validate(value);
			if (report !== true)
				self.set('$error.' + path, report);
			else
				self.del('$error.' + path);
		};

		this.subscribe(path, applyValidation);
		var val = this.get(path);
		if (typeof val !== 'undefined')
			applyValidation('set', path, val);
		return this;
	};

	module.exports = aright;
})();

},{"../lib/context":3,"../lib/template":12,"../lib/view":14,"aright":16}]},{},[1])(1)
});