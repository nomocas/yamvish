/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var Emitter = require('./emitter'),
	env = require('./env'),
	utils = require('./utils');

function AsyncManager() {
	this._async = {
		count: 0,
		errors: [],
		successes: [],
		fails: [],
		callbacks: []
	};
	Emitter.call(this);
};

function remove(mgr) {
	mgr._async.count--;
	if (mgr._async.count <= 0)
		trigger(mgr);
}

function trigger(mgr) {
	var async = mgr._async,
		list = async.errors.length ? async.fails : async.successes,
		args = async.errors.length ? async.errors : mgr;
	if (mgr.dispatchEvent)
		mgr.dispatchEvent('stabilised');
	for (var j = 0; j < list.length; j++)
		list[j](args);
	async.successes = [];
	async.fails = [];
	async.errors = [];
}

function delayEnd(func, self) {
	if (func) func();
	remove(self);
}

AsyncManager.prototype = {
	waiting: function(promise) {
		this._async.count++;
		var self = this;
		if (this.parent && this.parent.waiting)
			this.parent.waiting(promise);
		return promise.then(function(s) {
			remove(self);
			return s;
		}, function(e) {
			if (env.debug)
				console.error('async waiting error : ', e);
			self._async.errors.push(e);
			remove(self);
			throw e;
		});
	},
	delay: function(func, ms) {
		this._async.count++;
		if (this.parent && this.parent.delay)
			this.parent.delay(null, ms);
		return setTimeout(delayEnd, ms, func, this);
	},
	stabilised: function() {
		var self = this;
		if (this._async.count === 0)
			return Promise.resolve(this);
		return new Promise(function(resolve, reject) {
			self._async.successes.push(resolve);
			self._async.fails.push(reject);
		});
	},
	once: function(event, func) {
		this._events = this._events || {};
		var self = this;
		(this._events[event] = this._events[event] || []).push(function(evt) {
			self.removeEventListener(event, func);
			func.call(this, evt);
		});
		return this;
	}
};

utils.mergeProto(Emitter.prototype, AsyncManager.prototype);

module.exports = AsyncManager;
