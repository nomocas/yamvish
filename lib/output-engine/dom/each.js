/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * DOM only.
 */
var utils = require('../../utils'),
	Container = require('./container'),
	Context = require('../../context'),
	Switcher = require('./switcher');

// Template .each method for DOM handling
var each = function(context, node, args) {
	var eacher = new Each(context, node, args[1], args[2]),
		data = args[0];
	if (typeof data === 'string') {
		node.binds = node.binds ||  [];
		context.subscribe(data, function(value, type, path, index) {
			switch (type) {
				case 'delete':
					eacher.updateArray([]);
					break;
				case 'reset':
				case 'set':
					eacher.updateArray(value);
					break;
				case 'push':
					eacher.pushItem(value);
					break;
				case 'removeAt':
					eacher.deleteItem(index);
					break;
			}
		}, false, node.binds);
		context.subscribe(data + '.*', function(value, type, path, index) {
			eacher.updateItem(index, value);
		}, false, node.binds);
		data = context.get(data);
	}
	eacher.updateArray(data);
};


// Each : Class that inherits from Switcher and does items-list/empty management
var Each = function(context, node, itemTemplate, emptyTemplate) {
	this.itemTemplate = itemTemplate;
	this.itemsContainer = new Container();
	var templates = [{
		value: 'items',
		container: this.itemsContainer
	}];
	if (emptyTemplate)
		templates.push({
			value: 'empty',
			template: emptyTemplate
		});
	Switcher.call(this, context, node, templates);
};

Each.prototype = {
	_createItem: function(value) {
		var ctx = new Context(value, this.context),
			child = this.itemTemplate.toContainer(ctx);
		child.context = ctx;
		return child;
	},
	updateArray: function(array) {
		if (!array || !array.length) {
			this.switch('empty');
			if (this.itemsContainer)
				this.itemsContainer.empty();
			return;
		}
		this.switch('items');
		var items = this.itemsContainer.childNodes;

		// reset existing
		var i = 0,
			len = Math.min(items.length, array.length);
		for (; i < len; ++i)
			items[i].context.reset(array[i]);

		if (len < items.length) {
			// array has less elements than rendered items : remove items from i to items.length
			len = items.length;
			var start = i;
			for (; i < len; ++i)
				items[i].destroy();
			items.splice(start);
		} else if (len < array.length) {
			// array has more elements than rendered items : add new items from i to array.length
			var frag = this.itemsContainer.parentNode ? document.createDocumentFragment() : null;
			len = array.length;
			for (; i < len; ++i) {
				var item = this._createItem(array[i]);
				items.push(item);
				if (frag)
					item.appendChildrenToFragment(frag, this.itemsContainer.parentNode);
			}
			if (frag)
				appendFragment(frag, this.itemsContainer.parentNode, this.itemsContainer.nextSibling || this.witness.nextSibling);
		}
	},
	updateItem: function(index, value) {
		var node = this.itemsContainer.childNodes[index];
		if (node)
			node.context.reset(value);
	},
	pushItem: function(data) {
		this.switch('items');
		var item = this._createItem(data);
		if (this.itemsContainer.childNodes.length)
			return this.itemsContainer.appendChild(item);
		if (this.witness.parentNode)
			item.insertBeforeNode(this.witness.nextSibling);
		this.itemsContainer.childNodes.push(item);
	},
	deleteItem: function(index) {
		this.itemsContainer.removeChild(index);
		if (!this.itemsContainer.childNodes.length)
			this.switch('empty');
	}
};

function appendFragment(frag, parent, nextSibling) {
	if (nextSibling)
		parent.insertBefore(frag, nextSibling);
	else
		parent.appendChild(frag);
}

utils.shallowMerge(Switcher.prototype, Each.prototype);

module.exports = {
	Each: Each,
	each: each
};
