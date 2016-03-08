/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * DOM only.
 * Container : The missing DOM node's type : a simple virtual nodes container that could (un)mounted somewhere in other dom nodes.
 */
var utils = require('../../utils'),
	Emitter = require('../../emitter');
var Container = function(parent) {
	this.__yContainer__ = true;
	this.parent = parent;
	this.childNodes = [];
};

Container.prototype = new Emitter();

var proto = {
	appendChildrenToFragment: function(frag, parentNode, mounted) {
		this.parentNode = parentNode;
		if (this.witness)
			frag.appendChild(this.witness);
		if (mounted)
			mounted.push(this);
		for (var i = 0, len = this.childNodes.length; i < len; ++i) {
			var child = this.childNodes[i];
			if (child.__yContainer__)
				child.appendChildrenToFragment(frag, parentNode, mounted);
			else
				frag.appendChild(child);
		}
		return this;
	},
	empty: function() {
		utils.destroyChildren(this.childNodes, true);
		this.childNodes = [];
		return this;
	},
	mount: function(node) {
		if (typeof node === 'string')
			node = document.querySelector(node);
		if (this.mounted && node === this.parentNode) {
			if (this.closing && this.transitionIn)
				this.transitionIn();
			return this;
		}
		utils.emptyNode(node);
		return this.appendTo(node);
	},
	appendTo: function(parent) {
		var par = parent;
		if (typeof parent === 'string')
			parent = document.querySelector(parent);
		if (this.mounted && parent === this.parentNode) {
			if (this.closing && this.transitionIn)
				this.transitionIn();
			return this;
		}
		this.mounted = true;
		if (!parent)
			throw new Error('could not mount container : no parent found with ' + par);
		if (parent.__yContainer__)
			parent.appendChild(this);
		else {
			if (this.witness)
				parent.appendChild(this.witness);
			this.parentNode = parent;
			for (var i = 0, len = this.childNodes.length; i < len; ++i) {
				var child = this.childNodes[i];
				if (child.__yContainer__)
					child.appendTo(parent);
				else
					parent.appendChild(child);
			}
		}
		this.emit('mounted', this);
		return this;
	},
	insertBeforeNode: function(node) {
		if (!node.parentNode)
			throw new Error('insertBeforeNode error : given node has no parent.');
		this.mounted = true;
		var frag = document.createDocumentFragment(),
			mounted = [];
		this.appendChildrenToFragment(frag, node.parentNode, mounted);
		node.parentNode.insertBefore(frag, node);
		for (var i = 0, len = mounted.length; i < len; ++i)
			mounted[i].emit('mounted', this);
		return this;
	},
	setWitness: function(witness) {
		this.witness = witness;
	},
	addWitness: function(title, parent) {
		if (this.witness)
			return this;
		this.witness = document.createComment(title);
		if (parent) {
			parent.appendChild(this.witness);
			return this;
		}
		if (!this.parentNode)
			return this;
		if (!this.childNodes.length) {
			console.warn('addWitness : container has been mounted without witness and children. Appending witness in parent.', this);
			this.parentNode.appendChild(this.witness);
		} else
			this.parentNode.insertBefore(this.witness, this.firstChild);
		return this;
	},
	removeWitness: function() {
		if (!this.witness)
			return this;
		if (this.witness.parentNode)
			this.witness.parentNode.removeChild(this.witness);
		this.witness = null;
		return this;
	},
	remount: function() {
		if (!this.witness.parentNode)
			throw new Error('container could not be remounted : witness has been unmounted.');
		if (this.mounted)
			if (this.closing && this.transitionIn) {
				this.transitionIn();
				return this;
			}
		var nextSibling = this.witness.nextSibling;
		if (nextSibling)
			this.insertBeforeNode(nextSibling);
		else
			this.appendTo(this.witness.parentNode);
		return this;
	},
	doUnmount: function(keepWitness) {
		if (!this.parentNode)
			return this;
		if (this.witness && !keepWitness)
			this.parentNode.removeChild(this.witness);
		for (var i = 0, len = this.childNodes.length; i < len; ++i) {
			var child = this.childNodes[i];
			if (child.__yContainer__)
				child.doUnmount();
			else
				this.parentNode.removeChild(child);
		}
		this.parentNode = null;
		this.emit('unmounted', this);
		return this;
	},
	unmount: function(keepWitness) {
		if (!this.parentNode) // container hasn't been mounted
			return this;
		if (!this._beforeUnmount)
			return this.doUnmount(keepWitness);
		var self = this;
		this._beforeUnmount(function() {
			self.doUnmount(keepWitness);
		});
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
		return this;
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
		utils.destroyElement(this, true);
		this.destroyed = true;
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
		return this;
	},
	show: function() {
		this.childNodes.forEach(function(child) {
			if (child.__yContainer__)
				return child.show();
			if (child.style)
				child.style.display = '';
		});
		return this;
	},
	beforeUnmount: function(handler) {
		this._beforeUnmount = handler;
	}
};

Object.defineProperty(Container.prototype, "nextSibling", {
	get: function() {
		if (!this.childNodes.length && this.witness)
			return this.witness.nextSibling;
		if (!this.parentNode)
			return null;
		var last = this.childNodes[this.childNodes.length - 1];
		if (last)
			return last.nextSibling;
		return null;
	}
});
Object.defineProperty(Container.prototype, "firstChild", {
	get: function() {
		var first = this.childNodes[0];
		if (first)
			if (first.__yContainer__)
				return first.firstChild;
			else
				return first;
		return null;
	}
});
Object.defineProperty(Container.prototype, "lastChild", {
	get: function() {
		var last = this.childNodes[this.childNodes.length - 1];
		if (last)
			if (last.__yContainer__)
				return last.lastChild;
			else
				return last;
		return null;
	}
});
utils.shallowMerge(proto, Container.prototype);

module.exports = Container;
