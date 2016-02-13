/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 */
var utils = require('../../utils'),
	Switcher = require('./switcher');

module.exports = function(context, node, args) {
	var condition = args[0];
	var templates = [{
		value: true,
		template: args[1]
	}];
	if (args[2])
		templates.push({
			value: false,
			template: args[2]
		});
	var sw = new Switcher(context, node, templates);
	sw.expression(condition);
};
