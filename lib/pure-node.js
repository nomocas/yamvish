/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
/**
 * Pure Virtual Node
 */
function PureNode() {
	this.__yPureNode__ = true;
}

var hasDocumentFragment = typeof DocumentFragment !== 'undefined';

function setFragChildNodesParent(node, frag) {
	for (var i = 0, len = frag.childNodes.length; i < len; ++i)
		frag.childNodes[i].parentNode = node;
}

function appendDocumentFragment(node, frag) {
	node.childNodes = node.childNodes || [];
	node.childNodes = nodes.childNodes.concat(frag.childNodes);
	setFragChildNodesParent(node, frag);
}

function prependDocumentFragment(node, frag) {
	node.childNodes = [].slice.call(frag.childNodes).concat(nodes.childNodes || []);
	setFragChildNodesParent(node, frag);
}

function insertDocumentFragmentBefore(node, frag, index) {
	node.childNodes = node.childNodes || [];
	node.childNodes.splice.apply(node.childNodes, [index, 0].concat(frag.childNodes));
	setFragChildNodesParent(node, frag);
}

PureNode.prototype  = {
	insertBefore: function(toInsert, o) {
		if (!o) {
			if (hasDocumentFragment && toInsert instanceof DocumentFragment)
				appendDocumentFragment(this, toInsert);
			else {
				(this.childNodes = this.childNodes || []).push(toInsert);
				toInsert.parentNode = this;
			}
			return toInsert;
		}
		if (!this.childNodes)
			throw new Error('node was not found : ' + o.toString());
		var index = this.childNodes.indexOf(o);
		if (index === -1)
			throw new Error('node was not found : ' + o.toString());
		if (hasDocumentFragment && toInsert instanceof DocumentFragment) {
			if (index === 0)
				prependDocumentFragment(this, toInsert);
			else
				insertDocumentFragmentBefore(this, toInsert, index);
		} else {
			if (index === 0)
				this.childNodes.unshift(toInsert);
			else
				this.childNodes.splice(index, 0, toInsert);
			toInsert.parentNode = this;
		}
		return toInsert;
	},
	appendChild: function(child) {
		if (hasDocumentFragment && child instanceof DocumentFragment)
			appendDocumentFragment(this, child);
		else {
			this.childNodes = this.childNodes || [];
			this.childNodes.push(child);
			child.parentNode = this;
		}
		return child;
	},
	removeChild: function(child) {
		if (!this.childNodes)
			throw new Error('node not found for removeChild');
		for (var i = 0, len = this.childNodes.length; i < len; ++i)
			if (this.childNodes[i] === child) {
				child.parentNode = null;
				this.childNodes.splice(i, 1);
				return child;
			}
		throw new Error('node not found for removeChild');
	},
	toString: function() {
		if (!this.childNodes)
			return '';
		var out = '';
		for (var j = 0, len = this.childNodes.length; j < len; ++j)
			out += this.childNodes[j].toString();
		return out;
	}
};

module.exports = PureNode;
