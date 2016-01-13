/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var y = require('../index');

y.Virtual = require('../lib/virtual');

require('../lib/output-engine/string');
require('../lib/output-engine/twopass');

y.router = require('yamvish-router');

module.exports = y;
