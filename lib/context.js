/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * an observable data holder.
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
			this.parent.subscribe(path, function(value) {
				self.reset(value);
			}, false, this.binds)
		}
	} else
		this.env = env ? new Context(env) : Context.env;
}

function unsub(context, path, fn, upstream) {
	return function() {
		if (!context.destroyed)
			context.unsubscribe(path, fn, upstream);
	};
}

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
	dependent: function(path, dependencies, func) {
		var argsOutput = [],
			willFire,
			self = this,
			count = 0;
		this.binds = this.binds ||  [];
		dependencies.forEach(function(dependency) {
			argsOutput.push(this.get(dependency));
			// subscribe to arguments[i]
			var index = count++; // localise var in scope for local func closure below
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
		if (data === this.data || (this.data instanceof Date && data instanceof Date && this.data.valueOf() === data.valueOf()))
			return this;
		this.data = data || {};
		this.notifyAll('reset', null, this.map, data, '*');
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
	set: function(path, value) {
		if (!path.forEach)
			path = path.split('.');
		switch (path[0]) {
			case '$this':
				if (path.length === 1)
					return this.reset(value);
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
			if (old instanceof Date && value instanceof Date && old.valueOf() === value.valueOf())
				return this;
			this.notify('set', path, value, path[path.length - 1]);
		}
		return this;
	},
	push: function(path, value) {
		if (!path.forEach)
			path = path.split('.');

		if (path[0] == '$parent') {
			if (this.parent)
				return this.parent.push(path.slice(1), value) && this;
			throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
		} else if (path[0] === '$env')
			return this.env.push(path.slice(1), value) && this;
		var arr;
		if (path[0] === '$this')
			arr = this.data;
		else
			arr = utils.getProp(this.data, path);
		if (!arr)
			throw new Error("yamvish.Context : Missing array at " + path.join(".") + " : couldn't push object.");
		if (!arr.forEach)
			throw new Error("yamvish.Context : Object is not array at " + path.join(".") + " : couldn't push object.");
		arr.push(value);
		this.notify('push', path, value, arr.length - 1);
		return this;
	},
	del: function(path) {
		if (!path.forEach)
			path = path.split('.');
		else
			path = path.slice();
		if (path[0] == '$parent') {
			if (this.parent)
				return this.parent.del(path.slice(1)) && this;
			throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
		} else if (path[0] == '$env')
			return this.env.del(path.slice(1)) && this;
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
		// console.log('context subscribe : ', path, fn, upstream);
		if (!path.forEach)
			path = path.split('.');
		var space;
		if (path[0] === '$this')
			space = this.map;
		else if (path[0] === '$env')
			return this.env.subscribe(path.slice(1), fn, upstream);
		else if (path[0] === '$parent') {
			if (!this.parent)
				throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
			return this.parent.subscribe(path.slice(1), fn, upstream);
		} else
			space = utils.getProp(this.map, path);
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
		if (this.distroyed)
			return this;
		if (!path.forEach)
			path = path.split('.');
		var space;
		if (path[0] === '$this')
			space = this.map;
		else if (path[0] === '$parent')
			return this.env.unsubscribe(path.slice(1), fn, upstream) && this;
		else if (path[0] === '$parent') {
			if (this.parent)
				return this.parent.unsubscribe(path.slice(1), fn, upstream) && this;
			throw new Error('yamvish.Context : there is no parent in current context. could not find : ' + path.join('.'));
		} else
			space = utils.getProp(this.map, path);
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
		space = space ||  this.map;
		value = (arguments.length < 2) ? this.data : value;
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
				this.notifyAll(type, path, space[j], value ? value[j] : undefined, index);
			}
		return this;
	},
	notify: function(type, path, value, index) {
		if (!path.forEach)
			path = path.split('.');
		if (path[0] === '$this')
			path = path.slice(1);
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
		var func = function() {
			handler.apply(self, arguments);
		};
		agora.on(messageName, func);
		(this.binds = this.binds ||  []).push(function() {
			agora.off(messageName, func);
		});
		return this;
	},
	toAgora: function(name) {
		var args = [name].concat([].slice.call(arguments, 1))
		this.env.data.agora.emit.apply(this.env.data.agora, args);
		return this;
	}
};

Context.env = new Context(env);
delete Context.env.env;

utils.shallowMerge(AsyncManager.prototype, Context.prototype);

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

module.exports = Context;
