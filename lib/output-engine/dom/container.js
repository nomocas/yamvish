/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 */
var utils = require('../../utils'),
	Emitter = require('../../emitter');

var Container = function() {
	this.__yContainer__ = true;
	this.childNodes = [];
};

Container.prototype = new Emitter();

var proto = {
	appendChildrenToFragment: function(frag, parentNode, mounted) {
		this.parentNode = parentNode;
		for (var i = 0, len = this.childNodes.length; i < len; ++i) {
			var child = this.childNodes[i];
			if (child.__yContainer__) {
				child.parentNode = parentNode;
				child.appendChildrenToFragment(frag, parentNode, mounted);
			} else
				frag.appendChild(child);
		}
		if (mounted)
			mounted.push(this);
	},
	empty: function() {
		for (var i = 0, len = this.childNodes.length; i < len; ++i)
			utils.destroyElement(this.childNodes[i], true);
		this.childNodes = [];
	},
	mount: function(node) {
		if (typeof node === 'string')
			node = document.querySelector(node);
		utils.emptyNode(node);
		return this.appendTo(node);
	},
	appendTo: function(parent) {
		if (typeof parent === 'string')
			parent = document.querySelector(parent);
		if (parent.__yContainer__)
			parent.appendChild(this);
		else {
			this.parentNode = parent;
			for (var i = 0, len = this.childNodes.length; i < len; ++i) {
				var child = this.childNodes[i];
				if (child.__yContainer__)
					child.appendTo(parent);
				else
					parent.appendChild(child);
			}
		}
		this.emit('mounted');
		return this;
	},
	insertBeforeNode: function(node) {
		if (!node.parentNode)
			throw new Error('insertBeforeNode error : given node has no parent.');
		var frag = document.createDocumentFragment(),
			mounted = [];
		this.appendChildrenToFragment(frag, node.parentNode, mounted);
		node.parentNode.insertBefore(frag, node);
		for (var i = 0, len = mounted.length; i < len; ++i)
			mounted[i].emit('mounted');
	},
	unmount: function() {
		if (!this.parentNode) // container hasn't been mounted
			return this;

		for (var i = 0, len = this.childNodes.length; i < len; ++i) {
			var child = this.childNodes[i];
			if (child.__yContainer__)
				child.unmount();
			else
				this.parentNode.removeChild(child);
		}
		this.parentNode = null;
		this.emit('unmounted');
		return this;
	},
	appendChild: function(child) {
		if (this.parentNode) { // container has been mounted
			var nextSibling = this.nextSibling;
			if (nextSibling) {
				if (child.__yContainer__)
					child.insertBeforeNode(nextSibling);
				else
					this.parentNode.insertBefore(child, nextSibling);
			} else if (child.__yContainer__)
				child.appendTo(this.parentNode);
			else
				this.parentNode.appendChild(child);
		}
		this.childNodes.push(child);
	},
	removeChild: function(child) {
		if (typeof child === 'number') {
			var index = child;
			child = this.childNodes[index];
			if (!child)
				throw new Error('container.removeChild not found : ', index);
			this.childNodes.splice(index, 1);
		} else
			utils.array.remove(this.childNodes, child);
		if (this.parentNode) { // container has been mounted
			if (child.__yContainer__)
				child.unmount();
			else
				this.parentNode.removeChild(child);
		}
		return this;
	},
	destroyer: function() {
		var self = this;
		return function() {
			self.destroy();
		};
	},
	destroy: function() {
		this.emit('destroy', this);
		if (this.binds) {
			for (var i = 0, len = this.binds.length; i < len; i++)
				this.binds[i]();
			this.binds = null;
		}
		this.destroyed = true;
		if (this.childNodes)
			for (var i = 0; i < this.childNodes.length; i++)
				utils.destroyElement(this.childNodes[i], true);
		this.childNodes = null;
		this.context = null;
		this.comment = null;
		this.parentNode = null;
	},
	hide: function() {
		this.childNodes.forEach(function(child) {
			if (child.__yContainer__)
				return child.hide();
			if (child.style)
				child.style.display = 'none';
		});
	},
	show: function() {
		this.childNodes.forEach(function(child) {
			if (child.__yContainer__)
				return child.show();
			if (child.style)
				child.style.display = '';
		});
	},
};

Object.defineProperty(Container.prototype, "nextSibling", {
	get: function() {
		if (!this.parentNode)
			return null;
		var last = this.childNodes[this.childNodes.length - 1];
		if (last)
			return last.nextSibling;
		return null;
	}
});

utils.shallowMerge(proto, Container.prototype);

module.exports = Container;
