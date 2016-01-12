/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var y = require('./core');

y.Virtual = require('./lib/virtual');
y.router = require('./lib/router');

// parsers
y.html = require('./lib/parsers/html-string-to-template');

require('./lib/output-engine/string');
require('./lib/output-engine/twopass');


module.exports = y;
