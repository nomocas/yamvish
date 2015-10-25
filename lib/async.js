/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var AsyncManager = function() {
	this._asyncCount = 0;
	this._errors = [];
	this._successes = [];
	this._fails = [];
	this._callbacks = [];
	this._ids = new Date().valueOf();
};

function remove(mgr) {
	mgr._asyncCount--;
	if (mgr._asyncCount <= 0)
		trigger(mgr);
}

function trigger(mgr) {
	var list = mgr._errors.length ? mgr._fails : mgr._successes,
		args = mgr._errors.length ? mgr._errors : true;

	for (var i = 0; i < mgr._callbacks.length; i++) // call as event handler
		mgr._callbacks[i](args);

	for (var j = 0; j < list.length; j++)
		list[j](args);
	mgr._successes = [];
	mgr._fails = [];
	mgr._errors = [];
}

AsyncManager.prototype = {
	waiting: function(promise) {
		this._asyncCount++;
		var self = this;
		if (this.parent && this.parent.waiting)
			this.parent.waiting(promise);
		return promise.then(function(s) {
			remove(self);
			return s;
		}, function(e) {
			console.log('async waiting error : ', e);
			self._errors.push(e);
			remove(self);
			throw e;
		});
	},
	delay: function(func, ms) {
		var self = this;
		this._asyncCount++;
		if (this.parent && this.parent.delay)
			this.parent.delay(function() {}, ms);
		return setTimeout(function() {
			func();
			remove(self);
		}, ms);
	},
	onDone: function(callback) {
		this._callbacks.push(callback);
		return this;
	},
	then: function(func, fail) {
		var self = this;
		if (this._asyncCount === 0)
			return Promise.resolve(true);
		return new Promise(function(resolve, reject) {
				self._successes.push(resolve);
				self._fails.push(reject);
			})
			.then(func, fail);
	}
};

module.exports = AsyncManager;
