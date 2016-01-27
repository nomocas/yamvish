/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * a container is a virtual dom node that holds children that could be mounted and unmounted on any other node (virtual or not).
 */

var utils = require('./utils'),
	PureNode = require('./pure-node'),
	Emitter = require('./emitter');

/**
 * Container Container
 */
function Container(parent) {
	PureNode.call(this);
	this.__yContainer__ = true;
	this.childNodes = [];
	if (parent)
		this.parent = parent;
};

Container.prototype  = {
	/**
	 * mount container in selector
	 * @param  {[type]} selector [description]
	 * @param  {[type]} mode     could be : null, appendTo, insertBefore
	 * @return {[type]}          [description]
	 */
	mount: function(selector, mode) {
		if (this.destroyed)
			throw new Error('yamvish container has been destroyed. could not mount anymore.');
		if (selector && (selector === this.mountPoint || selector === this.mountSelector))
			return this;
		var node = selector;
		if (typeof node === 'string') {
			this.mountSelector = selector;
			node = utils.domQuery(selector);
		}
		if (!node)
			throw new Error('yamvish : mount point not found : ' + selector);

		if (mode === 'insertBefore') {
			this.mountPoint = node.parentNode;
			if (!this.mountPoint)
				throw new Error('container mount fail : no parent found for insertBefore');
			this.mountSelector = null;
			utils.mountChildren(this, this.mountPoint, node);
		} else {
			this.mountPoint = node;
			// console.log('Container.mount : ', this, selector);
			if (!mode && node.childNodes && node.childNodes.length) // mount as innerHTML : empty node before appending
				utils.emptyNode(node);

			utils.mountChildren(this, node);
		}

		return this.emit('mounted', this);
	},
	mountBefore: function(nextSiblingSelector) {
		return this.mount(nextSiblingSelector, 'insertBefore');
	},
	appendTo: function(selector) {
		return this.mount(selector, 'append');
	},
	unmount: function() {
		if (!this.mountPoint)
			return this;
		for (var i = 0; i < this.childNodes.length; i++)
			this.mountPoint.removeChild(this.childNodes[i]);
		this.mountPoint = null;
		this.mountSelector = null;
		return this.emit('unmounted', this);
	},
	destroyer: function() {
		var self = this;
		return function() {
			self.destroy();
		};
	},
	destroy: function() {
		// console.log('Container destroy :', this);
		if (this.destroyed)
			throw new Error('yamvish container has been destroyed. could not mount anymore.');
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
		this.mountPoint = null;
		this.mountSelector = null;
	},
	hide: function() {
		if (this.destroyed)
			return this;
		this.childNodes.forEach(function(child) {
			if (!child.style)
				child.style = {};
			child.style.display = 'none';
		});
	},
	show: function() {
		if (this.destroyed)
			return this;
		this.childNodes.forEach(function(child) {
			if (child.style)
				child.style.display = '';
		});
	}
};

utils.shallowMerge(PureNode.prototype, Container.prototype);
utils.shallowMerge(Emitter.prototype, Container.prototype);

Container.prototype.appendChild = function(child, nextSibling) {
	PureNode.prototype.appendChild.call(this, child);
	if (this.mountPoint) {
		nextSibling = nextSibling || utils.findNextSibling(this);
		if (child.__yPureNode__ && !child.__yVirtual__)
			utils.mountChildren(child, this.mountPoint, nextSibling);
		else if (nextSibling)
			this.mountPoint.insertBefore(child, nextSibling);
		else
			this.mountPoint.appendChild(child);
	}
	return child;
};
Container.prototype.removeChild = function(child) {
	if (!this.childNodes)
		return false;
	PureNode.prototype.removeChild.call(this, child);
	if (this.mountPoint)
		utils.removeChild(this.mountPoint, child);
	return child;
};
Container.prototype.insertBefore = function(child, ref) {
	if (!this.childNodes)
		return false;
	PureNode.prototype.insertBefore.call(this, child, ref);
	if (this.mountPoint)
		utils.insertBefore(this.mountPoint, child, ref);
	return child;
};

module.exports = Container;
