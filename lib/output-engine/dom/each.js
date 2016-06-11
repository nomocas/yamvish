/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * DOM-output dedicated eacher.
 * Binded collection manager (aka .each(...)) with dom containers management
 */
var utils = require('../../utils'),
	Container = require('./container'),
	Emitter = require('nomocas-utils/lib/emitter'),
	ContextEacher = require('../../context-eacher'),
	Switcher = require('./switcher');

// Template .each method for DOM handling
var each = function(context, node, args, parentContainer) {
	var data = args[0],
		itemTemplate = args[1],
		emptyTemplate = args[2],
		initialiser = args[3],
		dataIsString = typeof data === 'string',
		contextEacher = dataIsString ? context.getEacher(data) : new ContextEacher(context, data),
		eacher = new Each(contextEacher, node, itemTemplate, emptyTemplate, parentContainer);

	if (initialiser)
		initialiser(eacher, contextEacher, context, node, parentContainer);
};

// Each : Class that inherits from Switcher and does items-list/empty management
var Each = function(contextEacher, node, itemTemplate, emptyTemplate, parentContainer) {
	this.itemTemplate = itemTemplate;
	this.itemsContainer = new Container();
	this.contextEacher = contextEacher;

	var templates = [],
		self = this;

	if (emptyTemplate)
		templates.push({
			value: 'empty',
			template: emptyTemplate
		});

	var trueItem = {
		value: 'items',
		container: this.itemsContainer
	};
	templates.push(trueItem);

	Switcher.call(this, contextEacher.context, node, parentContainer, templates);
	this.itemWitness = trueItem.witness;
	this.listeners = {
		pushItem: function(context) { self.pushItem(context); },
		updateArray: function(type, difference) { self.updateArray(type, difference); },
		displaceItem: function(context, indexes) { self.displaceItem(context, indexes); },
		deleteItem: function(index) { self.deleteItem(index); }
	};

	contextEacher.on('pushItem', this.listeners.pushItem);
	contextEacher.on('deleteItem', this.listeners.deleteItem);
	contextEacher.on('updateArray', this.listeners.updateArray);
	contextEacher.on('displaceItem', this.listeners.displaceItem);
	this.updateArray(contextEacher.children.length ? 'more' : 'equal', contextEacher.children);
};

Each.prototype = new Emitter();

var proto = {
	destroy: function() {
		this.contextEacher.off('pushItem', this.listeners.pushItem);
		this.contextEacher.off('deleteItem', this.listeners.deleteItem);
		this.contextEacher.off('updateArray', this.listeners.updateArray);
		this.contextEacher.off('displaceItem', this.listeners.displaceItem);
		this.contextEacher = null;
		this.itemTemplate = null;
		this.itemsContainer = null;
		Switcher.prototype.destroy.call(this);
	},
	pushItem: function(context, noEmit) {
		if (!noEmit)
			this.switch('items');
		var child = this.itemTemplate.toContainer(context, this.parentContainer);
		child.context = context;
		child.mountBefore(this.node, this.itemWitness);
		this.itemsContainer.childNodes.push(child);
		if (!noEmit)
			this.emit('pushItem', child);
	},
	updateArray: function(type, difference) {
		switch (type) {
			case 'equal':
				break;
			case 'more':
				// create items container and append
				var self = this;
				this.switch('items');
				difference.forEach(function(ctx) {
					self.pushItem(ctx, true);
				});
				break;
			case 'less':
				// remove and destroy all items containers
				var childNodes = this.itemsContainer.childNodes,
					start = difference[0].index,
					container;
				for (var i = start, len = childNodes.length; i < len; ++i)
					childNodes[i].destroy();
				this.itemsContainer.childNodes = childNodes.slice(0, start);
				break;
		}
		if (!this.itemsContainer.childNodes.length)
			this.switch('empty');
		this.emit('updateArray', this);
	},
	displaceItem: function(context, indexes) {
		var childNodes = this.itemsContainer.childNodes,
			node = childNodes[indexes.fromIndex];
		if (!node)
			return;
		var destination = childNodes[indexes.toIndex];
		var nextSibling = destination ? (indexes.fromIndex < indexes.toIndex ? destination.nextSibling : destination.firstChild) : this.itemWitness;
		utils.appendContainerTo(node, this.node, nextSibling);
		childNodes.splice(indexes.fromIndex, 1);
		childNodes.splice(indexes.toIndex, 0, node);
		this.emit('displaceItem', node, indexes);
	},
	deleteItem: function(index) {
		var childNodes = this.itemsContainer.childNodes,
			node = childNodes[index];
		if (!node) {
			console.warn('eacher.deleteItem : no node found with %s. aborting.', index);
			return;
		}
		var self = this;
		node.unmount(false, function() {
			childNodes.splice(index, 1);
			node.destroy();
			if (!childNodes.length)
				self.switch('empty');
			self.emit('deleteItem', node, index);
		});
	}
};

utils.shallowMerge(proto, Each.prototype);
utils.shallowMerge(Switcher.prototype, Each.prototype);

module.exports = each;
