/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
// core
var y = function(t) {
	return new y.Template(t);
};

y.env = require('./lib/env');
y.utils = require('./lib/utils');
y.Context = require('./lib/context');
y.Template = require('./lib/template');
y.PureNode = require('./lib/pure-node');
y.Container = require('./lib/container');
y.Filter = require('./lib/filter');
var interpolable = require('./lib/interpolable');
y.interpolable = interpolable.interpolable;
y.Interpolable = interpolable.Interpolable;
y.Virtual = require('./lib/virtual');


y.addToApi = function(api, name, args, method) {

};



module.exports = y;


/*
	Polyfills for IE8/9: 

	es6-promise or promis

 */
