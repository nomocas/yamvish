/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * Switcher : inner class that hold bunch of templates associated with a value.
 * DOM only.
 * It allows to switch between templates (rendered and mounted as Container) somewhere in DOM.
 */

var utils = require('../../utils'),
	interpolable = require('../../interpolable').interpolable;

var Switcher = function(context, node, parentContainer, items, defaultTemplate) {
	this.witness = document.createComment('switcher');
	node.appendChild(this.witness); // dummy dom position marker
	this.node = node;
	this.context = context;
	this.items = items;
	this.defaultTemplate = defaultTemplate;
};

Switcher.prototype = {
	expression: function(expression) {
		expression = interpolable(expression);
		if (expression.__interpolable__) {
			var self = this;
			expression.subscribeTo(this.context, function(value) {
				self.switch(value);
			});
			this.switch(expression.output(this.context));
		} else if (typeof expression === 'function')
			this.switch(expression(this.context));
		else
			this.switch(expression);
	},
	switch: function(value) {
		var self = this;
		var ok = this.items.some(function(item) {
			if (item.value == value) {
				if (!item.container)
					item.container = item.template.toContainer(self.context);
				self._mount(item.container);
				return true;
			}
		});
		if (!ok) {
			if (this.defaultTemplate) {
				if (!this.defaultContainer)
					this.defaultContainer = this.defaultTemplate.toContainer(this.context);
				self._mount(this.defaultContainer);
			} else
				self._unmountCurrent();
		}
	},
	_unmountCurrent: function() {
		if (this.currentContainer) {
			if (this.node.__yContainer__)
				this.node.removeChild(this.currentContainer);
			else
				this.currentContainer.unmount();
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
