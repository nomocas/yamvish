/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var y = require('./core');


y.View = require('./lib/view');

// parsers
y.elenpi = require('elenpi');
y.dom = require('./lib/parsers/dom-to-template');
y.html = require('./lib/parsers/html-string-to-template');
y.listenerParser = require('./lib/parsers/listener-call');


require('./lib/output-engine/twopass');


module.exports = y;
