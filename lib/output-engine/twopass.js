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
		// produce local context and store it in parent 
		var childContext = new Context(parentPath ? null : value, context, parentPath ? parentPath : null);
		(context.children = context.children || []).push(childContext);
		return childContext;
	},
	// ____________________________________ WITH
	with: function(context, descriptor, args) {
		var path = args[0],
			template = args[1],
			// produce local context and store it in parent 
			ctx = new Context(typeof path === 'string' ? context.get(path) : path, context, path);
		(context.children = context.children || []).push(childContext);
	},
	//_________________________________________ EACH
	each: function(context, args) {
		var path = args[0],
			data = path,
			contexts = [],
			template = utils.getEachTemplate(this, args[1]);

		var updateArray = function(type, path, value, index) {
			// on array update : produce or maintain associated local contexts array
			var ctx, ctxs = contexts;
			switch (type) {
				case 'reset':
				case 'set':
					var j = 0;
					for (var len = value.length; j < len; ++j) // reset existing or create new ctx 
					{
						if (ctxs[j]) // reset existing
							ctxs[j].reset(value[j]);
						else { // create new ctx
							ctx = new Context(value[j], this);
							ctxs.push(ctx);
							firstPass(template, ctx); // traverse child template with firstPass
						}
					}
					if (j < ctxs.length) // remove additional ctx that is not used any more
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

		if (typeof path === 'string') {
			context.subscribe(path, updateArray);
			context.subscribe(path + '.*', function(type, path, value, key) {
				// on array's item update
				var ctx = contexts[key];
				if (ctx)
					return ctx.reset(value); // update associated context
			});
			data = context.get(path);
		}
		if (data)
			updateArray('set', path, data);
		// store local contexts array in parent
		(context.children = context.children || []).push(contexts);
	},
	//________________________________ TAGS
	tag: function(context, args) {
		var name = args[0],
			template = args[1];
		if (template)
			firstPass(template, context); // traverse tag template with frstPass
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
		firstPass(args[0], context); // traverse client template with frstPass
	},
	server: function(context, args) {
		if (!env.isServer)
			return;
		firstPass(args[0], context); // traverse server template with frstPass
	}
};

var secondMethods = {
	//_________________________________ local context management
	context: function(context, descriptor) {
		if (context.children) // catch context produced in firstPass
			descriptor.context = context.children.shift();
	},
	// ____________________________________ WITH
	with: function(context, descriptor, args) {
		if (!context.children)
			return;
		var path = args[0],
			template = args[1],
			ctx = context.children.shift(); // catch context produced in firstPass
		secondPass(template, ctx, descriptor);
	},
	//_________________________________________ EACH
	each: function(context, descriptor, args) {
		if (!context.children)
			return;
		var contexts = context.children.shift(); // catch contexts array produced in firstPass
		if (contexts && contexts.length) {
			var template = utils.getEachTemplate(this, args[1]);
			for (var i = 0, len = contexts.length; i < len; ++i)
				secondPass(template, contexts[i], descriptor);
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
		secondPass(args[0], context, descriptor);
	},
	server: function(context, descriptor, args) {
		if (!env.isServer)
			return;
		secondPass(args[0], context, descriptor);
	},
	contentSwitch: null,
	cssSwitch: null
};

function secondPass(template, context, descriptor) {
	// apply string rendering only
	descriptor = descriptor ||  new SOD();
	var handler,
		f;
	for (var i = 0, len = template._queue.length; i < len; ++i) {
		handler = template._queue[i];
		if (handler.func) {
			if (handler.firstPass)
				continue;
			// else if (handler.engineBlock)
			// 	f = handler.engineBlock.twopass.second || handler.engineBlock.string;
			else
				f = handler.func;
		} else if (secondMethods[handler.name])
			f = secondMethods[handler.name];
		else
			f = stringEngine[handler.name];

		f(descriptor.context || context, descriptor, handler.args);
	}
}

function firstPass(template, context) {
	// apply contexts construction only
	var handler,
		f,
		newContext,
		ctx;
	for (var i = 0, len = template._queue.length; i < len; ++i) {
		handler = template._queue[i];
		if (handler.func) {
			if (!handler.firstPass)
				continue;
			// else if (handler.engineBlock) {
			// 	f = handler.engineBlock.twopass.first;
			// 	if (!f)
			// 		continue;
			// } 
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
	firstPass(this, context); // apply first pass : construct contexts
	var self = this;
	// wait for context stabilisation
	return context.stabilised().then(function(context) {
		// then apply second pass : render to string
		var descriptor = new SOD();
		secondPass(self, context, descriptor);
		return descriptor.children;
	});
};

module.exports = {
	firstMethods: firstMethods,
	secondMethods: secondMethods,
	firstPass: firstPass,
	secondPass: secondPass
};
