/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * DOM only.
 * Container : The missing DOM node's type : a simple virtual nodes container that could be (un)mounted somewhere in other dom nodes.
 * Think it as an evoluated DocumentFragment.
 */
var utils = require('../../utils'),
	Emitter = require('nomocas-utils/lib/emitter');
var Container = function(parent) {
	this.__yContainer__ = true;
	this.parent = parent;
	this.childNodes = [];
};

Container.prototype = new Emitter();

var proto = {
	assertNotDestroyed: function() {
		if (this.destroyed)
			throw new Error('yamvish.Container : reusing container that has been destroyed');
	},
	appendChildrenToFragment: function(frag, parentNode, mounted, letWitness) {
		this.assertNotDestroyed();
		this.parentNode = parentNode;

		if (mounted)
			mounted.push(this);
		for (var i = 0, len = this.childNodes.length; i < len; ++i) {
			var child = this.childNodes[i];
			if (child.__yContainer__)
				child.appendChildrenToFragment(frag, parentNode, mounted);
			else
				frag.appendChild(child);
		}
		if (!letWitness && this.witness)
			frag.appendChild(this.witness);
		return this;
	},
	empty: function(dontKeepWitness) {
		this.childNodes.forEach(function(n) {
			if (!dontKeepWitness && n === this.witness)
				return;
			utils.destroyElement(n, true);
		}, this);
		utils.destroyChildren(this.childNodes, true);
		this.childNodes = [];
		return this;
	},
	mount: function(node) {
		this.assertNotDestroyed();
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
		this.assertNotDestroyed();
		var par = parent;
		if (typeof parent === 'string')
			parent = document.querySelector(parent);
		if (this.mounted && parent === this.parentNode) {
			if (this.closing && this.transitionIn)
				this.transitionIn();
			return this;
		}
		if (!parent)
			throw new Error('could not mount container : no parent found with ' + par);
		this.mounted = true;
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
			if (this.witness)
				parent.appendChild(this.witness);
		}
		this.emit('mounted', this);
		return this;
	},
	mountBefore: function(parent, node) {
		// console.log('container.mountBefore : ', this, parent, node);
		this.assertNotDestroyed();
		if (this.mounted && parent === this.parentNode && this.nextSibling === node) {
			if (this.closing && this.transitionIn)
				this.transitionIn();
			return this;
		}

		if (parent.__yContainer__) {
			utils.array.insertBefore(parent.childNodes, node, this);
			parent = parent.parentNode;
		}
		if (!parent)
			return this;
		var frag = document.createDocumentFragment(),
			mounted = [];
		this.mounted = true;
		this.parentNode = parent;
		this.appendChildrenToFragment(frag, parent, mounted, node === this.witness);
		parent.insertBefore(frag, node.__yContainer__ ? node.firstChild : node);
		for (var i = 0, len = mounted.length; i < len; ++i)
			mounted[i].emit('mounted', this);
		return this;
	},
	addWitness: function(title, parent) {
		this.assertNotDestroyed();
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
		this.assertNotDestroyed();
		if (this.mounted) {
			if (this.closing && this.transitionIn) {
				this.transitionIn();
			}
			return this;
		}
		if (!this.witness ||  !this.witness.parentNode)
			throw new Error('container could not be remounted : no witness or witness has been unmounted.');
		this.mountBefore(this.witness.parentNode, this.witness);
		return this;
	},
	doUnmount: function(keepWitness) {
		this.assertNotDestroyed();
		this.mounted = false;
		if (!this.parentNode)
			return this;
		if (this.witness && !keepWitness)
			this.parentNode.removeChild(this.witness);
		for (var i = 0, len = this.childNodes.length; i < len; ++i) {
			var child = this.childNodes[i];
			if (child.__yContainer__)
				child.doUnmount();
			else if (child.parentNode)
				child.parentNode.removeChild(child);
		}
		this.parentNode = null;
		this.emit('unmounted', this);
		return this;
	},
	unmount: function(keepWitness, done) {
		this.assertNotDestroyed();
		if (!this.parentNode) { // container hasn't been mounted
			if (done)
				done(this);
			return this;
		}
		if (!this._beforeUnmount) {
			this.doUnmount(keepWitness);
			if (done)
				done(this);
			return this;
		}
		var self = this;
		this._beforeUnmount(function() {
			self.doUnmount(keepWitness);
			if (done)
				done(self);
		});
		return this;
	},
	appendChild: function(child) {
		this.assertNotDestroyed();
		if (this.parentNode) { // container has been mounted
			var nextSibling = this.nextSibling;
			if (nextSibling) {
				if (child.__yContainer__)
					child.mountBefore(this.parentNode, nextSibling);
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
		this.assertNotDestroyed();
		if (typeof child === 'number') {
			var index = child;
			child = this.childNodes[index];
			if (!child)
				throw new Error('container.removeChild by index : child not found : ', index);
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
		// console.log('destroy container : ', this, this.childNodes.length);
		utils.destroyElement(this, true);
		this.mounted = false;
		this.destroyed = true;
		this.comment = null;
		this.parentNode = null;
		this.parent = null;
		this.childNodes = null;
		this.emit('destroyed', this);
	},
	hide: function() {
		this.assertNotDestroyed();
		this.childNodes.forEach(function(child) {
			if (child.__yContainer__)
				return child.hide();
			if (child.style)
				child.style.display = 'none';
		});
		return this;
	},
	show: function() {
		this.assertNotDestroyed();
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
		this.assertNotDestroyed();
		// console.log('container.nextSibling : ', this.childNodes[this.childNodes.length - 1]);
		if (this.witness)
			return this.witness;
		if (!this.childNodes.length)
			return null;
		var last = this.childNodes[this.childNodes.length - 1];
		if (last)
			return last.nextSibling;
		return null;
	}
});
Object.defineProperty(Container.prototype, "firstChild", {
	get: function() {
		this.assertNotDestroyed();
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
		this.assertNotDestroyed();
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
