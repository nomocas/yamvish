/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 */
var utils = require('../../utils'),
	Switcher = require('./switcher');

module.exports = function(context, node, args) {
	var expression = args[0],
		map = args[1],
		templates = [];

	for (var i in map)
		if (i !== 'default')
			templates.push({
				value: i,
				template: map[i]
			});
	var sw = new Switcher(context, node, templates, map['default']);
	sw.expression(expression);
};
