(function() {
	'use strict';
	var c3po = require('c3po/index'),
		Context = require('../lib/context'),
		View = require('../lib/view'),
		Template = require('../lib/template'),
		interpolable = require('../lib/interpolable').interpolable;

	function bindMap(map, self, context, factory, promises, before, after, fail) {
		Object.keys(map).forEach(function(i) {
			if (map[i].__interpolable__)
				map[i].subscribeTo(context, function(type, path, value) {
					if (before)
						before.call(self, context, factory, promises);
					context.setAsync(i, c3po.get(value))
						.then(function(s) {
							if (after)
								after.call(self, context, factory, promises);
						}, function(e) {
							if (fail)
								return fail.call(self, context, factory, promises, e);
							throw e;
						});
				});
		});
	};

	View.prototype.load = Template.prototype.load = function(map, arg1, arg2, arg3, arg4) {
		var path, before, after, fail;
		if (typeof map === 'string') {
			path = map;
			map = {};
			map[path] = arg1;
			before = arg2;
			after = arg3;
			fail = arg4;
		} else {
			before = arg1;
			after = arg2;
			fail = arg3;
		}
		for (var i in map)
			map[i] = interpolable(map[i]);

		return this.done(function(context, factory, promises) {
			var self = this,
				p;
			bindMap(map, this, context, factory, promises, before, after, fail);
			if (before)
				before.call(self, context, factory, promises);
			var pr = [],
				uri;
			for (var i in map) {
				uri = map[i].__interpolable__ ? map[i].output(context) : map[i];
				pr.push(context.setAsync(i, c3po.get(uri)));
			}
			if (pr.length == 1)
				p = pr[0];
			else
				p = Promise.all(pr);
			p.then(function(s) {
				if (after)
					after.call(self, context, factory, promises);
			}, function(e) {
				if (fail)
					return fail.call(self, context, factory, promises, e);
				throw e;
			});
			promises.push(p);
		}, true);
	};


	module.exports = c3po;
})();
