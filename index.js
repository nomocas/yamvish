/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var y = require('./core');


// parsers
y.elenpi = require('elenpi');
y.dom = require('./lib/parsers/dom-to-template');
y.html = require('./lib/parsers/html-string-to-template');
y.listenerParser = require('./lib/parsers/listener-call');

module.exports = y;
