(function() {
	'use strict';
	var Route = require('routedsl'),
		utils = require('../lib/utils'),
		Context = require('../lib/context'),
		View = require('../lib/view'),
		Template = require('../lib/template'),
		interpolable = require('../lib/interpolable');

	var router = {};

	Template.prototype.route = function(route) {
		route = new Route(route);
		return this.exec(function(context) {
			context.route(route);
		}, true);
	};

	// normally browser only
	router.navigateTo = function(route, title, state) {
		if (!utils.isServer)
			window.history.pushState(state, title  || '', route);
	};

	router.Route = Route;

	Context.prototype.route = View.prototype.route = function(route, adapter) {
		if (typeof route === 'string')
			route = new Route(route);
		if (!this._routes)
			bindRouter(this, adapter);
		(this._routes = this._routes || []).push(route);
		return this;
	};

	function checkRoutes(context, url) {
		context._routes.some(function(route) {
			var descriptor = route.match(url);
			if (descriptor)
				for (var i in descriptor.output)
					context.set(i, descriptor.output[i]);
			return descriptor;
		});
	};

	function bindRouter(context, adapter) {
		if (context._routes)
			return;
		adapter = adapter || (!utils.isServer ? window : null);
		var self = context;
		context._routes = [];

		var popstate = function(e) {
			var url = window.history.location.relative;
			// console.log("* POP STATE : %s - ", url, JSON.stringify(window.history.state));
			self.set('$route', url);
			checkRoutes(self, url);
		};

		// popstate event from back/forward in browser
		adapter.addEventListener('popstate', popstate);

		// hashchange event from back/forward in browser
		// adapter.addEventListener('hashchange', function(e) {
		// 	console.log("* HASH CHANGE " + history.location.hash, " - ", JSON.stringify(history.state));
		// });

		var setstate = function(e) {
			var url = window.history.location.relative;
			// console.log("* SET STATE : %s - ", url, JSON.stringify(window.history.state));
			self.set('$route', url);
			checkRoutes(self, url);
		};

		// setstate event when pushstate or replace state
		adapter.addEventListener('setstate', setstate);

		context._binds.push(function() {
			adapter.removeEventListener('popstate', popstate);
			adapter.removeEventListener('setstate', setstate);
		});
	};

	module.exports = router;
})();
