/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * Context : An observable data holder.
 * it's the heart of yamvish data-binding.
 */

var utils = require('./utils'),
	env = require('./env'),
	AsyncManager = require('./async'),
	interpolable = require('./interpolable').interpolable,
	outputFiler = /^\$/;

//____________________________ HELPERS
function unsub(context, path, fn, upstream) {
	return function() {
		// if (!context.destroyed)
		context.unsubscribe(path, fn, upstream);
	};
}

function parsePath(path) {
	if (!path.forEach) {
		if (!path.split) {
			var msg = 'yavmish.Context : parsing path failed : ';
			console.error(msg, path);
			throw new Error(msg + path);
		}
		return path.split('.');
	}
	return path;
}

function getArray(context, path, action) {
	var arr = !path.length ? context.data : utils.getProp(context.data, path);
	if (!arr) {
		arr = [];
		utils.setProp(context.data, path, arr);
	}
	if (!arr.forEach)
		throw new Error('Object is not array at ' + path.join('.') + ' : couldn\'t ' + action + ' object.');
	return arr;
}

function modification(ctx, name, path, args, fromParent) {
	ctx.assertNotDestroyed(name, path);
	path = parsePath(path);

	switch (path[0]) {
		case '$parent':
			ctx.assertHasParent(path);
			return ctx.parent[name].apply(ctx.parent, [path.slice(1)].concat(args)) && ctx;
		case '$env':
			return ctx.env[name].apply(ctx.env, [path.slice(1)].concat(args)) && ctx;
	}
	if (path[0] === '$this')
		path = path.slice(1);

	if (Context.allowParentForwarding) {
		if (ctx.path && ctx.parent && !fromParent)
			return ctx.parent[name].apply(ctx.parent, [ctx.path + (path.length ? ('.' + path.join('.')) : '')].concat(args)) && ctx;
		else if (fromParent) {
			var index = (name === 'push') ? (ctx.get(path).length - 1) : path[path.length - 1];
			return ctx.notify(name, path, (name === 'delete') ? undefined : args[0], index);
		}
	}
	return path;
}

//_____________________ CLASS DEF

function Context(data, parent, path, env) {
	AsyncManager.call(this);
	this.__yContext__ = true;
	this.data = (data !== undefined) ? data : {};
	this.map = {};
	this.binds = [];
	if (parent) {
		this.parent = parent;
		this.env = env ? new Context(env) : parent.env;
		if (path) {
			var self = this;
			this.path = path;
			this.data = this.data || parent.get(path);
			this.parent.subscribe(path, function(value, type, p, key) {
				// console.log('binded context update : ', type, path, p, key, value);
				if (!p.length)
					p.push('$this');
				switch (type) {
					case 'set':
						self.set(p, value, true);
						break;
					case 'push':
						self.push(p, value, true);
						break;
					case 'delete':
						self.del(p, true);
						break;
					case 'displaceItem':
						self.displaceItem(p, value, true);
						break;
					case 'insertItem':
						self.insertItem(p, value, true);
						break;
					case 'deleteItem':
						self.deleteItem(p, value, true);
						break;
				}
			}, true, this.binds);
		}
	} else
		this.env = env ? (env.__yContext__ ? env : new Env(env)) : Context.env;
}

Context.allowParentForwarding = true;
Context.useDelayedDependent = true;

