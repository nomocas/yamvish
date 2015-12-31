var utils = require('../utils'),
	env = require('../env'),
	Template = require('../template'),
	Context = require('../context'),
	stringEngine = require('./string'),
	SOD = stringEngine.SOD;

var firstMethods = {
	//_________________________________ local context management
	context: function(context, args) {
		var value = args[0],
			parentPath = args[1];
		var childContext = new Context(parentPath ? null : value, context, parentPath ? parentPath : null);
		context.children = context.children || [];
		context.children.push(childContext);
		return childContext;
	},
	// ____________________________________ WITH
	with: function(context, descriptor, args) {
		var path = args[0],
			template = args[1],
			ctx = new Context(typeof path === 'string' ? context.get(path) : path, context, path);
		context.children = context.children || [];
		context.children.push(childContext);
	},
	//_________________________________________ EACH
	each: function(context, args) {
		var path = args[0],
			pathIsString = (typeof path === 'string'),
			data = path,
			contexts = [],
			template = utils.getEachTemplate(this, args[1]);

		var render = function(type, path, value, index) {
			var ctx, ctxs = contexts;
			switch (type) {
				case 'reset':
				case 'set':
					var j = 0;
					for (var len = value.length; j < len; ++j) // reset existing or create new ctx 
						if (ctxs[j]) // reset existing
							ctxs[j].reset(value[j]);
						else { // create new ctx
							ctx = new Context(value[j], this);
							ctxs.push(ctx);
							firstPass(template, ctx);
						}
					if (j < ctxs.length) // delete additional nodes that is not used any more
						ctxs.splice(j);
					break;
				case 'removeAt':
					ctxs.splice(index, 1);
					break;
				case 'push':
					ctx = new Context(value, this)
					ctxs.push(ctx);
					firstPass(template, ctx);
					break;
			}
		};

		if (pathIsString) {
			context.subscribe(path, render);
			context.subscribe(path + '.*', function(type, path, value, key) {
				var ctx = contexts[key];
				if (ctx)
					return ctx.reset(value);
			});
			data = context.get(path);
		}
		if (data)
			render('set', path, data);

		context.children = context.children || [];
		context.children.push(contexts);
	},
	//________________________________ TAGS
	tag: function(context, args) {
		var name = args[0],
			template = args[1];
		if (template)
			firstPass(template, context);
	},
	//________________________________ Conditonal node rendering
	rendered: function(context, args) {
		var ok, condition = args[0];
		if (condition && condition.__interpolable__)
			ok = condition.output(context);
		else if (type === 'function')
			ok = condition.call(this, context);
		if (ok)
		; // render to string
	},
	//_________________________________ CLIENT/SERVER
	client: function(context, args) {
		if (env.isServer)
			return;
		firstPass(args[0], context);
	},
	server: function(context, args) {
		if (!env.isServer)
			return;
		firstPass(args[0], context);
	}
};

var secondMethods = {
	//_________________________________ local context management
	context: function(context, descriptor) {
		if (context.children)
			descriptor.context = context.children.shift();
	},
	// ____________________________________ WITH
	with: function(context, descriptor, args) {
		if (!context.children)
			return;
		var path = args[0],
			template = args[1],
			newDescriptor = new SOD(),
			ctx = context.children.shift();
		newDescriptor.context = ctx;
		template.toHTMLString(ctx, newDescriptor);
		descriptor.attributes += newDescriptor.attributes;
		if (newDescriptor.style)
			descriptor.style += newDescriptor.style;
		if (newDescriptor.classes)
			descriptor.classes += newDescriptor.classes;
		if (newDescriptor.children)
			descriptor.children += newDescriptor.children;
	},
	//_________________________________________ EACH
	each: function(context, descriptor, args) {
		if (!context.children)
			return;
		var contexts = context.children.shift();
		if (contexts && contexts.length) {
			var template = utils.getEachTemplate(this, args[1]),
				nd = new SOD();
			for (var i = 0, len = contexts.length; i < len; ++i)
				secondPass(template, contexts[i], nd);
			descriptor.children += nd.children;
		}
	},
	//________________________________ TAGS
	tag: function(context, descriptor, args) {
		var name = args[0],
			template = args[1],
			newDescriptor = new SOD();
		if (template)
			secondPass(template, context, newDescriptor);
		utils.tagOutput(descriptor, newDescriptor, name);
	},
	//________________________________ Conditonal node rendering
	rendered: function(context, descriptor, args) {
		var ok, condition = args[0];
		if (condition && condition.__interpolable__)
			ok = condition.output(context);
		else if (type === 'function')
			ok = condition.call(this, context);
		if (ok)
		; // render to string
	},
	//_________________________________ CLIENT/SERVER
	client: function(context, descriptor, args) {
		if (env.isServer)
			return;
		secondPass(args[0], context);
	},
	server: function(context, descriptor, args) {
		if (!env.isServer)
			return;
		secondPass(args[0], context, descriptor);
	}
};

function secondPass(template, context, descriptor) {
	descriptor = descriptor ||  new SOD();
	var queue = template._queue,
		handler,
		f;
	for (var i = 0, len = queue.length; i < len; ++i) {
		handler = queue[i];
		if (handler.func) {
			if (handler.firstPass)
				continue;
			else
				f = handler.func;
		} else if (secondMethods[handler.name])
			f = secondMethods[handler.name];
		else
			f = stringEngine[handler.name];

		f(descriptor.context || context, descriptor, handler.args);
	}
	return descriptor.children;
}

function firstPass(template, context) {
	var handler,
		f,
		newContext,
		ctx;
	for (var i = 0, len = template._queue.length; i < len; ++i) {
		handler = template._queue[i];
		if (handler.func) {
			if (!handler.firstPass)
				continue;
			else
				f = handler.func;
		} else if (!firstMethods[handler.name])
			continue;
		else
			f = firstMethods[handler.name];
		ctx = f(newContext || context, handler.args);
		if (ctx && ctx.__yContext__)
			newContext = ctx;
	}
}

Template.prototype.twopass = function(context) {
	context = context || new Context();
	firstPass(this, context);
	var self = this;
	return context.done().then(function() {
		return secondPass(self, context);
	});
};

module.exports = {
	firstMethods: firstMethods,
	secondMethods: secondMethods
};
