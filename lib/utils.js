/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
//________________________________ Properties management with dot syntax

function getProp(from, path) {
	var start = 0;
	if (path[0] === '$this')
		start = 1;
	var tmp = from;
	for (var i = start, len = path.length; i < len; ++i)
		if (!tmp || (tmp = tmp[path[i]]) === undefined)
			return;
	return tmp;
}

function deleteProp(from, path) {
	var tmp = from,
		i = 0;
	for (len = path.length - 1; i < len; ++i)
		if (tmp && !(tmp = tmp[path[i]]))
			return;
	if (tmp)
		delete tmp[path[i]];
}

function setProp(to, path, value) {
	var tmp = to,
		i = 0,
		old,
		len = path.length - 1;
	for (; i < len; ++i)
		if (tmp && !tmp[path[i]])
			tmp = tmp[path[i]] = {};
		else
			tmp = tmp[path[i]];
	if (tmp) {
		old = tmp[path[i]];
		tmp[path[i]] = value;
	}
	return old;
}

//______________________ EMPTY / DESTROY

function emptyNode(node) {
	if (!node.childNodes || !node.childNodes.length)
		return;
	for (var i = 0, len = node.childNodes.length; i < len; ++i) {
		var child = node.childNodes[i];
		if (child.parent)
			child.parent.removeChild(child);
	}
}

function destroyElement(node, removeFromParent) {
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
}

function destroyChildren(node, removeFromParent) {
	if (!node.childNodes)
		return;
	for (var i = 0; i < node.childNodes.length; i++)
		destroyElement(node.childNodes[i], removeFromParent);
}


//_______________________________________ EXPORTS

var utils = module.exports = {
	setProp: setProp,
	deleteProp: deleteProp,
	getProp: getProp,
	destroyChildren: destroyChildren,
	destroyElement: destroyElement,
	emptyNode: emptyNode,
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
	shallowMerge: function(src, target) {
		for (var i in src)
			target[i] = src[i];
	},
	shallowCopy: function(obj) {
		if (obj && obj.forEach)
			return obj.slice();
		if (obj && typeof obj === 'object') {
			if (obj instanceof RegExp || obj instanceof Date)
				return obj;
			var res = {};
			for (var i in obj)
				res[i] = obj[i];
			return res;
		}
		return obj;
	},
	copy: function(obj) {
		var clone = {};
		for (var i in obj)
			if (typeof obj[i] === 'object') {
				if (obj[i].forEach)
					clone[i] = obj[i].slice();
				else
					clone[i] = this.copy(obj[i]);
			} else
				clone[i] = obj[i];
		return clone;
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
	array: {
		remove: function(arr, value) {
			for (var i = 0, len = arr.length; i < len; ++i)
				if (arr[i] === value) {
					arr.splice(i, 1);
					return;
				}
		},
		insertAfter: function(arr, ref, newItem) {
			var index = arr.indexOf(ref);
			if (ref === -1)
				throw new Error('utils.array.insertAfter : ref not found.');
			if (index === arr.length - 1)
				arr.push(newItem);
			else
				arr.splice(index + 1, 0, newItem);
		}
	}
};
