/*
	TODO : 
		parsing 
			from DOM
				still data-*
			from String 				OK

		 .disabled 						OK

		if('!initialised', ..., ...) 		OK

		integrate filters and expressions

		request and c3po-bridge 			OK

		model validation  					OK

		route 								OK	

		views pool 							OK		

		collection filtering view 				OK

		.client( t1, t2, ...)
		.server(t1, t2, ...)

		promise management : catch end render / load 		OK
		
		mount/umount event 						OK

		y.dependent('bloupi', 'foo', function(bloupi, foo){});				OK
		

		y.applyToDOM(node | selector, template)		==> apply template on dom element (select it if selector)

		eventListeners : click(addUser(user)) : should retrieve user before feeding addUser



	Should :

		rename _yamvish_binds in _binds 					OK
		rename all privates vars with _*

		for each template handler : 
		add args in queue (through done) and place inner functions outside : no more closure

	Eacher : 
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
var y = function(t) {
	return new y.Template(t);
};
y.env = require('./lib/env');
y.utils = require('./lib/utils');
//y.AsyncManager = require('./lib/async');
y.Context = require('./lib/context');
y.Template = require('./lib/template');
y.PureNode = require('./lib/pure-node');
y.Virtual = require('./lib/virtual');
y.Container = require('./lib/container');
y.View = require('./lib/view');
var interpolable = require('./lib/interpolable');
y.interpolable = interpolable.interpolable;
y.Interpolable = interpolable.Interpolable;

/*
// parsers
y.elenpi = require('elenpi');
y.dom = require('./lib/parsers/dom-to-template');
y.html = require('./lib/parsers/html-string-to-template');
*/
/*
// Plugins 
var router = require('./plugins/router');
for (var i in router)
	y[i] = router[i];
y.c3po = require('./plugins/loader');
y.rql = require('./plugins/rql');
y.aright = require('./plugins/validation');
y.http = require('./plugins/http-request');
y.uploadForm = require('./plugins/form-uploader');
y.dateFormat = require('./plugins/date.format');
*/
//________________________________________________ END VIEW

module.exports = y;



/*
	Polyfills : 

	https://github.com/LuvDaSun/xhr-polyfill
	es6-promise or promis


 */