Context.prototype = {
	//_____________________ assertions
	assertNotDestroyed: function(opName, path) {
		if (this.destroyed)
			throw new Error('yamvish.Context : reusing context that has been destroyed (' + opName + ' ' + path + ')');
	},
	assertHasParent: function(path) {
		if (!this.parent)
			throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path);
	},
	//_____________________ get data
	get: function(path) {
		this.assertNotDestroyed('get', path);
		path = parsePath(path);

		switch (path[0]) {
			case '$this':
				if (path.length === 1)
					return this.data;
				break;
			case '$parent':
				this.assertHasParent(path);
				return this.parent.get(path.slice(1));
				break;
			case '$env':
				return this.env.get(path.slice(1));
		}
		return utils.getProp(this.data, path);
	},
	//_________________________________________ MODIFICATION API
	set: function(path, value, fromParent) {
		// console.log('context.set : ', path, value, fromParent);
		// .set({ ...:..., ... }) case
		if (typeof path === 'object' && !path.forEach && !value) {
			for (var i in path)
				this.set(i, path[i], fromParent);
			return this;
		}
		path = parsePath(path);
		// $this case : reset
		if (path.length === 1 && path[0] === '$this')
			return this.reset(value, fromParent);

		path = modification(this, 'set', path, [value], fromParent);
		if (path.__yContext__)
			return this;

		var old = utils.setProp(this.data, path, value);
		if (old !== value)
			this.notify('set', path, value, path[path.length - 1]);
		return this;
	},
	reset: function(data, fromParent) {
		this.assertNotDestroyed('reset', '');
		// console.log('context.reset : ', data, fromParent);
		if (typeof data === 'undefined')
			data = {};
		this.data = data;
		if (Context.allowParentForwarding && this.path && this.parent && !fromParent)
			return this.parent.set(this.path, data) && this;
		// console.log('context.reset : will notifyUP/Downstream : ', data, this.map)
		this.notify('set', '$this', data, ''); // type, path, space, value, index
		return this;
	},
	delete: function(path, fromParent) {
		// console.log('context.delete  :', path, fromParent);
		path = modification(this, 'delete', path, [], fromParent);
		if (path.__yContext__)
			return this;

		if (!path.length)
			return this.reset({}, fromParent);

		var path2 = path.slice(),
			key = path2.pop(),
			parent = path2.length ? utils.getProp(this.data, path2) : this.data;
		if (parent)
			if (parent.forEach) {
				var index = parseInt(key, 10);
				if (index < parent.length) {
					parent.splice(index, 1);
					this.notify('delete', path, undefined, index);
				}
			} else {
				delete parent[key];
				this.notify('delete', path, undefined, key);
			}
		return this;
	},
	push: function(path, value, fromParent) {
		path = modification(this, 'push', path, [value], fromParent);
		if (path.__yContext__)
			return this;
		var arr = getArray(this, path, 'push');
		arr.push(value);
		this.notify('push', path, value, arr.length - 1);
		return this;
	},
	displaceItem: function(path /* array path */ , indexes /* { fromIndex, toIndex } */ , fromParent) {
		path = modification(this, 'displaceItem', path, [indexes], fromParent);
		if (path.__yContext__)
			return this;
		var arr = getArray(this, path, 'displaceItem');
		if (indexes.fromIndex >= arr.length || indexes.toIndex >= arr.length)
			throw new Error('displaceItem failed : indexes out of bound. (' + path + ')(' + indexes.fromIndex + ',' + indexes.toIndex + ')');
		var child = arr[indexes.fromIndex];
		if (!child)
			throw new Error('Could not displaceItem : nothing found with : ' + path + '.' + indexes.fromIndex);
		arr.splice(indexes.fromIndex, 1);
		arr.splice(indexes.toIndex, 0, child);
		this.notify('displaceItem', path, indexes);
		return this;
	},
	insertItem: function(path, opt /* { data, index } */ , fromParent) {
		path = modification(this, 'insertItem', path, [opt], fromParent);
		if (path.__yContext__)
			return this;
		var arr = getArray(this, path, 'insertItem');
		if (opt.index >= arr.length)
			throw new Error('insertItem failed : indexes out of bound. (' + path + ')(' + opt.index + ')');
		arr.splice(opt.index, 0, opt.data);
		this.notify('insertItem', path, opt);
		return this;
	},
	toggle: function(path, value) {
		this.set(path, !this.get(path));
		return this;
	},
	toggleInArray: function(path, value) {
		var arr = this.get(path);
		for (var i = 0, len = arr.length; i < len; ++i)
			if (arr[i] === value) {
				this.del(path + '.' + i);
				return this;
			}
		return this.push(path, value);
	},
	//____________________________________________________ ASYNC API
	setAsync: function(path, promise) {
		var self = this;
		return this.waiting(promise.then(function(s) {
			self.set(path, s);
			return s;
		}, function(e) {
			console.error('error while Context.setAsync : ', e);
			throw e;
		}));
	},
	pushAsync: function(path, promise) {
		var self = this;
		return this.waiting(promise.then(function(s) {
			self.push(path, s);
			return s;
		}, function(e) {
			console.error('error while Context.pushAsync : ', e);
			throw e;
		}));
	},
	waitUntil: function(path, handler) {
		var val = this.get(path),
			self = this;
		if (val)
			handler(val);
		else {
			var wrapper = function(value) {
				if (!value)
					return;
				handler(value);
				self.unsubscribe(path, wrapper, true);
			};
			this.subscribe(path, wrapper, true);
		}
		return this;
	},
	// _______________________________________________ SUBSCRIPTION
	subscribe: function(path, fn, upstream, binds) {
		this.assertNotDestroyed('subscribe', path);
		path = parsePath(path);

		if (path[path.length - 1] === '*')
			throw new Error('no more * subscribe allowed - use upstreams instead : ' + path.join('.'));

		var space;
		switch (path[0]) {
			case '$this':
				space = this.map;
				break;
			case '$env':
				return this.env.subscribe(path.slice(1), fn, upstream, binds);
			case '$parent':
				this.assertHasParent(path);
				return this.parent.subscribe(path.slice(1), fn, upstream, binds);
			default:
				space = utils.getProp(this.map, path);
		}
		if (upstream) {
			if (!space)
				utils.setProp(this.map, path, {
					_upstreams: [fn]
				});
			else
				(space._upstreams = space._upstreams || []).push(fn);
		} else if (!space)
			utils.setProp(this.map, path, {
				_listeners: [fn]
			});
		else
			(space._listeners = space._listeners || []).push(fn);
		if (binds)
			binds.push(unsub(this, path, fn, upstream));
		return this;
	},
	unsubscribe: function(path, fn, upstream) {
		path = parsePath(path);

		var space;
		switch (path[0]) {
			case '$this':
				space = this.map;
				break;
			case '$env':
				return this.env.unsubscribe(path.slice(1), fn, upstream) && this;
			case '$parent':
				this.assertHasParent(path);
				return this.parent.unsubscribe(path.slice(1), fn, upstream) && this;
			default:
				if (this.map)
					space = utils.getProp(this.map, path);
		}
		if (this.destroyed || !space)
			return this;
		var arr = upstream ? space._upstreams : space._listeners;
		for (var i = 0, len = arr.length; i < len; ++i)
			if (arr[i] === fn) {
				arr.splice(i, 1);
				break;
			}
		return this;
	},
	//_______________________________________________________ NOTIFICATION
	notify: function(type /* set, delete, push */ , path, value, index) {
		this.assertNotDestroyed('notify', path);
		path = parsePath(path);
		// console.log('context notify  : ', type, path, value, index);
		if (path[0] === '$parent') {
			this.assertHasParent(path);
			return this.parent.notify(type, path.slice(1), value, index) && this;
		}

		if (path[0] === '$this')
			path = path.slice(1);

		var space = this.map,
			i = 0,
			star,
			localPath = path.slice(1);

		if (!path.length)
			return this.notifyDownstream(this.map, type, path, value, index);

		if (this.map._upstreams)
			this.notifyUpstream(this.map, type, path, value, index);

		//_____________________ UPSTREAM
		for (var len = path.length - 1; i < len; ++i) {
			if (!(space = space[path[i]]))
				break;
			if (space._upstreams)
				this.notifyUpstream(space, type, localPath, value, index);
			localPath = localPath.slice(1);
		}
		// ____________________ DOWNSTREAM
		if (!space)
			return this;
		space = path.length ? space[path[i]] : space;
		if (space)
			this.notifyDownstream(space, type, path, value, index);
		return this;
	},
	/**
	 * recursive notification from initial modification point to leaf.
	 * Normaly for internal use.
	 */
	notifyDownstream: function(space, type, path, value, index) {
		// console.log('context notify downstream  : ', space, type, path, value, index);
		space = space ||  this.map;
		if (space._upstreams)
			this.notifyUpstream(space, type, [], value, index);
		if (space._listeners)
			for (var i = 0, len = space._listeners.length; i < len; ++i) {
				var listener = space._listeners[i];
				if (!listener) {
					// maybe it's because listeners length has change so update it
					len = space._listeners.length;
					continue;
				}
				listener.call(this, value, type, path, index);
			}
		if (type !== 'push')
			for (var j in space) {
				if (j === '_listeners' || j === '_upstreams')
					continue;
				// recursion : 'set' with value[j] (if any) and path.concat(j). index = j;
				this.notifyDownstream(space[j], 'set', path ? path.concat(j) : path, (value !== undefined && value !== null) ? value[j] : undefined, j);
			}
		return this;
	},
	/**
	 * notification from root to modification point.
	 * Normaly for internal use.
	 */
	notifyUpstream: function(space, type, path, value, index) {
		// console.log('context.notifyUpstream : ', space, type, path, value, index);
		for (var i = 0, len = space._upstreams.length; i < len; ++i) {
			var upstream = space._upstreams[i];
			if (!upstream) {
				// maybe it's because upstreams length has change so update it
				len = space._upstreams.length;
				continue;
			}
			// path is local to notified node. value is the modified value. index is the one from modification point.
			upstream.call(this, value, type, path, index);
		}
	},
	//______________________ AGORA MANAGEMENT
	onAgora: function(messageName, handler) {
		var agora = this.env.data.agora,
			self = this;
		var suphandler = function() {
			handler.apply(self, arguments);
		};
		agora.on(messageName, suphandler);
		(this.binds = this.binds ||  []).push(function() {
			agora.off(messageName, suphandler);
		});
		return this;
	},
	toAgora: function(name) {
		var args = [name, this].concat([].slice.call(arguments, 1));
		this.env.data.agora.emit.apply(this.env.data.agora, args);
		return this;
	},
	//______________________________________ MISC
	output: function(path) {
		var output = {},
			obj = path ? utils.getProp(this.data, path) : this.data;
		if (!obj)
			return null;
		for (var i in obj)
			if (!outputFiler.test(i))
				output[i] = obj[i];
		return output;
	},
	clone: function(cloneEnv) {
		return new Context(utils.copy(this.data), this.parent, this.path, cloneEnv ? this.env.clone() : this.env);
	},
	destroy: function() {
		if (this.binds)
			this.binds.forEach(function(unbind) { unbind(); });
		this.destroyed = true;
		this.binds = null;
		this.parent = null;
		this.data = null;
		this.methods = null;
		this.map = null;
	},
	toMethods: function(name, func) {
		this.methods = this.methods || {};
		if (typeof name === 'object' && !func) {
			for (var i in name)
				utils.setProp(this.methods, i, name[i]);
		} else
			utils.setProp(this.methods, name, func);
		return this;
	},
	call: function(methodName) {
		methodName = parsePath(methodName);
		switch (methodName[0]) {
			case '$parent':
				this.assertHasParent(methodName);
				return this.parent.call(methodName.slice(1));
			case '$env':
				return this.env.call(methodName.slice(1));
		}
		var func = utils.getProp(this.methods, methodName),
			args = [].slice.call(arguments, 1);
		if (!func)
			throw new Error('Context.call : no method found with : ' + methodName);
		return func.apply(this, args);
	},
	dependent: function(path, dependencies, func) {

		var self = this;
		if (typeof dependencies === 'string') {
			var xpr = interpolable(dependencies);
			if (!xpr.__interpolable__)
				throw new Error('dependent var failed : bad expression type : ' + dependencies);
			xpr.subscribeTo(this, function(value) {
				this.set(path, value);
			});
			return this.set(path, xpr.output(this));
		}

		this.binds = this.binds ||  [];
		var argsOutput = [],
			willFire,
			depLength = dependencies.length;
		count = 0;
		dependencies.forEach(function(dependency) {
			argsOutput.push(this.get(dependency));
			var index = count++;
			this.subscribe(dependency, function(value, type, p, key) {
				if (argsOutput[index] === value)
					return;
				argsOutput[index] = value;
				if (depLength > 1 && Context.useDelayedDependent) {
					if (!willFire)
						willFire = self.delay(function() {
							if (willFire) {
								willFire = null;
								self.set(path, func.apply(self, argsOutput));
							}
						}, 0);
				} else
					self.set(path, func.apply(self, argsOutput));
			}, false, this.binds);
		}, this);
		this.set(path, func.apply(this, argsOutput));
		return this;
	}
};

// backward compatibility
Context.prototype.del = Context.prototype.delete;

utils.shallowMerge(AsyncManager.prototype, Context.prototype);

//___________________________________ Env class
function Env(data, parent, path) {
	Context.call(this, data, parent, path);
	delete this.env;
}
Env.prototype = new Context();
Env.prototype.clone = function() {
	return new Env(this.data.clone());
};

// general env
Context.env = new Env(env);

module.exports = { Context: Context, Env: Env };
