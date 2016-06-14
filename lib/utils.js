/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var utils = module.exports = {
	/**
	 * parse api method reference as "apiname:mywidget"
	 * @param  {[type]} env  [description]
	 * @param  {[type]} path [description]
	 * @return {[type]}      [description]
	 */
	getApiMethod: function(api, path) {
		if (!path.forEach)
			path = path.split(':');
		if (path.length !== 2)
			throw new Error('yamvish method call badly formatted : ' + path.join(':'));
		if (!api[path[0]])
			throw new Error('no api found with "' + path.join(':') + '"');
		var output = api[path[0]][path[1]];
		if (!output)
			throw new Error('no template/container found with "' + path.join(':') + '"');
		return output;
	},
	toBinds: function(node, func) {
		node.binds = nodes.binds || [];
		node.binds.push(func);
	}
};

var objectUtils = require('nomocas-utils/lib/object-utils');
objectUtils.shallowMerge(objectUtils, utils);
