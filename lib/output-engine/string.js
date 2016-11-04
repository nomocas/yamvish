/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * String output engine.
 *
 * Ultra fast string rendering.
 * Ommits all dom specific stuffs, obviously doesn't produce DOM node, doesn't apply bindings, etc.
 * Only constructs directly the needed string result with minimal work.
 *
 * That allows really FAST execution of template server side. 
 * (on my dev machine :  under nodejs, for a full page with 1250 nodes it takes approximatly 0.250 ms to output as string ;)
 * 
 * Templates are kept as descriptive as needed 
 * to have multiple output engines 
 * that loop through arrays of descriptors 
 * and execute associated pure dedicated functions. 
 * Here pure string output functions.
 *
 * Async warning : 
 * It does not wait for async stuffs while executing template. It uses provided context as if it's fully constructed.
 * In other words : this output engine needs stabilised context. (see context stabilisation in docs).
 * There is a third output engine that manage contexts tree loads and stabilisation before applying string output. (aka twopass engine)
 */
var utils = require('../utils'),
	openTags = require('../parsers/open-tags'),
	strictTags = /span|script|meta|div|i/,
	Context = require('../context').Context,
	Template = require('../template');

// String Output Descriptor (temporary minimal strings holder - only for internal job)
function SOD() {
	this.attributes = '';
	this.classes = '';
	this.children = '';
	this.style = '';
}

