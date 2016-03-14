/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var utils = module.exports = {
	destroyChildren: function(node, removeFromParent) {
		if (!node.childNodes)
			return;
		for (var i = 0; i < node.childNodes.length; i++)
			destroyElement(node.childNodes[i], removeFromParent);
	},
	destroyElement: function(node, removeFromParent) {
		if (node.context) {
			node.context.destroy();
			node.context = null;
		}

		if (node.__yContainer__) {
			if (node.childNodes && node.childNodes.length)
				destroyChildren(node, removeFromParent);
		} else {
			if (removeFromParent && node.parentNode) {
				node.parentNode.removeChild(node);
				node.parentNode = null;
			}
			if (node.childNodes && node.childNodes.length)
				destroyChildren(node);
		}
		node.childNodes = null;
		if (node.binds) {
			for (var i = 0, len = node.binds.length; i < len; i++)
				node.binds[i]();
			node.binds = null;
		}
	},
	emptyNode: function(node) {
		if (!node.childNodes || !node.childNodes.length)
			return;
		for (var i = 0, len = node.childNodes.length; i < len; ++i) {
			var child = node.childNodes[i];
			if (child.parent)
				child.parent.removeChild(child);
		}
	},
	hide: function(node) {
		if (node.__yContainer__)
			return node.hide();
		if (node.style)
			node.style.display = 'none';
		return node;
	},
	show: function(node) {
		if (node.__yContainer__)
			return node.show();
		if (node.style)
			node.style.display = '';
		return node;
	},
	insertBefore: function(parent, node, ref) {
		if (node.__yContainer__) {
			if (node.childNodes)
				for (var i = 0, len = node.childNodes.length; i < len; ++i)
					utils.insertBefore(parent, node.childNodes[i], ref);
		} else
			parent.insertBefore(node, ref);
	},
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
	},
	castNodeValueTo: function(node, type) {
		switch (type) {
			case 'text':
				return event.target.textContent;
			case 'integer':
				return parseInt(event.target.textContent, 10);
			case 'html':
				return event.target.innerHTML;
			default:
				throw new Error('content editable casting fail : unrecognised rule : ', type);
		}
	}
};

var objectUtils = require('nomocas-utils/lib/object-utils');
for (var i in objectUtils)
	utils[i] = objectUtils[i];
