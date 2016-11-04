/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var api = require('./lib/api'),
	y = function(apiName) {
		if (apiName)
			return api.initializers[apiName];
		return new y.Template();
	};

// yamvish core
y.env = require('./lib/env');
y.utils = require('./lib/utils');

var ctx = require('./lib/context');
y.Context = ctx.Context;
y.Env = ctx.Env;

y.ContextEacher = require('./lib/context-eacher');

y.Filter = require('./lib/filter');
var interpolable = require('./lib/interpolable');
y.interpolable = interpolable.interpolable;
y.Interpolable = interpolable.Interpolable;

// Templates
y.Template = require('./lib/template');

// API management
y.toAPI = function(name, methods) {
	return api.toAPI(name, methods);
};
y.extendAPI = function(base, newName, methods) {
	return api.extendAPI(base, newName, methods);
};
y.initializer = function(name) {
	return api.initializer(name);
};
y.init = api.initializers.yamvish;

// PARSERS and related
y.elenpi = require('elenpi');
y.listenerParser = require('./lib/parsers/listener-call');
y.html = require('./lib/parsers/html-to-template');
// y.emmet = require('./lib/parsers/emmet-style');

// load DOM engine by default
require('./lib/output-engine/dom/engine');
y.Container = require('./lib/output-engine/dom/container');

y.Error = require('nomocas-utils/lib/error')

var plateform = require('nomocas-webutils/lib/plateform');
for (var i in plateform)
	y[i] = plateform[i];



module.exports = y;