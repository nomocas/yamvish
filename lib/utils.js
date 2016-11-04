/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var utils = module.exports = {
	toBinds: function(node, func) {
		node.binds = nodes.binds || [];
		node.binds.push(func);
	}
};

var objectUtils = require('nomocas-utils/lib/object-utils');
objectUtils.shallowMerge(objectUtils, utils);