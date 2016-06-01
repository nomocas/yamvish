/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * Context : An observable data holder.
 * it's the heart of yamvish data-binding.
 */

var utils = require('./utils'),
	env = require('./env'),
	AsyncManager = require('./async');
//_______________________________________________________ DATA BIND CONTEXT

function Context(data, parent, path, env) {
	AsyncManager.call(this);
	this.__yContext__ = true;
	this.data = (data !== undefined) ? data : {};
	this.map = {};
	if (parent) {
		this.parent = parent;
		this.env = env ? new Context(env) : parent.env;
		if (path) {
			var self = this;
			this.path = path;
			this.binds = [];
			var splitted = path.split('.');
			this.parent.subscribe(path, function(value, type, p, key) {
				var localPath = p.slice(splitted.length).join('.') || '$this';
				switch (type) {
					case 'reset':
						self.reset(value);
						break;
					case 'set':
						self.set(localPath, value);
						break;
					case 'push':
						self.push(localPath, value);
						break;
					case 'removeAt':
					case 'delete':
						self.del(localPath);
						break;
				}
			}, true, this.binds);
		}
	} else
		this.env = env ? (env.__yContext__ ? env : new Env(env)) : Context.env;
}

function unsub(context, path, fn, upstream) {
	return function() {
		if (!context.destroyed)
			context.unsubscribe(path, fn, upstream);
	};
}

var outputFiler = /^\$/;

