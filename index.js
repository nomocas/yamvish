/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var y = function(t) {
	return new y.Template(t);
};

// yamvish core
y.api = require('./lib/api');
y.env = require('./lib/env');
y.utils = require('./lib/utils');
y.AsyncManager = require('./lib/async');
y.Context = require('./lib/context');
y.Filter = require('./lib/filter');
var interpolable = require('./lib/interpolable');
y.interpolable = interpolable.interpolable;
y.Interpolable = interpolable.Interpolable;

// Templates
y.Template = require('./lib/template');

// API management
y.addCustomTag = require('./lib/custom-tags');
y.toAPI = function(apiName, methodsObj) {
	var api = y.api[apiName] = y.api[apiName] || {};
	y.utils.shallowMerge(methodsObj, api);
	return api;
};

// PARSERS and related
y.elenpi = require('elenpi');
y.listenerParser = require('./lib/parsers/listener-call');
y.html = require('./lib/parsers/html-to-template');

// DOM engine
y.Container = require('./lib/output-engine/dom/container');
require('./lib/output-engine/dom/engine');

module.exports = y;
