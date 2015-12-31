var engine = {
	//_________________________________ local context management
	context: function(context, args) {
		var value = args[0],
			parentPath = args[1];
		var childContext = new Context(parentPath ? null : value, context, parentPath ? parentPath : null);
		var f = function(context, descriptor) {
			descriptor.context = childContext;
		};
		f.context = childContext;
		return f;
	},
	//_________________________________________ EACH
	each: function(context, args) {
		var path = args[0],
			values = (typeof path === 'string') ? context.get(path) : path,
			contexts = [],
			pass2 = [],
			childContext;
		if (values) {
			var template = utils.getEachTemplate(this, args[1]);
			for (var i = 0, len = values.length; i < len; ++i) {
				childContext = new Context(values[i], context);
				contexts.push(childContext);
				pass2.push(
					firstPass(template, childContext)
				);
			}
		}
		return function(context, descriptor) {
			if (contexts.length) {
				var nd = new SOD();
				for (var i = 0, len = contexts.length; i < len; ++i)
					secondPass(pass2[i], contexts[i], nd, secondPass);
				descriptor.children += nd.children;
			}
		};
	},
	//________________________________ TAGS
	tag: function(context, originalArgs) {
		var name = originalArgs[0],
			template = originalArgs[1],
			pass2;
		if (template)
			pass2 = firstPass(template, context);

		return function(context, descriptor) {
			var newDescriptor = new SOD();
			if (pass2)
				secondPass(pass2, context, newDescriptor);
			utils.tagOutput(descriptor, newDescriptor, name);
		};
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
		if (env().isServer)
			return;
		var queue = firstPass(args[0], context);
		return function(context, descriptor) {
			secondPass(queue, context, descriptor);
		};
	},
	server: function(context, args) {
		if (!env().isServer)
			return;
		var queue = firstPass(args[0], context);
		return function(context, descriptor) {
			secondPass(queue, context, descriptor);
		};
	}
};

function secondPass(queue, context, descriptor) {
	descriptor = descriptor ||  new SOD();
	var handler = queue[0],
		nextIndex = 0;
	while (handler) {
		handler.func(descriptor.context || context, descriptor, handler.args);
		handler = queue[++nextIndex];
	}
	return descriptor.children;
}

function firstPass(template, context) {
	var handler = template._queue[0],
		index = 0,
		queue = [],
		f, newContext;
	while (handler) {
		if (handler.func && !handler.firstPass)
			f = handler.func;
		else if (!handler.func && !engine[handler.name])
			f = stringEngine[handler.name];
		else
			f = (handler.func || engine[handler.name])(newContext || context, handler.args);
		if (f) {
			if (f.context) {
				newContext = f.context;
				f.context = null;
			}
			queue.push({
				func: f,
				args: handler.args
			});
		}
		handler = template._queue[++index];
	}
	return queue;
}

Template.prototype.twopass = function(context) {
	var queue = firstPass(this, context);
	return context.done().then(function() {
		return secondPass(queue, context);
	});
};
