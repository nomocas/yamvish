/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
var utils = module.exports = {
	insertHTML: function(content, node, nextSibling) {
		if (!content)
			return;
		var elems = [],
			div = document.createElement('div'),
			wrapped;
		if (content[0] !== '<') { // to avoid bug of text node that disapear
			content = '<p>' + content + '</p>';
			wrapped = true;
		}
		div.innerHTML = content;
		var parent = wrapped ? div.firstChild : div,
			childNodes = [].slice.call(parent.childNodes),
			frag;
		if (nextSibling)
			frag = new DocumentFragment();
		for (var i = 0, len = childNodes.length; i < len; ++i) {
			var el = childNodes[i];
			elems.push(el)
			if (!nextSibling)
				node.appendChild(el);
			else
				frag.appendChild(el);
		}
		if (nextSibling)
			node.insertBefore(frag, nextSibling);
		return elems;
	},
	destroyChildren: function(node, removeFromParent) {
		if (!node.childNodes)
			return;
		var childNodes = node.childNodes;
		if (removeFromParent)
			childNodes = [].slice.call(childNodes);
		for (var i = 0; i < childNodes.length; i++)
			utils.destroyElement(childNodes[i], removeFromParent);
	},
	destroyElement: function(node, removeFromParent) {
		// console.log('utils.destroyElement : ', node, removeFromParent);
		if (node.__yContainer__) {
			if (node.childNodes)
				utils.destroyChildren(node, removeFromParent);
		} else {
			if (removeFromParent && node.parentNode)
				node.parentNode.removeChild(node);
			if (node.nodeType === 1)
				utils.destroyChildren(node);
		}
		if (node.binds) {
			for (var i = 0, len = node.binds.length; i < len; i++)
				node.binds[i]();
			node.binds = null;
		}
		if (node.context) {
			node.context.destroy();
			node.context = null;
		}
	},
	emptyNode: function(node) {
		if (!node.childNodes || !node.childNodes.length)
			return;
		while (node.firstChild)
			node.removeChild(node.firstChild);
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
	appendContainerTo: function(container, parent, nextSibling) {
		var frag = document.createDocumentFragment();
		container.appendChildrenToFragment(frag, parent);
		if (nextSibling)
			parent.insertBefore(frag, nextSibling);
		else
			parent.appendChild(frag);
	},
	castNodeValueTo: function(node, type) {
		switch (type) {
			case 'text':
				return node.textContent;
			case 'integer':
				return parseInt(node.textContent, 10);
			case 'html':
				return node.innerHTML;
			default:
				throw new Error('content editable casting fail : unrecognised rule : ', type);
		}
	}
};
