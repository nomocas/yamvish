/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * DOM only.
 * Collection manager (aka .each(...))
 *
 *
 *
 * to be rewrited : 
 * 
 * we need an eacher that manage array of pure contexts (or proxy) based on initial collection updates
 *
 * eacher.manage(context, collectionPath)
 * 		subscribe to collection updates and manage local context array
 * 
 * eacher.addRenderer(node, args, parentContainer, template, emptyTemplate)
 */
var utils = require('../../utils'),
	Container = require('./container'),
	Emitter = require('nomocas-utils/lib/emitter'),
	Context = require('../../context').Context,
	Switcher = require('./switcher');

// Template .each method for DOM handling
var each = function(context, node, args, parentContainer) {
	var eacher = new Each(context, node, args[1], args[2], parentContainer),
		data = args[0],
		initialiser = args[3];

	if (typeof data === 'string') {
		node.binds = node.binds ||  [];
		eacher.varPath = data;
		var splitted = data.split('.');
		context.subscribe(data, function(value, type, path, index) {
			// console.log('eacher : data update : |%s|', type, value, path, index)
			switch (type) {
				case 'delete':
					eacher.updateArray([]);
					break;
				case 'reset':
				case 'set':
					eacher.updateArray(value);
					break;
				case 'push':
					eacher.pushItem(value, index);
					break;
				case 'removeAt':
					eacher.deleteItem(index);
					break;
			}
		}, false, node.binds);
		context.subscribe(data + '.*', function(value, type, path, index) {
			var p = path.slice(splitted.length);
			// console.log('each data.* update : ', type, value, path, index, p)
			eacher.updateItem(type, p.slice(1), value, index, p[0]);
		}, true, node.binds);
		data = context.get(data);
	}
	eacher.updateArray(data);
	if (initialiser)
		initialiser(eacher, context, node, parentContainer);
};


// Each : Class that inherits from Switcher and does items-list/empty management
var Each = function(context, node, itemTemplate, emptyTemplate, parentContainer) {
	this.itemTemplate = itemTemplate;
	this.itemsContainer = new Container();
	this.parentContainer = parentContainer;
	var templates = [{
		value: 'items',
		container: this.itemsContainer
	}];
	if (emptyTemplate)
		templates.push({
			value: 'empty',
			template: emptyTemplate
		});
	Switcher.call(this, context, node, parentContainer, templates);
};

Each.prototype = new Emitter();

var proto = {
	_createItem: function(value, index) {
		var ctx = new Context(value, this.context),
			self = this,
			child = this.itemTemplate.toContainer(ctx, this.parentContainer);
		child.context = ctx;
		ctx.index = index;
		ctx.path = self.varPath + '.' + index;
		return child;
	},
	updateArray: function(array) {
		var itemsContainer = this.itemsContainer;
		if (!array || !array.length) {
			this.switch('empty');
			if (itemsContainer)
				itemsContainer.empty();
			return;
		}
		this.switch('items');
		var items = itemsContainer.childNodes,
			i = 0,
			len = Math.min(items.length, array.length);
		// reset existing
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
			var frag = itemsContainer.parentNode ? document.createDocumentFragment() : null,
				nextSibling = itemsContainer.nextSibling || this.witness.nextSibling;

			len = array.length;
			for (; i < len; ++i) {
				var item = this._createItem(array[i], i);
				items.push(item);
				if (frag)
					item.appendChildrenToFragment(frag, itemsContainer.parentNode);
			}
			if (frag)
				appendFragment(frag, itemsContainer.parentNode, nextSibling);
		}
	},
	updateItem: function(type, path, value, index, key) {
		var node = this.itemsContainer.childNodes[index];
		if (node) {
			// console.log('each update item : ', type, node.context.path, path, value);
			if (!path.length)
				node.context.reset(value);
			else
				node.context.set(path, value);
		}
	},
	pushItem: function(data, index) {
		this.switch('items');
		var item = this._createItem(data, index),
			nextSibling = this.witness.nextSibling;
		if (this.itemsContainer.childNodes.length || !nextSibling) {
			this.itemsContainer.appendChild(item);
			this.emit('item-pushed', this, item);
			return;
		}
		if (nextSibling) {
			item.insertBeforeNode(nextSibling);
			this.itemsContainer.childNodes.push(item);
		}
		this.emit('item-pushed', this, item);
	},
	deleteItem: function(index) {
		var node = this.itemsContainer.childNodes[index];
		node.doUnmount();
		var children = this.itemsContainer.childNodes;
		children.splice(index, 1);
		if (!children.length)
			this.switch('empty');
		else
			for (var i = index, len = children.length; i < len; ++i) {
				children[i].context.index = i;
				children[i].context.path = this.varPath + '.' + i;
			}
	}
};

function appendFragment(frag, parent, nextSibling) {
	// console.log('append to fragment : ', frag, parent, nextSibling);
	if (nextSibling)
		parent.insertBefore(frag, nextSibling);
	else
		parent.appendChild(frag);
}

utils.shallowMerge(proto, Each.prototype);
utils.shallowMerge(Switcher.prototype, Each.prototype);

module.exports = {
	Each: Each,
	each: each
};
