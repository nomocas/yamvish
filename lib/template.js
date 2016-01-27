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

function execEngineBlock(templ, block, args, suspendAfter) {
	templ._queue.push({
		engineBlock: block,
		args: args,
		suspendAfter: suspendAfter
	});
	return templ;
}

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
	dom: function(func, args, suspendAfter) {
		return execEngineBlock(this, {
			dom: func
		}, args, suspendAfter);
	},
	string: function(func, args, suspendAfter) {
		return execEngineBlock(this, {
			string: func
		}, args, suspendAfter);
	},
	firstPass: function(func, args, suspendAfter) {
		return execEngineBlock(this, {
			twopass: {
				first: func
			}
		}, args, suspendAfter);
	},
	secondPass: function(func, args, suspendAfter) {
		return execEngineBlock(this, {
			twopass: {
				second: func
			}
		}, args, suspendAfter);
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
		templ = (!templ.__yTemplate__) ? y().use(templ) : templ;
		return this.exec('client', [templ]);
	},
	server: function(templ) {
		templ = (!templ.__yTemplate__) ? y().use(templ) : templ;
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
