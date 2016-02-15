/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
"use strict";

var utils = require('./utils'),
	interpolable = require('./interpolable').interpolable,
	Context = require('./context'),
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
	templ._queue.push({
		engineBlock: block,
		args: args,
		suspendAfter: suspendAfter
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
	templ._queue.push({
		type: type, // means engine related
		handler: handler,
		args: args,
		suspendAfter: suspendAfter
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
	//________________________________ CONTEXT and Assignation
	set: function(path, value) {
		return this.context(function(context) {
			context.set(path, value);
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
	newContext: function(data, parent, path) {
		var path;
		if (typeof data === 'string') {
			path = data;
			data = null;
		}
		return this.exec('newContext', [path ? undefined : data, parent, path]);
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
	id: function(value) {
		return this.attr('id', value);
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
	once: function(name, handler) {
		if (typeof handler === 'string')
			handler = listenerParser.parseListener(handler);
		return this.exec('once', [name, handler]);
	},
	off: function(name, handler) {
		return this.exec('off', [name, handler]);
	},
	//___________________________________________ Collection
	each: function(path, templ, emptyTempl) {
		if (!templ)
			throw new Error('yamvish each methods needs a template. (path : ' + path + ')');
		templ = (typeof templ === 'string') ? y().use(templ) : templ;
		if (emptyTempl)
			emptyTempl = (typeof emptyTempl === 'string') ? y().use(emptyTempl) : emptyTempl;
		return this.exec('each', [path, templ, emptyTempl]);
	},
	//_____________________________ Conditional node rendering
	if: function(condition, successTempl, failTempl) {
		successTempl = (typeof successTempl === 'string') ? y().use(successTempl) : successTempl;
		if (failTempl)
			failTempl = (typeof failTempl === 'string') ? y().use(failTempl) : failTempl;
		return this.exec('if', [interpolable(condition), successTempl, failTempl]);
	},
	switch: function(xpr, map) {
		for (var i in map)
			if (typeof map[i] === 'string')
				map[i] = y().text(map[i]);
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
		if (method.__yView__)
			return this.exec('mountHere', [method]);
		else if (method.__yTemplate__)
			this._queue = this._queue.concat(method._queue);
		else
			method.apply(this, args);
		return this;
	},
	// for lazzy people : 
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
	}
};

Template.addAPI = function(api) {
	for (var i in api)
		Template.prototype[i] = api[i];
	return Template;
};

Template.prototype.cl = Template.prototype.setClass;

// Complete tag list
['div', 'span', 'ul', 'li', 'button', 'p', 'form', 'table', 'tr', 'td', 'th', 'section', 'code', 'pre', 'q', 'blockquote', 'style', 'nav', 'article', 'header', 'footer', 'aside', 'label', 'select', 'option']
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
