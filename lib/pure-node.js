/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
/**
 * Pure Virtual Node
 */
function PureNode() {
	this.__yPureNode__ = true;
}

PureNode.prototype  = {
	insertBefore: function(toInsert, o) {
		if (!o) {
			(this.childNodes = this.childNodes || []).push(toInsert);
			return toInsert;
		}
		if (!this.childNodes)
			throw new Error('node was not found : ' + o.toString());
		var index = this.childNodes.indexOf(o);
		if (index == -1)
			throw new Error('node was not found : ' + o.toString());
		if (index == 0)
			this.childNodes.unshift(toInsert);
		else
			this.childNodes.splice(index, 0, toInsert);
		return toInsert;
	},
	appendChild: function(child) {
		this.childNodes = this.childNodes || [];
		this.childNodes.push(child);
		child.parentNode = this;
		return child;
	},
	removeChild: function(child) {
		if (!this.childNodes)
			return false;
		for (var i = 0, len = this.childNodes.length; i < len; ++i)
			if (this.childNodes[i] === child) {
				child.parentNode = null;
				this.childNodes.splice(i, 1);
				return child;
			}
		return false;
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
