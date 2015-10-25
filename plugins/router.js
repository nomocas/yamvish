/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
(function() {
	'use strict';
	var Route = require('routedsl'),
		env = require('../lib/env'),
		utils = require('../lib/utils'),
		Context = require('../lib/context'),
		View = require('../lib/view'),
		Template = require('../lib/template');

	var router = {
		routers: []
	};

	Template.prototype.route = function(route) {
		route = new Route(route);
		return this.exec(function(context) {
			var self = this;
			context.route(route, function(matched) {
				if (self.__yContainer__)
					self.show();
				else
					(self.style = self.style ||  {}).display = '';
			}, function() {
				if (self.__yContainer__)
					self.hide();
				else
					(self.style = self.style ||  {}).display = 'none';
			});
		}, true);
	};

	router.navigateTo = function(route, title, state) {
		window.history.pushState(state, title  || '', route);
	};

	router.Route = Route;

	Context.prototype.route = function(route, success, fail) {
		if (typeof route === 'string')
			route = new Route(route);
		if (!router.initialised)
			router.init();
		if (!this._routes) {
			var parentRouter = this.parentRouter();
			if (!parentRouter)
				router.routers.push(this);
			else
				(parentRouter._subrouters = parentRouter._subrouters ||  []).push(this);
		}
		(this._routes = this._routes || []).push({
			route: route,
			success: success,
			fail: fail
		});
		return this;
	};

	View.prototype.route = function(route) {
		var self = this;
		Context.prototype.route.call(this, route, function(matched) {
			self.show();
		}, function() {
			self.hide();
		});
		return this;
	}

	Context.prototype.parentRouter = View.prototype.parentRouter = function() {
		if (this.parent)
			if (this.parent._routes)
				return this.parent;
			else
				return this.parent.parentRouter();
	};

	function checkRoutes(context, url) {
		if (!context._routes)
			return false;
		return context._routes.some(function(item) {
			var descriptor = item.route.match(url);
			if (descriptor) {
				if (item.success)
					item.success();
				context.set('$route', descriptor.output);
				if (context._subrouters)
					context._subrouters.forEach(function(sub) {
						checkRoutes(sub, descriptor);
					});
				return true;
			} else if (item.fail)
				item.fail();
		});
	};

	router.init = function() {
		if (this.initialised)
			return;
		this.initialised = true;
		var popstate = function(e) {
			var url = window.history.location.relative;
			// console.log("* POP STATE : %s - ", url, JSON.stringify(window.history.state));
			try {
				router.routers.forEach(function(router) {
					checkRoutes(router, url);
				});
			} catch (e) {
				console.log('error on popstate routing : ', e, e.stack);
			}
		};

		// popstate event from back/forward in browser
		window.addEventListener('popstate', popstate);

		// hashchange event from back/forward in browser
		// window.addEventListener('hashchange', function(e) {
		// 	console.log("* HASH CHANGE " + history.location.hash, " - ", JSON.stringify(history.state));
		// });

		var setstate = function(e) {
			var url = window.history.location.relative;
			// console.log("* SET STATE : %s - ", url, JSON.stringify(window.history.state));
			try {
				router.routers.forEach(function(router) {
					checkRoutes(router, url);
				});
			} catch (e) {
				console.log('error on setstate routing : ', e, e.stack);
			}
		};

		// setstate event when pushstate or replace state
		window.addEventListener('setstate', setstate);
	};

	module.exports = router;
})();
