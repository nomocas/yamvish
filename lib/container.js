/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

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
	 * @param  {[type]} querier  [description]
	 * @return {[type]}          [description]
	 */
	mount: function(selector, mode, querier) {
		if (this.destroyed)
			throw new Error('yamvish container has been destroyed. could not mount anymore.');
		if (selector && (selector === this.mountPoint || selector === this.mountSelector))
			return this;
		var node = selector;
		if (typeof node === 'string') {
			this.mountSelector = selector;
			node = (querier || utils.domQuery)(selector);
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
			if (!mode) // mount as innerHTML : empty node before appending
				utils.emptyNode(node);

			utils.mountChildren(this, node);
		}

		return this.dispatchEvent('mounted', this);
	},
	mountBefore: function(nextSiblingSelector, querier) {
		return this.mount(nextSiblingSelector, 'insertBefore', querier);
	},
	appendTo: function(selector, querier) {
		return this.mount(selector, 'append', querier);
	},
	unmount: function() {
		if (!this.mountPoint)
			return this;
		for (var i = 0; i < this.childNodes.length; i++)
			this.mountPoint.removeChild(this.childNodes[i]);
		this.mountPoint = null;
		this.mountSelector = null;
		return this.dispatchEvent('unmounted', this);
	},
	destroy: function() {
		// console.log('Container destroy :', this);
		if (this.destroyed)
			return this;
		this.dispatchEvent('destroy', this);
		this.destroyed = true;
		if (this.childNodes)
			for (var i = 0; i < this.childNodes.length; i++)
				utils.destroyElement(this.childNodes[i], true);
		this.childNodes = null;
		this.context = null;
		this.mountPoint = null;
		this.mountSelector = null;
		if (this._route) {
			if (this._route.unbind)
				this._route.unbind();
			this._route = null;
		}
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
	},
	done: function(success, error) {
		if (this.destroyed)
			return Promise.reject(new Error('yamvish container has been destroyed : nothing to wait for.'));
		if (this.promise)
			return this.promise.then(success, error);
		return Promise.resolve(this).then(success);
	}
};

utils.mergeProto(PureNode.prototype, Container.prototype);
utils.mergeProto(Emitter.prototype, Container.prototype);

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
