/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * Two-Pass output engine.
 *
 * (First pass) constructs contexts tree, loads everything that is needed, applies minimal bindings, applies routes (when router is loaded), etc. 
 * and wait for root context stabilisation before (Second pass) applying pure string outut.
 *
 * Take a look to string-ouput engine docs.
 *
 * This is for COMPLETE isomorphism : you write your application with browser and Dom in head, 
 * with complex context's structure that lazzy load datas depending on routes, environnements, events, binds, etc. 
 * And you output it seemlesly server side, as pure string, without worying about datas loads and initialisation sequences.
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
	with: function(context, args) {
		var path = args[0],
			// produce local context and store it in parent 
			ctx = new Context(typeof path === 'string' ? context.get(path) : path, context, path);
		(context.firstPassObjects = context.firstPassObjects || []).push(ctx);
	},
	//________________________________ Conditonal node rendering
	agoraView: function(context, args) {
		// var channel = args[0],
		// template = args[1];
		// console.warn('agoraView has not been implemented yet for twopass engine.');
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

					if (!value.length)
						if (emptyTemplate && !emptyInitialised)
							return firstPass(emptyTemplate, context); // traverse empty template with firstPass
						else
							return;

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
	container: function(context, args) {
		var opt = args[0],
			template = args[1];
		firstPass(template, context);
	},
	//_______________________________ SUSPEND RENDER
	suspendUntil: function(context, args) {
		var xpr = args[0],
			index = args[1],
			templ = args[2],
			val = xpr.__interpolable__ ? xpr.output(context) : xpr;

		var rest = new Template(templ._queue.slice(index)),
			instance;

		var obj = {
			val: val,
			rest: rest
		};

		(context.firstPassObjects = context.firstPassObjects || []).push(obj);

		if (val)
			firstPass(rest, context);
		else if (xpr.__interpolable__)
			instance = xpr.subscribeTo(context, function(value, type, path) {
				if (value) {
					obj.val = value;
					instance.destroy();
					firstPass(rest, context);
				}
			});
	}
};

var secondMethods = {
	//_______________________________ SUSPEND RENDER
	suspendUntil: function(context, descriptor, args) {
		var obj = context.firstPassObjects.shift();
		if (obj.val)
			secondPass(obj.rest, context, descriptor);
	},
	container: function(context, descriptor, args) {
		var opt = args[0],
			template = args[1],
			sod = new SOD();
		secondPass(template, context, sod);
		descriptor.children += sod.children;
	},
	//_________________________________ local context management
	newContext: function(context, descriptor) {
		if (context.firstPassObjects) // catch context produced in firstPass
			descriptor.context = context.firstPassObjects.shift();
	},
	// ____________________________________ WITH
	with: function(context, descriptor, args) {
		var path = args[0],
			template = args[1],
			ctx = context.firstPassObjects.shift(); // catch context produced in firstPass
		secondPass(template, ctx, descriptor);
	},
	//_________________________________________ EACH
	each: function(context, descriptor, args) {
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
			if (sod.children)
				descriptor.children += sod.children;
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
		else if (typeof condition === 'function')
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

function secondPass(template, context, descriptor) {
	var queue = template._queue,
		handler = queue[0],
		index = 0,
		f;
	descriptor = descriptor ||  new SOD();
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
			handler = queue[++index];
			continue;
		}
		if (f.__yTemplate__)
			secondPass(f, descriptor.context || context, descriptor);
		else
			f(descriptor.context || context, descriptor, handler.args);
		if (handler.suspendAfter)
			break;
		handler = queue[++index];
	}
}

function firstPass(template, context) {
	var queue = template._queue,
		handler = queue[0],
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
			handler = queue[++index];
			continue;
		}
		if (f.__yTemplate__)
			ctx = firstPass(f, newContext || context);
		else
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