Context.prototype = {
	destroy: function() {
		if (this.binds)
			this.binds.forEach(function(unbind) {
				unbind();
			});
		this.destroyed = true;
		this.binds = null;
		this.parent = null;
		this.data = null;
		this.map = null;
	},
	get: function(path) {
		if (!path.forEach)
			path = path.split('.');
		switch (path[0]) {
			case '$this':
				if (path.length === 1)
					return this.data;
				break;
			case '$parent':
				if (!this.parent)
					throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
				return this.parent.get(path.slice(1));
				break;
			case '$env':
				return this.env.get(path.slice(1));
		}
		var r = utils.getProp(this.data, path);
		if (r === undefined)
			return '';
		return r;
	},
	call: function(methodName) {
		var func = this.get(methodName),
			args = [].slice.call(arguments, 1);
		if (!func)
			throw new Error('Context.call : no method found with : ' + methodName);
		return func.apply(this, args);
	},
	dependent: function(path, dependencies, func) {
		var argsOutput = [],
			willFire,
			self = this,
			count = 0;
		this.binds = this.binds ||  [];
		dependencies.forEach(function(dependency) {
			argsOutput.push(this.get(dependency));
			var index = count++;
			this.subscribe(dependency, function(value, type, p, key) {
				argsOutput[index] = value;
				if (!willFire)
					willFire = self.delay(function() {
						if (willFire) {
							willFire = null;
							self.set(path, func.apply(self, argsOutput));
						}
					}, 0);
			}, false, this.binds);
		}, this);
		this.set(path, func.apply(this, argsOutput));
		return this;
	},
	reset: function(data) {
		if (typeof data === 'undefined')
			data = {};
		if (data === this.data || (this.data instanceof Date && data instanceof Date && this.data.valueOf() === data.valueOf()))
			return this;
		if (!data || typeof data !== 'object') {
			this.data = data;
			this.notifyAll('reset', '', null, this.data, '*');
			return;
		}
		if (typeof this.data !== 'object')
			this.data = {};
		var seen = {}
		for (var i in this.data)
			seen[i] = false;
		for (var i in data) {
			this.set(i, data[i]);
			seen[i] = true;
		}
		for (var i in seen)
			if (!seen[i] && typeof this.data[i] !== 'function')
				this.del(i);
		return this;
	},
	set: function(path, value) {
		// console.log('set : [%s] ', path, value, arguments.length)
		if (arguments.length === 1) {
			for (var i in path)
				this.set(i, path[i]);
			return this;
		}
		if (!path.forEach)
			path = path.split('.');
		switch (path[0]) {
			case '$this':
				if (path.length === 1)
					return this.reset(value);
				else
					path.shift();
				break;
			case '$parent':
				if (this.parent)
					return this.parent.set(path.slice(1), value) && this;
				throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
			case '$env':
				return this.env.set(path.slice(1), value) && this;
		}
		var old = utils.setProp(this.data, path, value);
		if (old !== value) {
			if (old instanceof Date && old == value)
				return this;
			this.notify('set', path, value, path[path.length - 1]);
		}
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
				this.del(path + '.' + i)
				return this;
			}
		return this.push(path, value);
	},
	push: function(path, value) {
		if (!path.forEach)
			path = path.split('.');
		switch (path[0]) {
			case '$parent':
				if (this.parent)
					return this.parent.push(path.slice(1), value) && this;
				throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
			case '$env':
				return this.env.push(path.slice(1), value) && this;
		}
		var arr;
		if (path[0] === '$this')
			arr = this.data;
		else
			arr = utils.getProp(this.data, path);
		if (!arr) {
			arr = [];
			utils.setProp(this.data, path, arr);
		}
		if (!arr.forEach) {
			console.error(path, 'is not array at context.push : ', arr);
			throw new Error("yamvish.Context : Object is not array at " + path.join(".") + " : couldn't push object.");
		}
		arr.push(value);
		this.notify('push', path, value, arr.length - 1);
		return this;
	},
	del: function(path) {
		if (!path.forEach)
			path = path.split('.');
		else
			path = path.slice();
		switch (path[0]) {
			case '$parent':
				if (this.parent)
					return this.parent.del(path.slice(1)) && this;
				throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
			case '$env':
				return this.env.del(path.slice(1)) && this;
		}
		var path2 = path.slice();
		var key = path2.pop(),
			parent = path2.length ? utils.getProp(this.data, path2) : this.data;
		if (parent)
			if (parent.forEach) {
				var index = parseInt(key, 10);
				if (index < parent.length)
					this.notify('removeAt', path2, parent.splice(index, 1), index);
			} else {
				var val = parent[key];
				delete parent[key];
				this.notify('delete', path, val, key);
			}
		return this;
	},
	subscribe: function(path, fn, upstream, binds) {
		if (!path.forEach) {
			if (!path.split) {
				console.error('bad path type for context subscribtion : ', path);
				throw new Error('bad path type for context subscribtion : ' + path);
			}
			path = path.split('.');
		}
		var space;
		switch (path[0]) {
			case '$this':
				space = this.map;
				break;
			case '$env':
				return this.env.subscribe(path.slice(1), fn, upstream, binds);
			case '$parent':
				if (!this.parent)
					throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
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
		if (this.destroyed)
			return this;
		if (!path.forEach)
			path = path.split('.');
		var space;
		switch (path[0]) {
			case '$this':
				space = this.map;
				break;
			case '$parent':
				return this.env.unsubscribe(path.slice(1), fn, upstream) && this;
			case '$parent':
				if (this.parent)
					return this.parent.unsubscribe(path.slice(1), fn, upstream) && this;
				throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
			default:
				space = utils.getProp(this.map, path);
		}
		if (!space)
			return this;
		var arr = upstream ? space._upstreams : space._listeners;
		for (var i = 0, len = arr.length; i < len; ++i)
			if (arr[i] === fn) {
				arr.splice(i, 1);
				break;
			}
		return this;
	},
	notifyAll: function(type, path, space, value, index) {
		// console.log('context notify all  : ', type, path, space, value, index);
		space = space ||  this.map;
		if (space._listeners)
			for (var i = 0, len = space._listeners.length; i < len; ++i) {
				var listener = space._listeners[i];
				if (!listener) {
					// maybe it's because listeners length has change so update it
					len = space._listeners.length;
					continue;
				}
				var r = listener.call(this, value, type, path, index);
				if (r && r.then)
					this.waiting(r);
			}
		if (type !== 'push' && type !== 'removeAt')
			for (var j in space) {
				if (j === '_listeners' || j === '_upstreams')
					continue;
				this.notifyAll(type, path ? path.concat(j) : path, space[j], (value && typeof value === 'object') ? value[j] : value, j);
			}
		return this;
	},
	notify: function(type, path, value, index) {
		if (!path.forEach)
			path = path.split('.');
		if (path[0] === '$this')
			path = path.slice(1);
		else if (path[0] === '$parent') {
			if (!this.parent)
				throw new Error('could not notify parent : no parent found. for : ' + path.join('.'));
			this.parent.notify(type, path.slice(1), value, index);
			return this;
		}
		var space = this.map,
			i = 0,
			star;
		for (var len = path.length; i < len; ++i) {
			star = space['*'];
			if (star && star._upstreams)
				notifyUpstreams.call(this, star, type, path, value, index);
			if (!(space = space[path[i]]))
				break;
			if (space._upstreams)
				notifyUpstreams.call(this, space, type, path, value, index);
		}
		if (star)
			this.notifyAll(type, path, star, value, index);
		if (space)
			this.notifyAll(type, path, space, value, index);
		return this;
	},
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
	//______________________ AGORA MANAGEMENT
	onAgora: function(messageName, handler) {
		var agora = this.env.data.agora,
			self = this;
		agora.on(messageName, handler, [this]);
		(this.binds = this.binds ||  []).push(function() {
			agora.off(messageName, handler);
		});
		return this;
	},
	toAgora: function(name) {
		var args = [name].concat([].slice.call(arguments, 1))
		this.env.data.agora.emit.apply(this.env.data.agora, args);
		return this;
	},
	output: function() {
		var output = {};
		for (var i in this.data)
			if (!outputFiler.test(i))
				output[i] = this.data[i];
		return output;
	},
	clone: function(cloneEnv) {
		return new Context(utils.copy(this.data), this.parent, this.path, cloneEnv ? this.env.clone() : this.env);
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
	}
};

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

function notifyUpstreams(space, type, path, value, index) {
	for (var i = 0, len = space._upstreams.length; i < len; ++i) {
		var upstream = space._upstreams[i];
		if (!upstream) {
			// maybe it's because upstreams length has change so update it
			len = space._upstreams.length;
			continue;
		}
		var r = upstream.call(this, value, type, path, index);
		if (r && r.then)
			this.waiting(r);
	}
}

module.exports = { Context: Context, Env: Env };
