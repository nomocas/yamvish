/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * Switcher : inner class that hold bunch of templates associated with a value.
 * DOM only.
 * It allows to switch between templates (rendered and mounted as Container) somewhere in DOM.
 */

var utils = require('../../utils'),
	interpolable = require('../../interpolable').interpolable;

var Switcher = function(context, node, parentContainer, items, destructOnSwitch, sequencedSwitch) {
	this.node = node;
	this.context = context;
	this.items = items;
	this.sequencedSwitch = sequencedSwitch;
	this.parentContainer = parentContainer;
	this.destructOnSwitch = destructOnSwitch;
	var self = this;
	node.binds = node.binds ||  [];
	node.binds.push(function() {
		self.destroy();
	});
	items.forEach(function(item) {
		var witness = document.createComment('switcher : ' + item.value);
		node.appendChild(witness); // dummy dom position marker
		item.witness = witness;
		if (item.value === 'default')
			self.defaultItem = item;
	});
};

Switcher.prototype = {
	destroy: function() {
		// console.log('switcher destroy');
		this.interpolableInstance.destroy();
		this.interpolableInstance = null;
		var item;
		for (var i in this.items) {
			item = this.items[i];
			if (item.container)
				item.container.destroy();
			if (item.witness.parentNode)
				item.witness.parentNode.removeChild(item.witness);
		}
		this.node = null;
		this.context = null;
		this.witness = null;
		this.items = null;
		this.parentContainer = null;
		this.defaultItem = null;
	},
	expression: function(expression) {
		expression = interpolable(expression);
		if (expression.__interpolable__) {
			var self = this;
			this.interpolableInstance = expression.subscribeTo(this.context, function(value) {
				self.switch(value);
			});
			this.switch(expression.output(this.context));
		} else if (typeof expression === 'function')
			this.switch(expression(this.context));
		else
			this.switch(expression);
	},
	switch: function(value) {
		var self = this,
			ok = this.items.some(function(item) {
				if (item.value == value) {
					if (!item.container)
						item.container = item.template.toContainer(self.context, self.parentContainer);
					self._mount(item.container);
					return true;
				}
			});
		if (!ok) {
			if (this.defaultTemplate) {
				if (!this.defaultContainer)
					this.defaultContainer = this.defaultTemplate.toContainer(this.context, this.parentContainer);
				self._mount(this.defaultContainer);
			} else
				self._unmountCurrent();
		}
	},
	_unmountCurrent: function() {
		if (this.currentContainer) {
			var cur = this.currentContainer,
				self = this;
			cur.unmount(false, function() {
				if (self.node.__yContainer__)
					self.node.removeChild(cur);
				if (self.destructOnSwitch) {
					cur.context = null;
					cur.destroy();
				}
			});
			this.currentContainer = null;
		}
	},
	_mount: function(container) {
		if (this.currentContainer === container)
			return;
		this._unmountCurrent();
		this.currentContainer = container;

		if (this.node.__yContainer__ && !this.node.parentNode) { // node is not mounted
			utils.array.insertAfter(this.node.childNodes, this.witness, container);
			return;
		}
		var nextSibling = this.witness.nextSibling;
		if (nextSibling)
			container.insertBeforeNode(nextSibling);
		else
			container.appendTo(this.witness.parentNode);
	}
};

module.exports = Switcher;
