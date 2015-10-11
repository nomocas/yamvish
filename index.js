/*
	TODO : 
		parsing 
			from DOM
				still data-*
			from String 				OK

		 .disabled

		if('!initialised', ..., ...) 		// almost done

		integrate filters and expressions

		request and c3po-bridge 			OK

		model validation  

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




	Parser : 
		split html texts in static/interpolable atoms
		interpret with new Function() to allow complexe expression

	Should :

		rename _yamvish_binds in _binds 					OK
		rename all privates vars with _*

		for each template handler : 
		add args in queue (through done) and place inner functions outside : no more closure

	Context with * 					OK

		could register to path.*
		and receive the * as key  +  value
		then items[key].reset(value)


	Eacher : 

		hybrid structure ?												OK
			virtual that could contains real DOM node in childNodes

		associate to real DOMNode that execute 'each' the virtual node that hold children  		OK

		==> maybe introduce special token/tag/comment for each/filter/sort 
			=> it resolves the html/js template equivalence
		e.g. 

			<div ...>
				<h1>...</h1>
				<each:users filter="name" sort="lastname">
						

				</each>
				...
				<each:events>
					

				</each>
				...
				<todo-list:todoId  />
			</div>



	ES5/6


		arrows everywhere

		arguments manip

		simple interpolation

		classes

		...


 */


//____________________________________________________ YAMVISH


// core
var utils = require('./lib/utils');
var y = function(t) {
	return new y.Template(t);
};
y.env = require('./lib/env');
y.isServer = utils.isServer;
y.utils = utils;
y.Context = require('./lib/context');
y.Template = require('./lib/template');
y.PureNode = require('./lib/pure-node');
y.Virtual = require('./lib/virtual');
y.Container = require('./lib/container');
y.View = require('./lib/view');
var interpolable = require('./lib/interpolable');
y.interpolable = interpolable.interpolable;
y.Interpolable = interpolable.Interpolable;

// parsers
y.elenpi = require('elenpi');
y.dom = require('./lib/parsers/dom-to-template');
y.html = require('./lib/parsers/html-to-template');
// y.expression = require('./lib/parsers/expression');

// Plugins 
var router = require('./plugins/router');
for (var i in router)
	y[i] = router[i];
y.c3po = require('./plugins/c3po-bridge');
y.rql = require('./plugins/rql');
y.aright = require('./plugins/validation');

//________________________________________________ END VIEW

y.mainContext = null;
y.components = {};
y.addComponent = function(name, template /* or view instance */ ) {
	y.components[name] = template;
};

module.exports = y;
