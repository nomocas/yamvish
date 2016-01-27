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
y.AsyncManager = require('./lib/async');
var interpolable = require('./lib/interpolable');
y.interpolable = interpolable.interpolable;
y.Interpolable = interpolable.Interpolable;
y.addCustomTag = require('./lib/custom-tags');
y.listenerParser = require('./lib/parsers/listener-call');
y.elenpi = require('elenpi');
y.api = require('./lib/api');
require('./lib/output-engine/dom');

y.View = require('./lib/view');
y.view = function(data, parent, path) {
	return new y.View(data, parent, path);
};
y.html = require('./lib/parsers/html-to-template');

module.exports = y;


/*
	Polyfills for IE9: 

	es6-promise or promis
	history API if router 
 */
