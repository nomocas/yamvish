/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var utils = require('./utils'),
	PureNode = require('./pure-node'),
	Emitter = require('./emitter');

/**
 * Container Container
 */
function Container(opt /*tagName, context*/ ) {
	opt = opt || {};
	this.__yContainer__ = true;
	this.parent = opt.parent;
	this.childNodes = [];
	this._promises = [];
	PureNode.call(this, opt);
};

Container.prototype  = {
	mount: function(selector, mode, querier) {
		if (this.destroyed)
			throw new Error('yamvish container has been destroyed. could not mount anymore.');
		if (selector && (selector === this.mountPoint || selector === this.mountSelector))
			return this;
		if (!this.childNodes)
			return this;
		var node = selector;
		if (typeof node === 'string') {
			this.mountSelector = selector;
			node = (querier || utils.domQuery)(selector);
		}
		if (!node)
			throw new Error('yamvish : mount point not found : ' + selector)
		this.mountPoint = node;
		if (!mode) // mount as innerHTML : empty node before appending
			utils.emptyNode(node);

		utils.mountChildren(this, node);

		(node._yamvish_containers = node._yamvish_containers || []).push(this);
		return this.dispatchEvent('mounted', this);
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
		if (this.destroyed)
			return this;
		this.dispatchEvent('destroy', this);
		this.destroyed = true;
		if (this.childNodes)
			for (var i = 0; i < this.childNodes.length; i++)
				utils.destroyElement(this.childNodes[i], true);
		this.childNodes = undefined;
		this.context = undefined;
		this.mountPoint = undefined;
		this.mountSelector = undefined;
	},
	then: function(success, error) {
		if (this.promise)
			return this.promise.then(success, error);
		return Promise.resolve(this).then(success);
	}
};

utils.mergeProto(PureNode.prototype, Container.prototype);
utils.mergeProto(Emitter.prototype, Container.prototype);

Container.prototype.appendChild = function(child) {
	PureNode.prototype.appendChild.call(this, child);
	if (this.mountPoint)
		this.mountPoint.appendChild(child);
	return child;
};
Container.prototype.removeChild = function(child) {
	if (!this.childNodes)
		return false;
	PureNode.prototype.removeChild.call(this, child);
	if (this.mountPoint)
		this.mountPoint.removeChild(child);
	return child;
};

module.exports = Container;
