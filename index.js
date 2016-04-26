/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var y = function(t) {
	return new y.Template(t);
};

// yamvish core
y.api = require('./lib/api');
y.env = require('./lib/env');
y.utils = require('./lib/utils');
y.AsyncManager = require('./lib/async');

var ctx = require('./lib/context');
y.Context = ctx.Context;
y.Env = ctx.Env;

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
y.emmet = require('./lib/parsers/emmet-style');

// load DOM engine by default
require('./lib/output-engine/dom/engine');
y.Container = require('./lib/output-engine/dom/container');

y.Error = function(status, message, report) {
	this.status = status;
	this.message = message;
	this.report = report;
}
y.Error.prototype = new Error();

module.exports = y;
