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
