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
 * with complex context's structure that lazzy load datas depending on routes, environnements, (non-dom-)events, binds, etc. 
 * And you output it seemlesly server side, as pure string, without worying about datas loads and initialisation sequences.
 */
var utils = require('../utils'),
	Template = require('../template'),
	Context = require('../context').Context,
	ContextEacher = require('../context-eacher'),
	stringEngine = require('./string'),
	SOD = stringEngine.SOD;


var firstMethods = {

	// ____________________________________ WITH
	with: function(context, args, stack) {
		var path = args[0],
			template = args[1],
			pathIsString = typeof path === 'string';
		ctx = new Context(pathIsString ? context.get(path) : path, context, pathIsString ? path : null);
		stack.push(ctx);
		firstPass(template, ctx, stack);
	},
	//________________________________ Conditonal node rendering
	agoraView: function(context, args, stack) {
		// var channel = args[0],
		// template = args[1];
		// console.warn('agoraView has not been implemented yet for twopass engine.');
	},

	mountIf: function(context, args, stack) {
		var ok, condition = args[0],
			successTempl = args[1],
			data = { h_mountIf: true, stack: [] };
		stack.push(data);
		var exec = function(ok) {
			data.ok = ok;
			if (ok) {
				if (!data.seenSuccess)
					firstPass(successTempl, context, data.stack);
				data.seenSuccess = true;
			}
		};
		ok = condition;
		if (condition && condition.__interpolable__) {
			ok = condition.output(context);
			condition.subscribeTo(context, exec);
		} else if (typeof condition === 'function')
			ok = condition.call(this, context);
		exec(ok);
	},

	if: function(context, args, stack) {
		var condition = args[0],
			ok = condition,
			successTempl = args[1],
			failTempl = args[2];
		if (condition && condition.__interpolable__)
			ok = condition.output(context);
		else if (typeof condition === 'function')
			ok = condition.call(this, context);
		stack.push({ ok: ok, h_if: true, condition: condition });
		if (ok)
			firstPass(successTempl, context, stack);
		else if (failTempl)
			firstPass(failTempl, context, stack);
	},
	switch: function(context, args, stack) {
		// todo maybe : add destruct on switch
		var expression = args[0],
			dico = args[1],
			destructOnSwitch = args[2],
			seen = {};

		stack.push(seen);

		function switchTempl(value) {
			value = value || 'default';
			var templ = dico[value] || dico['default'];
			if (templ) {
				if (!seen[value]) {
					seen[value] = [];
					firstPass(templ, context, seen[value]);
				}
				seen.__currentStack = seen[value];
				seen.__current = templ;
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

	eachTemplates: function(context, descriptor, args, stack) {
		var templates = args[0],
			handler = args[1];
		templates.forEach(function(templ) {
			firstPass(handler ? handler(templ) : templ, context, stack);
		});
	},
	//________________________________ TAGS
	tag: function(context, args, stack) {
		var name = args[0],
			template = args[1];
		if (template)
			firstPass(template, context, stack); // traverse tag template with frstPass
	},
	//_________________________________ CLIENT/SERVER
	client: function(context, args, stack) {
		if (context.env.data.isServer)
			return;
		firstPass(args[0], context, stack); // traverse client template with frstPass
	},
	server: function(context, args, stack) {
		if (!context.env.data.isServer)
			return;
		firstPass(args[0], context, stack); // traverse server template with frstPass
	},
	//_________________ CONTAINER
	container: function(context, args, stack) {
		var opt = args[0],
			template = args[1];
		firstPass(template, context, stack);
	},
	//_______________________________ SUSPEND RENDER
	suspendUntil: function(context, args, stack) {
		var xpr = args[0],
			index = args[1],
			templ = args[2],
			val = xpr.__interpolable__ ? xpr.output(context) : xpr,
			rest = new Template(templ._queue.slice(index)),
			instance,
			obj = {
				val: val,
				rest: rest,
				stack: []
			};
		stack.push(obj);
		if (val)
			firstPass(rest, context, obj.stack);
		else if (xpr.__interpolable__)
			instance = xpr.subscribeTo(context, function(value) {
				if (value) {
					obj.val = value;
					instance.destroy();
					firstPass(rest, context, obj.stack);
				}
			});
	},
	//_________________________________ local context management
	newContext: function(context, args, stack) {
		var ctx = new Context(args[0], args[1] || context);
		stack.push(ctx);
		return ctx;
	},
	each: function(context, args, stack) {

		var data = args[0],
			itemTemplate = args[1],
			emptyTemplate = args[2],
			emptyInitialised = false,
			dataIsString = typeof data === 'string',
			contextEacher = dataIsString ? context.getEacher(data) : new ContextEacher(context, data),
			stackData = { eacher: contextEacher, emptyStack: [] };

		// store local contexts array in parent
		stack.push(stackData);

		var newItem = function(context) {
				context._stack = [];
				firstPass(itemTemplate, context, context._stack);
			},
			updateArray = function(type, difference) {
				switch (type) {
					case 'equal':
						break;
					case 'more':
						// create additional items container and append
						var self = this;
						difference.forEach(function(ctx) {
							ctx._stack = [];
							firstPass(itemTemplate, ctx, ctx._stack);
						});
						break;
					case 'less':
						// remove and destroy unnecessary stack
						/* todo free memory */
						break;
				}
				if (!contextEacher.children.length) {
					if (emptyTemplate) {
						if (!emptyInitialised)
							firstPass(emptyTemplate, context, data.emptyStack); // traverse empty template with firstPass
						emptyInitialised = true;
					}
				}
			};

		contextEacher.on('updateArray', updateArray);
		contextEacher.on('pushItem', newItem);
		contextEacher.on('insertItem', newItem);
		contextEacher.on('deleteItem', function(index) { /* todo free memory */ });

		updateArray(contextEacher.children.length ? 'more' : 'equal', contextEacher.children);
	},
	useFromContext: function(context, args, stack) {
		var stackData = { stack: [] },
			val,
			path = args[0],
			useArgs = args[1];
		stack.push(stackData);
		var update = function(value) {
			if (value === val)
				return;
			val = value;
			if (stackData.stack.length) {
				// destroyStack(stackData.stack);
				stackData.stack = [];
				stackData.templ = null;
			}
			if (value) {
				var t = stackData.templ = new Template();
				t.use.apply(t, [value].concat(useArgs));
				firstPass(stackData.templ, context, stackData.stack);
			}
		};
		context.subscribe(path, update);
		update(context.get(path));
	}
};


var secondMethods = {
	useFromContext: function(context, descriptor, args, stack) {
		var stackData = stack.shift();
		if (stackData.templ)
			secondPass(stackData.templ, context, descriptor, stackData.stack);
	},
	//_________________________________________ EACH
	each: function(context, descriptor, args, stack) {
		var data = stack.shift(),
			template = args[1],
			emptyTemplate = args[2];
		if (!data.eacher.children.length) {
			if (emptyTemplate)
				secondPass(emptyTemplate, context, descriptor, data.emptyStack);
		} else
			for (var i = 0, len = data.eacher.children.length; i < len; ++i) {
				var sod = new SOD();
				secondPass(template, data.eacher.children[i], sod, data.eacher.children[i]._stack);
				descriptor.children += sod.children;
			}
	},
	eachTemplates: function(context, descriptor, args, stack) {
		var templates = args[0],
			handler = args[1];
		templates.forEach(function(templ) {
			secondPass(handler ? handler(templ) : templ, context, descriptor, stack);
		});
	},
	//_______________________________ SUSPEND RENDER
	suspendUntil: function(context, descriptor, args, stack) {
		var obj = stack.shift();
		if (obj.val)
			secondPass(obj.rest, context, descriptor, obj.stack);
	},
	//_________________________________ local context management
	newContext: function(context, descriptor, args, stack) {
		descriptor.context = stack.shift();
	},
	// ____________________________________ WITH
	with: function(context, descriptor, args, stack) {
		var path = args[0],
			template = args[1],
			ctx = stack.shift(),
			oldCtx = descriptor.context;
		descriptor.context = ctx;
		secondPass(template, ctx, descriptor, stack);
		descriptor.context = oldCtx;
	},
	switch: function(context, descriptor, args, stack) {
		var data = stack.shift();
		templ = data.__current;
		if (templ) {
			var sod = new SOD();
			secondPass(templ, context, sod, data.__currentStack);
			if (sod.children)
				descriptor.children += sod.children;
		}
	},
	//________________________________ Conditonal node rendering
	if: function(context, descriptor, args, stack) {
		var data = stack.shift(),
			templ = args[1],
			failTempl = args[2];
		if (data.ok)
			secondPass(templ, context, descriptor, stack);
		else if (failTempl)
			secondPass(failTempl, context, descriptor, stack);
	},
	mountIf: function(context, descriptor, args, stack) {
		var data = stack.shift(),
			successTempl = args[1];
		if (!data.ok)
			return;
		var sod = new SOD();
		secondPass(successTempl, context, sod, data.stack);
		if (sod.children)
			descriptor.children += sod.children;
	},
	//_______________ container
	container: function(context, descriptor, args, stack) {
		var opt = args[0],
			template = args[1],
			sod = new SOD();
		secondPass(template, context, sod, stack);
		if (sod.children)
			descriptor.children += sod.children;
	},
	//________________________________ TAGS
	tag: function(context, descriptor, args, stack) {
		var name = args[0],
			template = args[1],
			newDescriptor = new SOD();
		if (template)
			secondPass(template, context, newDescriptor, stack);
		utils.tagOutput(descriptor, newDescriptor, name);
	},
	//_________________________________ CLIENT/SERVER
	client: function(context, descriptor, args, stack) {
		if (context.env.data.isServer)
			return;
		secondPass(args[0], context, descriptor, stack);
	},
	server: function(context, descriptor, args, stack) {
		if (!context.env.data.isServer)
			return;
		secondPass(args[0], context, descriptor, stack);
	},
	agoraView: function(context, args, stack) {
		// var channel = args[0],
		// template = args[1];
		// console.warn('agoraView has not been implemented yet for twopass engine.');
	}
};

function firstPass(template, context, stack) {
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
			firstPass(f, newContext || context, stack);
		else
			ctx = f(newContext || context, handler.args, stack);
		if (ctx && ctx.__yContext__)
			newContext = ctx;
		if (handler.suspendAfter)
			break;
		handler = queue[++index];
	}
}

function secondPass(template, context, descriptor, stack) {
	var queue = template._queue,
		handler = queue[0],
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
			handler = queue[++index];
			continue;
		}
		if (f.__yTemplate__)
			secondPass(f, descriptor.context || context, descriptor, stack);
		else
			f(descriptor.context || context, descriptor, handler.args, stack);
		if (handler.suspendAfter)
			break;
		handler = queue[++index];
	}
}

Template.prototype.twopass = function(context) {
	var self = this,
		stack = [];
	context = context || new Context();
	firstPass(this, context, stack); // apply first pass : construct contexts
	// wait for context stabilisation
	return context.stabilised()
		.then(function(context) {
			// then apply second pass : render to string
			var descriptor = new SOD();
			secondPass(self, context, descriptor, stack);
			return descriptor.children;
		});
};

module.exports = {
	firstMethods: firstMethods,
	secondMethods: secondMethods,
	firstPass: firstPass,
	secondPass: secondPass
};
