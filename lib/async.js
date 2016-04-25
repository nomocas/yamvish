/** 
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * asynchroneous events (aka promise and setTimeout calls) manager.
 * Context will inherit of this class to manage all internal or external asynchroneous calls.
 * It allows us to know when a context and its descendants are stabilised (i.e. all data are up to date).
 */

var Emitter = require('nomocas-utils/lib/emitter'),
	utils = require('./utils');

function AsyncManager() {
	this._async = {
		count: 0,
		errors: [],
		successes: [],
		fails: [],
		callbacks: []
	};
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
	for (var j = 0; j < list.length; j++)
		list[j](args);
	if (mgr.emit)
		mgr.emit('stabilised', mgr);
	async.successes = [];
	async.fails = [];
	async.errors = [];
}

function delayEnd(func, self) {
	if (func) func();
	remove(self);
}

AsyncManager.prototype = {
	/**
	 * waiting a promise. 
	 * warning : 
	 * 		this.waiting(prom.then(...).then(...)) ===> "then"(s) will be executed BEFORE "stabilised" event/resolution
	 *   	this.waiting(prom).then(...).then(...) ===> "then"(s) will be executed AFTER "stabilised" event/resolution
	 * @param  {Promise} promise the promise to wait for
	 * @return {Promise}         a promise that will be resolved AFTER "stabilised" event/resolution
	 */
	waiting: function(promise) {
		this._async.count++;
		var self = this;
		var p = promise.then(function(s) {
			remove(self);
			return s;
		}, function(e) {
			if (self.env && self.env.data.debug)
				console.error('async waiting error : ', e);
			self._async.errors.push(e);
			remove(self);
			throw e;
		});
		if (this.parent && this.parent.waiting)
			this.parent.waiting(p);
		return p;
	},
	delay: function(func, ms) {
		this._async.count++;
		var t = setTimeout(delayEnd, ms, func, this);
		if (this.parent && this.parent.delay)
			this.parent.delay(null, ms);
		return t;
	},
	stabilised: function() {
		if (this._async.count === 0)
			return Promise.resolve(this);
		var store = this._async;
		return new Promise(function(resolve, reject) {
			store.successes.push(resolve);
			store.fails.push(reject);
		});
	}
};

utils.shallowMerge(Emitter.prototype, AsyncManager.prototype);

module.exports = AsyncManager;
