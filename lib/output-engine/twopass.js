/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 */
var utils = require('../utils'),
	Template = require('../template'),
	Context = require('../context'),
	stringEngine = require('./string'),
	SOD = stringEngine.SOD;

var firstMethods = {
	//_________________________________ local context management
	newContext: function(context, args) {
		var data = args[0],
			parent = args[1] || context,
			path = args[2],
			ctx = new Context(data, parent, path);
		(context.firstPassObjects = context.firstPassObjects || []).push(ctx);
		return ctx;
	},
	// ____________________________________ WITH
	with: function(context, descriptor, args) {
		var path = args[0],
			// produce local context and store it in parent 
			ctx = new Context(typeof path === 'string' ? context.get(path) : path, context, path);
		(context.firstPassObjects = context.firstPassObjects || []).push(ctx);
	},
	//________________________________ Conditonal node rendering
	agoraView: function(context, args) {
		var channel = args[0],
			template = args[1];

		throw new Error('agoraView has not been implemented yet for twopass engine.');

		context.onAgora(channel, function(message) {
			firstPass(template, context);
		});

	},

	mountIf: function(context, args) {
		var ok, condition = args[0],
			successTempl = args[1],
			failTempl = args[2];
		var exec = function(ok, type, path) {
			if (ok)
				firstPass(successTempl, context);
			else if (failTempl)
				firstPass(failTempl, context);
		};
		if (condition && condition.__interpolable__) {
			ok = condition.output(context);
			condition.subscribeTo(context, exec);
		} else if (typeof condition === 'function')
			ok = condition.call(this, context);
		exec(ok, 'set');
	},
	if: function(context, args) {
		var ok, condition = args[0],
			successTempl = args[1],
			failTempl = args[2];
		if (condition && condition.__interpolable__) {
			ok = condition.output(context);
		} else if (typeof condition === 'function')
			ok = condition.call(this, context);
		if (ok)
			firstPass(successTempl, context);
		else if (failTempl)
			firstPass(failTempl, context);
	},
	switch: function(context, args) {
		var expression = args[0],
			dico = args[1],
			seen = {};

		function switchTempl(value) {
			var templ = dico[value] || dico['default'];
			if (templ && !seen[value]) {
				seen[value] = true;
				firstPass(templ, context);
			}
		}
		if (expression.__interpolable__) {
			expression.subscribeTo(context, function(value) {
				switchTempl(value);
			});
			switchTempl(expression.output(context));
		} else if (typeof expression === 'function')
			switchTempl(expression(context));
		else
			switchTempl(expression);
	},
	//_________________________________________ EACH
	each: function(context, args) {
		var path = args[0],
			template = args[1],
			emptyTemplate = args[2],
			emptyInitialised = false,
			data = path,
			contexts = [];

		var updateArray = function(value, type, path, index) {
			// on array update : produce or maintain associated local contexts array
			var ctx, ctxs = contexts;
			switch (type) {
				case 'reset':
				case 'set':

					if (!value.length && !emptyInitialised)
						firstPass(emptyTemplate, context); // traverse empty template with firstPass

					var j = 0;
					for (var len = value.length; j < len; ++j) // reset existing or create new ctx 
					{
						if (ctxs[j]) // reset existing
							ctxs[j].reset(value[j]);
						else { // create new ctx
							ctx = new Context(value[j], context);
							ctxs.push(ctx);
							firstPass(template, ctx); // traverse child template with firstPass
						}
					}
					if (j < ctxs.length) // remove additional ctx that is not used any more
					{
						for (var i = j, len = ctxs.length; i < len; ++i)
							ctxs[i].destroy();
						ctxs.splice(j);
					}
					break;
				case 'removeAt':
					ctxs[index].destroy();
					ctxs.splice(index, 1);
					break;
				case 'push':
					ctx = new Context(value, context)
					ctxs.push(ctx);
					firstPass(template, ctx);
					break;
			}
		};

		if (typeof path === 'string') {
			context.subscribe(path, updateArray);
			context.subscribe(path + '.*', function(value, type, path, key) {
				// on array's item update
				var ctx = contexts[key];
				if (ctx)
					return ctx.reset(value); // update associated context
			});
			data = context.get(path);
		}
		if (data)
			updateArray(data, 'set');
		// store local contexts array in parent
		(context.firstPassObjects = context.firstPassObjects || []).push(contexts);
	},
	eachTemplates: function(context, descriptor, args) {
		var templates = args[0],
			handler = args[1];
		templates.forEach(function(templ) {
			firstPass(handler ? handler(templ) : templ, context);
		});
	},
	//________________________________ TAGS
	tag: function(context, args) {
		var name = args[0],
			template = args[1];
		if (template)
			firstPass(template, context); // traverse tag template with frstPass
	},
	//_________________________________ CLIENT/SERVER
	client: function(context, args) {
		if (context.env.data.isServer)
			return;
		firstPass(args[0], context); // traverse client template with frstPass
	},
	server: function(context, args) {
		if (!context.env.data.isServer)
			return;
		firstPass(args[0], context); // traverse server template with frstPass
	},
	//_________________ CONTAINER
	container: function(context, node, args) {
		firstPass(args[0], context);
	}
};

