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
		displaceItem: function(context, fromIndex, toIndex) { self.displaceItem(context, fromIndex, toIndex); },
		insertItem: function(context, index) { self.insertItem(context, index); },
		deleteItem: function(index) { self.deleteItem(index); }
	};

	contextEacher.on('pushItem', this.listeners.pushItem);
	contextEacher.on('deleteItem', this.listeners.deleteItem);
	contextEacher.on('updateArray', this.listeners.updateArray);
	contextEacher.on('displaceItem', this.listeners.displaceItem);
	contextEacher.on('insertItem', this.listeners.insertItem);
	this.updateArray(contextEacher.children.length ? 'more' : 'equal', contextEacher.children);
};

Each.prototype = new Emitter();

var proto = {
	getItem: function(index) {
		return this.itemsContainer.childNodes[index];
	},
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
		// console.log('dom each : update array : ', this.contextEacher.path, type, difference)
		switch (type) {
			case 'equal':
				break;
			case 'more':
				// create additional items container and append
				var self = this;
				this.switch('items');
				difference.forEach(function(ctx) {
					self.pushItem(ctx, true);
				});
				break;
			case 'less':
				// remove and destroy unnecessary items containers
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
	displaceItem: function(context, fromIndex, toIndex) {
		var childNodes = this.itemsContainer.childNodes,
			node = childNodes[fromIndex];
		if (!node)
			return;
		var destination = childNodes[toIndex];
		var nextSibling = destination ? (fromIndex < toIndex ? destination.nextSibling : destination.firstChild) : this.itemWitness;
		utils.appendContainerTo(node, this.node, nextSibling);
		childNodes.splice(fromIndex, 1);
		childNodes.splice(toIndex, 0, node);
		this.emit('displaceItem', node, fromIndex, toIndex);
	},
	insertItem: function(context, index) {
		this.switch('items');
		var child = this.itemTemplate.toContainer(context, this.parentContainer),
			toMove = this.itemsContainer.childNodes[index];
		child.context = context;
		child.mountBefore(this.node, toMove ? toMove.firstChild : this.itemWitness);
		this.itemsContainer.childNodes.splice(index, 0, child);
		this.emit('insertItem', child, index);
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
