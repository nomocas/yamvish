var utils = require('./utils'),
	View = require('./view'),
	Template = require('./template'),
	Route = require('routedsl');

function findParentRouter(context) {
	var parent = context.parent;
	if (!parent)
		return null;
	return parent && parent.isRouted ? parent : findParentRouter(parent);
}

function parseURL(url) {
	var route = url.split('/');
	if (route[0] === '')
		route.shift();
	if (route[route.length - 1] === '')
		route.pop();
	return {
		length: route.length,
		route: route,
		index: 0
	};
}

Template.prototype.clickTo = function(href, title, data) {
	return this.client(
		y().click(function(e) {
			if (e.preventDefault())
				e.preventDefault();
			if (href !== (location.pathname + location.search)) {
				this.env.data.agora.emit('route:update', href, title || '', data);
				window.history.pushState({
					href: href,
					title: title,
					data: data
				}, title  || '', href);
				document.title = title || '';
			}
		})
	);
};

var settings = {
	parser: function(route) {
		return new Route(route);
	},
	bindHistory: function(context) {
		if (!context.env.data.isServer) {
			var route = parseURL(location.pathname + (location.search || ''));
			context.isRouted = true;
			context.set('$route', route);
			context.onAgora('route:update', function(route, title, state) {
				this.set('$route', route);
			});
			// popstate event from back/forward in browser
			window.addEventListener('popstate', function(e) {
				var route = parseURL(location.pathname + (location.search || ''));
				context.env.data.agora.emit('route:update', route);
				document.title = e.state ? (e.state.title || '') : '';
			});
		}
	}
};

View.prototype.route = function(route, handler) {
	var index = this._queue.length + 1,
		self = this,
		route = settings.parser(route);
	return this.exec({
		dom: function(context, container, args) {
			var parentRouter,
				currentRoute,
				oldRoute,
				current,
				initialised = false,
				fakeNode = utils.hide(context.env.data.factory.createElement('div')),
				restTemplate = new Template(self._queue.slice(index));
			container.appendChild(fakeNode);
			current = fakeNode;
			context.isRouted = true;

			var exec = function($route, type) {
				if (!container.mountPoint || $route === oldRoute)
					return;
				oldRoute = $route;
				var matched = route.match($route.lastMatched || $route); //route.match($route);
				if (matched) {
					$route.lastMatched = matched;
					if (handler)
						handler.call(context, matched);
					context.set('$route', matched);
					if (!initialised) {
						restTemplate.call(container, context);
						restTemplate = null;
						initialised = true;
					}
					if (current === container)
						return;
					current = container;
					var nextSibling = utils.findNextSibling(fakeNode);
					container.removeChild(fakeNode);
					container.childNodes.forEach(function(child) {
						utils.insertBefore(container.mountPoint, child, nextSibling);
					});
				} else {
					if (current === fakeNode)
						return;
					current = fakeNode;
					container.appendChild(fakeNode);
					container.childNodes.forEach(function(child) {
						if (child !== fakeNode) {
							if (child.__yPureNode__)
								utils.unmountPureNode(child);
							else if (child.parentNode)
								child.parentNode.removeChild(child);
						}
					});
				}
			};
			parentRouter = findParentRouter(context);
			if (parentRouter) {
				container.binds = container.binds ||  [];
				parentRouter.subscribe('$route', exec, false, container.binds);
				currentRoute = parentRouter.data.$route;
			}
			container.on('mounted', function() {
				var currentRoute = parentRouter ? parentRouter.data.$route : null;
				if (currentRoute)
					exec(currentRoute, 'set');
			});

			if (currentRoute)
				exec(currentRoute, 'set');
		},
		string: function(context, descriptor, args) {

		},
		twopass: {
			firstPass: function(context, args) {

			},
			secondPass: function(context, descriptor, args) {

			}
		}
	}, null, false, true);
};

module.exports = settings;
