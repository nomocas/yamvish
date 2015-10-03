/*
	TODO : 
		parsing 
			from DOM
				still data-*
			from String 				OK

		if('!initialised', ..., ...)

		integrate filters and expressions

		request and c3po

		model validation + .disabled

		route

		views pool

		collection filtering view 				OK

		.client( t1, t2, ...)
		.server(t1, t2, ...)

		promise management : catch end render / load
		
		mount/umount event 						OK

		EAch : children  : place els in Virtual Node (could be many)
			==> is natural : no need... each node has it's own dom element    	OK
		//______________________
		y.dependent('bloupi', 'foo', function(bloupi, foo){});
		
		==> a dependent function should only be a value in context.data
			that is registred to dependencies (as a Interpolable)

		y.applyToDOM(node | selector, template)		==> apply template on dom element (select it if selector)

		eventListeners : click(addUser(user)) : should retrieve user before feeding addUser 

*/

//____________________________________________________ YAMVISH

var utils = require('./lib/utils');

var y = function(t) {
	return new y.Template(t);
};
y.isServer = utils.isServer;
y.utils = utils;
y.Context = require('./lib/context');
y.Template = require('./lib/template');
y.PureNode = require('./lib/pure-node');
y.Virtual = require('./lib/virtual');
y.Container = require('./lib/container');
y.View = require('./lib/view');
y.rql = require('./plugins/rql-array');
require('./plugins/rql');

var interpolable = require('./lib/interpolable');
y.interpolable = interpolable.interpolable;
y.Interpolable = interpolable.Interpolable;

// parsers
/*y.dom = require('./lib/parsers/dom-to-template');
y.html = require('./lib/parsers/html-to-template');
y.expression = require('./lib/parsers/expression');
y.elenpi = require('elenpi');*/

//________________________________________________ END VIEW

y.mainContext = null;
y.components = {};
y.addComponent = function(name, template /* or view instance */ ) {
	y.components[name] = template;
};

module.exports = y;