// produce final html tag representation
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
	newContext: function(context, descriptor, args) {
		var data = args[0],
			parent = args[1] || context,
			path = args[2];
		descriptor.context = new Context(data, parent, path);
	},
	//_________________________________________ EACH
	each: function(context, descriptor, args) {
		var path = args[0],
			values = (typeof path === 'string') ? context.get(path) : path;
		if (values && values.length) {
			var template = args[1];
			for (var i = 0, len = values.length; i < len; ++i)
				template.toHTMLString(new Context(values[i], context), descriptor);
		} else if (args[2])
			args[2].toHTMLString(context, descriptor);
	},
	eachTemplates: function(context, descriptor, args) {
		var templates = args[0],
			handler = args[1];
		templates.forEach(function(templ) {
			(handler ? handler(templ) : templ).toHTMLString(context, descriptor);
		});
	},
	// ____________________________________ WITH
	with: function(context, descriptor, args) {
		var path = args[0],
			template = args[1];
		var ctx = new Context(typeof path === 'string' ? context.get(path) : path, context, path);
		template.toHTMLString(ctx, descriptor);
	},
	//______________________________________________
	mountIf: function(context, descriptor, args) {
		var ok, condition = args[0],
			successTempl = args[1],
			failTempl = args[2];
		if (condition && condition.__interpolable__)
			ok = condition.output(context);
		else if (typeof condition === 'function')
			ok = condition.call(this, context);
		var sod = new SOD();
		if (ok)
			successTempl.toHTMLString(context, sod);
		else if (failTempl)
			failTempl.toHTMLString(context, sod);
		if (sod.children)
			descriptor.children += sod.children;
	},
	agoraView: function(context, args) {
		// var channel = args[0],
		// template = args[1];
		// console.warn('agoraView has not been implemented yet for string engine.');
	},
	//______________________________________________
	if: function(context, descriptor, args) {
		var ok, condition = args[0],
			successTempl = args[1],
			failTempl = args[2];
		if (condition && condition.__interpolable__)
			ok = condition.output(context);
		else if (typeof condition === 'function')
			ok = condition.call(this, context);
		if (ok)
			successTempl.toHTMLString(context, descriptor);
		else if (failTempl)
			failTempl.toHTMLString(context, descriptor);
	},
	switch: function(context, descriptor, args) {
		var xpr = args[0],
			dico = args[1],
			value = xpr.output(context),
			templ = dico[value] || dico['default'];
		if (templ) {
			var sod = new SOD();
			templ.toHTMLString(context, sod);
			if (sod.children)
				descriptor.children += sod.children;
		}
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
	raw: function(context, descriptor, args) {
		descriptor.children += args[0];
	},
	br: function(context, descriptor) {
		descriptor.children += '<br>';
	},
	//______________________________________________ ATTRIBUTES
	attr: function(context, descriptor, args) {
		var name = args[0],
			value = args[1],
			hasValue = typeof value !== 'undefined';
		descriptor.attributes += ' ' + name + (hasValue ? ('="' + (value.__interpolable__ ? value.output(context) : value) + '"') : '');
	},
	prop: function(context, descriptor, args) {
		var name = args[0],
			value = args[1],
			hasValue = typeof value !== 'undefined';
		descriptor.attributes += ' ' + name + (hasValue ? ('="' + (value.__interpolable__ ? value.output(context) : value) + '"') : '');
	},
	data: function(context, descriptor, args) {
		var name = 'data-' + args[0],
			value = args[1],
			hasValue = typeof value !== 'undefined';
		descriptor.attributes += ' ' + name + (hasValue ? ('="' + (value.__interpolable__ ? value.output(context) : value) + '"') : '');
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
	contentEditable: function(context, descriptor, args) {
		var value = args[1],
			flag = args[2],
			ok = (flag && flag.__interpolable__) ? flag.output(context) : flag;
		if (!!ok)
			descriptor.attributes += ' contenteditable';
		descriptor.children = value.output(context);
	},
	setClass: function(context, descriptor, args) {
		var name = args[0],
			flag = args[1],
			ok = (flag && flag.__interpolable__) ? flag.output(context) : flag;
		if (!!ok)
			descriptor.classes += (descriptor.classes ? ' ' : '') + (name.__interpolable__ ? name.output(context) : name);
	},
	css: function(context, descriptor, args) {
		var prop = args[0],
			value = args[1];
		descriptor.style += prop + ':' + (value.__interpolable__ ? value.output(context) : value);
	},
	visible: function(context, descriptor, args) {
		var flag = args[0],
			val = (flag && flag.__interpolable__) ? flag.output(context) : flag;
		if (!val)
			descriptor.style += 'display:none;';
	},
	//_________________________________ EVENTS
	on: function() {},
	once: function() {},
	off: function() {},
	//_________________________________ CLIENT/SERVER
	client: function(context, descriptor, args) {
		if (context.env.data.isServer)
			return;
		args[0].toHTMLString(context, descriptor);
	},
	server: function(context, descriptor, args) {
		if (!context.env.data.isServer)
			return;
		args[0].toHTMLString(context, descriptor);
	},
	//_______________________________ SUSPEND RENDER
	suspendUntil: function(context, descriptor, args) {
		var xpr = args[0],
			index = args[1],
			templ = args[2],
			val = xpr.__interpolable__ ? xpr.output(context) : xpr,
			rest = new Template(templ._queue.slice(index));
		if (val)
			rest.toHTMLString(context, descriptor);
	},
	container: function(context, descriptor, args) {
		var sod = new SOD(),
			opt = args[0],
			template = args[1];
		template.toHTMLString(context, sod);
		descriptor.children += sod.children;
	},
	log: function() {},
	useFromContext: function(context, descriptor, args) {
		var path = args[0],
			useArgs = args[1],
			name = context.get(path);
		if (name) {
			var output = y().use(name, useArgs).toHTMLString(context);
			descriptor.children += output;
		}
	}
};

Template.prototype.toHTMLString = function(context, descriptor) {
	context = context || new Context();
	descriptor = descriptor ||  new SOD();
	var handler = this._queue[0],
		index = 0,
		f;
	while (handler) {
		f = null;
		switch (handler.type) {
			case '*':
				f = methods[handler.handler];
				break;
			case 'string':
			case 'context':
				f = handler.handler;
				break;
			case 'custom':
				f = handler.handler.string;
				break;
		}
		if (!f) {
			handler = this._queue[++index];
			continue;
		}
		if (f.__yTemplate__)
			f.toHTMLString(descriptor.context || context, descriptor);
		else
			f(descriptor.context || context, descriptor, handler.args);
		if (handler.suspendAfter)
			break;
		handler = this._queue[++index];
	}
	return descriptor.children;
};

module.exports = methods;