var secondMethods = {
	container: function(context, descriptor, args) {
		var sod = new SOD();
		secondPass(args[0], context, sod);
		descriptor.children += sod.children;
	},
	//_________________________________ local context management
	newContext: function(context, descriptor) {
		if (context.firstPassObjects) // catch context produced in firstPass
			descriptor.context = context.firstPassObjects.shift();
	},
	// ____________________________________ WITH
	with: function(context, descriptor, args) {
		if (!context.firstPassObjects)
			return;
		var path = args[0],
			template = args[1],
			ctx = context.firstPassObjects.shift(); // catch context produced in firstPass
		secondPass(template, ctx, descriptor);
	},
	//_________________________________________ EACH
	each: function(context, descriptor, args) {
		if (!context.firstPassObjects)
			return;
		var contexts = context.firstPassObjects.shift(); // catch contexts array produced in firstPass
		if (contexts && contexts.length) {
			var template = args[1],
				emptyTemplate = args[2];
			if (!contexts.length)
				secondPass(emptyTemplate, context, descriptor);
			else
				for (var i = 0, len = contexts.length; i < len; ++i)
					secondPass(template, contexts[i], descriptor);
		}
	},
	eachTemplates: function(context, descriptor, args) {
		var templates = args[0],
			handler = args[1];
		templates.forEach(function(templ) {
			secondPass(handler ? handler(templ) : templ, context, descriptor);
		});
	},
	switch: function(context, descriptor, args) {
		var expression = args[0],
			dico = args[1],
			value;
		if (expression.__interpolable__)
			value = expression.output(context);
		else if (typeof expression === 'function')
			value = expression(context);
		else
			value = expression;
		templ = dico[value] || dico['default'];
		if (templ) {
			var sod = new SOD();
			templ.toHTMLString(context, sod);
			if (sod.firstPassObjects)
				descriptor.firstPassObjects += sod.firstPassObjects;
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
	if: function(context, descriptor, args) {
		var ok, condition = args[0],
			successTempl = args[1],
			failTempl = args[2];
		if (condition && condition.__interpolable__)
			ok = condition.output(context);
		else if (type === 'function')
			ok = condition.call(this, context);
		if (ok)
			secondPass(successTempl, context, descriptor);
		else if (failTempl)
			secondPass(failTempl, context, descriptor);
	},
	mountIf: function(context, descriptor, args) {
		var ok, condition = args[0],
			successTempl = args[1],
			failTempl = args[2];
		if (condition && condition.__interpolable__)
			ok = condition.output(context);
		else if (type === 'function')
			ok = condition.call(this, context);
		var sod = new SOD();
		if (ok)
			secondPass(successTempl, context, sod);
		else if (failTempl)
			secondPass(failTempl, context, sod);
		if (sod.children)
			descriptor.children += sod.children;
	},
	//_________________________________ CLIENT/SERVER
	client: function(context, descriptor, args) {
		if (context.env.data.isServer)
			return;
		secondPass(args[0], context, descriptor);
	},
	server: function(context, descriptor, args) {
		if (!context.env.data.isServer)
			return;
		secondPass(args[0], context, descriptor);
	}
};

function secondPass(queue, context, descriptor) {
	descriptor = descriptor ||  new SOD();
	var handler = queue[0],
		index = 0,
		f;
	while (handler) {
		f = null;
		switch (handler.type) {
			case '*':
				f = secondMethods[handler.handler] || stringEngine[handler.handler];
				break;
			case 'string':
			case 'secondPass':
				f = handler.handler;
				break;
			case 'custom':
				f = handler.handler.secondPass;
				break;
		}
		if (!f) {
			handler = this._queue[++index];
			continue;
		}
		f(descriptor.context || context, descriptor, handler.args);
		if (handler.suspendAfter)
			break;
		handler = queue[++index];
	}
}

function firstPass(queue, context) {
	var handler = queue[0],
		newContext,
		index = 0,
		ctx,
		f;
	while (handler) {
		f = null;
		switch (handler.type) {
			case '*':
				f = firstMethods[handler.handler];
				break;
			case 'context':
			case 'firstPass':
				f = handler.handler;
				break;
			case 'custom':
				f = handler.handler.firstPass;
				break;
		}
		if (!f) {
			handler = this._queue[++index];
			continue;
		}
		ctx = f(newContext || context, handler.args);
		if (ctx && ctx.__yContext__)
			newContext = ctx;
		if (handler.suspendAfter)
			break;
		handler = queue[++index];
	}
}

Template.prototype.twopass = function(context) {
	context = context || new Context();
	firstPass(this._queue, context); // apply first pass : construct contexts
	var self = this;
	// wait for context stabilisation
	return context.stabilised().then(function(context) {
		// then apply second pass : render to string
		var descriptor = new SOD();
		secondPass(self._queue, context, descriptor);
		return descriptor.firstPassObjects;
	});
};

module.exports = {
	firstMethods: firstMethods,
	secondMethods: secondMethods,
	firstPass: firstPass,
	secondPass: secondPass
};
